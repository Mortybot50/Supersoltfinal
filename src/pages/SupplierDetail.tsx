import { useAuth } from "@/contexts/AuthContext";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Building2,
  Package,
  ShoppingCart,
  Calendar,
  TrendingUp,
  CalendarOff,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { useDataStore } from "@/lib/store/dataStore";
import { toast } from "sonner";
import { PageShell, PageToolbar } from "@/components/shared";
import { StatCards } from "@/components/ui/StatCards";
import { SecondaryStats } from "@/components/ui/SecondaryStats";
import { formatCurrency } from "@/lib/utils/formatters";
import {
  DeliveryScheduleGrid,
  getDefaultSchedule,
} from "@/components/inventory/DeliveryScheduleGrid";
import type { DeliveryScheduleEntry } from "@/components/inventory/DeliveryScheduleGrid";
import {
  format,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  subMonths,
} from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ── Zod Schema ────────────────────────────────────────────────
const supplierDetailSchema = z.object({
  name: z.string().min(1, "Name is required"),
  abn: z.string().optional(),
  is_gst_registered: z.boolean(),
  contact_person: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().optional(),
  suburb: z.string().optional(),
  state: z.string().optional(),
  postcode: z.string().optional(),
  payment_terms: z.string(),
  preferred_order_channel: z.string(),
  haccp_certified: z.boolean(),
  certificate_number: z.string().optional(),
  certificate_expiry: z.string().optional(),
  notes: z.string().optional(),
  active: z.boolean(),
});

type SupplierDetailFormData = z.infer<typeof supplierDetailSchema>;

// ── Schedule Override ─────────────────────────────────────────
interface ScheduleOverride {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  note: string;
}

const PAYMENT_TERMS_OPTIONS = [
  { value: "cod", label: "COD" },
  { value: "net-7", label: "Net 7" },
  { value: "net-14", label: "Net 14" },
  { value: "net-30", label: "Net 30" },
  { value: "eom", label: "EOM" },
];

const ORDER_CHANNEL_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "portal", label: "Portal" },
];

const PO_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  confirmed: "bg-yellow-100 text-yellow-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function SupplierDetail() {
  const { currentOrg: _currentOrg } = useAuth();
  const { supplierId } = useParams();
  const navigate = useNavigate();
  const {
    suppliers,
    ingredients,
    purchaseOrders,
    updateSupplier,
    loadSuppliersFromDB,
    loadIngredientsFromDB,
    loadPurchaseOrdersFromDB,
  } = useDataStore();

  const supplier = suppliers.find((s) => s.id === supplierId);

  const [activeTab, setActiveTab] = useState("details");
  const [deliverySchedule, setDeliverySchedule] =
    useState<DeliveryScheduleEntry[]>(getDefaultSchedule());
  const [scheduleOverrides, setScheduleOverrides] = useState<
    ScheduleOverride[]
  >([]);
  const [newOverride, setNewOverride] = useState({
    name: "",
    start_date: "",
    end_date: "",
    note: "",
  });
  const [priceHistory, setPriceHistory] = useState<
    Record<string, Array<{ date: string; cost: number }>>
  >({});

  // Load data on mount
  useEffect(() => {
    loadSuppliersFromDB();
    loadIngredientsFromDB();
    loadPurchaseOrdersFromDB();
  }, [loadSuppliersFromDB, loadIngredientsFromDB, loadPurchaseOrdersFromDB]);

  // Load price history from Supabase if the table exists
  useEffect(() => {
    if (!supplierId) return;
    const loadPriceHistory = async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        // Get top 5 products for this supplier
        const supplierIngredients = ingredients
          .filter((i) => i.supplier_id === supplierId && i.active)
          .slice(0, 5);

        if (supplierIngredients.length === 0) return;

        const ids = supplierIngredients.map((i) => i.id);
        const { data, error } = await supabase
          .from("ingredient_price_history")
          .select("ingredient_id, new_cost_cents, changed_at")
          .in("ingredient_id", ids)
          .order("changed_at", { ascending: true })
          .limit(200);

        if (error) {
          // Table might not exist — silently skip
          console.warn("Price history not available:", error.message);
          return;
        }

        if (data && data.length > 0) {
          const grouped: Record<
            string,
            Array<{ date: string; cost: number }>
          > = {};
          for (const row of data) {
            const name =
              supplierIngredients.find((i) => i.id === row.ingredient_id)
                ?.name || row.ingredient_id;
            if (!grouped[name]) grouped[name] = [];
            grouped[name].push({
              date: format(new Date(row.changed_at), "dd/MM"),
              cost: row.new_cost_cents / 100,
            });
          }
          setPriceHistory(grouped);
        }
      } catch {
        // Silently skip — table may not exist
      }
    };
    if (ingredients.length > 0) loadPriceHistory();
  }, [supplierId, ingredients]);

  // Redirect if supplier not found
  useEffect(() => {
    if (suppliers.length > 0 && !supplier) {
      navigate("/suppliers");
      toast.error("Supplier not found");
    }
  }, [supplier, suppliers.length, navigate]);

  // React Hook Form
  const {
    register,
    handleSubmit: _handleSubmit,
    control,
    reset,
    getValues,
    formState: { errors },
  } = useForm<SupplierDetailFormData>({
    resolver: zodResolver(supplierDetailSchema),
    defaultValues: {
      name: "",
      abn: "",
      is_gst_registered: true,
      contact_person: "",
      phone: "",
      email: "",
      address: "",
      suburb: "",
      state: "",
      postcode: "",
      payment_terms: "net-30",
      preferred_order_channel: "email",
      haccp_certified: false,
      certificate_number: "",
      certificate_expiry: "",
      notes: "",
      active: true,
    },
  });

  // Sync form with supplier data
  useEffect(() => {
    if (!supplier) return;
    reset({
      name: supplier.name || "",
      abn: supplier.abn || "",
      is_gst_registered: supplier.is_gst_registered ?? true,
      contact_person: supplier.contact_person || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      suburb: supplier.suburb || "",
      state: supplier.state || "",
      postcode: supplier.postcode || "",
      payment_terms: supplier.payment_terms || "net-30",
      preferred_order_channel:
        ((supplier as Record<string, unknown>)
          .preferred_order_channel as string) ||
        supplier.order_method ||
        "email",
      haccp_certified:
        ((supplier as Record<string, unknown>).haccp_certified as boolean) ??
        false,
      certificate_number:
        ((supplier as Record<string, unknown>).certificate_number as string) ||
        "",
      certificate_expiry:
        ((supplier as Record<string, unknown>).certificate_expiry as string) ||
        "",
      notes: supplier.notes || "",
      active: supplier.active,
    });
    // Load delivery schedule from supplier if available
    const ds = (supplier as Record<string, unknown>).delivery_schedule;
    if (Array.isArray(ds) && ds.length === 7) {
      setDeliverySchedule(ds as DeliveryScheduleEntry[]);
    } else {
      setDeliverySchedule(getDefaultSchedule());
    }
    // Load schedule overrides
    const so = (supplier as Record<string, unknown>).schedule_overrides;
    if (Array.isArray(so)) {
      setScheduleOverrides(so as ScheduleOverride[]);
    }
  }, [supplier, reset]);

  // Auto-save on blur
  const handleAutoSave = useCallback(async () => {
    if (!supplierId || !supplier) return;
    const values = getValues();
    // Validate before saving
    const result = supplierDetailSchema.safeParse(values);
    if (!result.success) return;

    try {
      await updateSupplier(supplierId, {
        name: values.name,
        abn: values.abn || undefined,
        is_gst_registered: values.is_gst_registered,
        contact_person: values.contact_person || undefined,
        phone: values.phone || undefined,
        email: values.email || undefined,
        address: values.address || undefined,
        suburb: values.suburb || undefined,
        state: values.state || undefined,
        postcode: values.postcode || undefined,
        payment_terms: values.payment_terms as
          | "cod"
          | "net-7"
          | "net-14"
          | "net-30"
          | "net-60",
        notes: values.notes || undefined,
        active: values.active,
        // Extended fields saved via raw update (columns exist after migration)
      } as Record<string, unknown>);
      // Also persist extended fields
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        await supabase
          .from("suppliers")
          .update({
            preferred_order_channel: values.preferred_order_channel,
            haccp_certified: values.haccp_certified,
            certificate_number: values.certificate_number || null,
            certificate_expiry: values.certificate_expiry || null,
          } as Record<string, unknown>)
          .eq("id", supplierId);
      } catch {
        // Extended columns may not exist yet — ignore
      }
    } catch {
      toast.error("Failed to save");
    }
  }, [supplierId, supplier, getValues, updateSupplier]);

  // Save delivery schedule
  const handleScheduleSave = useCallback(
    async (schedule: DeliveryScheduleEntry[]) => {
      setDeliverySchedule(schedule);
      if (!supplierId) return;
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        await supabase
          .from("suppliers")
          .update({ delivery_schedule: schedule } as Record<string, unknown>)
          .eq("id", supplierId);
      } catch {
        // Column may not exist yet
      }
    },
    [supplierId],
  );

  // Add schedule override
  const handleAddOverride = useCallback(async () => {
    if (!newOverride.name || !newOverride.start_date || !newOverride.end_date) {
      toast.error("Name, start date, and end date are required");
      return;
    }
    const override: ScheduleOverride = {
      id: crypto.randomUUID(),
      ...newOverride,
    };
    const updated = [...scheduleOverrides, override];
    setScheduleOverrides(updated);
    setNewOverride({ name: "", start_date: "", end_date: "", note: "" });

    if (!supplierId) return;
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      await supabase
        .from("suppliers")
        .update({ schedule_overrides: updated } as Record<string, unknown>)
        .eq("id", supplierId);
      toast.success("Override added");
    } catch {
      // Column may not exist yet
      toast.success("Override added (local)");
    }
  }, [newOverride, scheduleOverrides, supplierId]);

  // Remove schedule override
  const handleRemoveOverride = useCallback(
    async (id: string) => {
      const updated = scheduleOverrides.filter((o) => o.id !== id);
      setScheduleOverrides(updated);
      if (!supplierId) return;
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        await supabase
          .from("suppliers")
          .update({ schedule_overrides: updated } as Record<string, unknown>)
          .eq("id", supplierId);
      } catch {
        // Column may not exist
      }
    },
    [scheduleOverrides, supplierId],
  );

  // ── Computed Data ───────────────────────────────────────────
  const supplierProducts = useMemo(
    () => ingredients.filter((i) => i.supplier_id === supplierId),
    [ingredients, supplierId],
  );

  const supplierPOs = useMemo(
    () =>
      purchaseOrders
        .filter((po) => po.supplier_id === supplierId)
        .sort(
          (a, b) =>
            new Date(b.order_date).getTime() - new Date(a.order_date).getTime(),
        )
        .slice(0, 20),
    [purchaseOrders, supplierId],
  );

  const spendMetrics = useMemo(() => {
    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const thisMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    let thisMonth = 0;
    let lastMonth = 0;
    let allTime = 0;

    const allPOs = purchaseOrders.filter((po) => po.supplier_id === supplierId);
    allPOs
      .filter((po) => po.status === "delivered")
      .forEach((po) => {
        const d = new Date(po.order_date);
        allTime += po.total;
        if (isWithinInterval(d, { start: thisMonthStart, end: thisMonthEnd }))
          thisMonth += po.total;
        if (isWithinInterval(d, { start: lastMonthStart, end: lastMonthEnd }))
          lastMonth += po.total;
      });

    return { thisMonth, lastMonth, allTime, orderCount: allPOs.length };
  }, [purchaseOrders, supplierId]);

  // Monthly spend sparkline data (last 6 months)
  const monthlySpendData = useMemo(() => {
    const now = new Date();
    const months: Array<{ month: string; spend: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const mDate = subMonths(now, i);
      const mStart = startOfMonth(mDate);
      const mEnd = endOfMonth(mDate);
      let spend = 0;
      purchaseOrders
        .filter(
          (po) => po.supplier_id === supplierId && po.status === "delivered",
        )
        .forEach((po) => {
          if (
            isWithinInterval(new Date(po.order_date), {
              start: mStart,
              end: mEnd,
            })
          ) {
            spend += po.total;
          }
        });
      months.push({ month: format(mDate, "MMM"), spend: spend / 100 });
    }
    return months;
  }, [purchaseOrders, supplierId]);

  if (!supplier) {
    return (
      <PageShell>
        <div className="p-12 text-center">
          <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin opacity-50" />
          <p className="text-muted-foreground">Loading supplier...</p>
        </div>
      </PageShell>
    );
  }

  const toolbar = (
    <PageToolbar
      title={supplier.name}
      filters={
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/suppliers")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Badge variant={supplier.active ? "default" : "secondary"}>
            {supplier.active ? "Active" : "Inactive"}
          </Badge>
        </div>
      }
    />
  );

  return (
    <PageShell toolbar={toolbar}>
      <div className="px-4 pt-4 space-y-3">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/suppliers">Suppliers</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{supplier.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <StatCards
          stats={[
            { label: "Products", value: supplierProducts.length },
            { label: "Orders", value: spendMetrics.orderCount },
            {
              label: "This Month",
              value: formatCurrency(spendMetrics.thisMonth),
            },
          ]}
          columns={3}
        />
        <SecondaryStats
          stats={[
            {
              label: "Last Month",
              value: formatCurrency(spendMetrics.lastMonth),
            },
            { label: "All Time", value: formatCurrency(spendMetrics.allTime) },
          ]}
        />
      </div>

      <div className="p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="details">
              <Building2 className="h-4 w-4 mr-2" />
              Details
            </TabsTrigger>
            <TabsTrigger value="schedule">
              <Calendar className="h-4 w-4 mr-2" />
              Schedule
            </TabsTrigger>
            <TabsTrigger value="products">
              <Package className="h-4 w-4 mr-2" />
              Products ({supplierProducts.length})
            </TabsTrigger>
            <TabsTrigger value="orders">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Orders
            </TabsTrigger>
            <TabsTrigger value="prices">
              <TrendingUp className="h-4 w-4 mr-2" />
              Prices
            </TabsTrigger>
          </TabsList>

          {/* ── A) Details Form (auto-save on blur) ──────────── */}
          <TabsContent value="details" className="space-y-4">
            <Card className="p-6 space-y-6">
              <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                Supplier Details
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    {...register("name")}
                    onBlur={handleAutoSave}
                  />
                  {errors.name && (
                    <p className="text-xs text-destructive mt-1">
                      {errors.name.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="abn">ABN</Label>
                  <Input
                    id="abn"
                    {...register("abn")}
                    placeholder="12 345 678 901"
                    maxLength={14}
                    onBlur={handleAutoSave}
                  />
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Controller
                    control={control}
                    name="is_gst_registered"
                    render={({ field }) => (
                      <Switch
                        id="gst-toggle"
                        checked={field.value}
                        onCheckedChange={(v) => {
                          field.onChange(v);
                          setTimeout(handleAutoSave, 0);
                        }}
                      />
                    )}
                  />
                  <Label htmlFor="gst-toggle">GST Registered</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Controller
                    control={control}
                    name="active"
                    render={({ field }) => (
                      <Switch
                        id="active-toggle"
                        checked={field.value}
                        onCheckedChange={(v) => {
                          field.onChange(v);
                          setTimeout(handleAutoSave, 0);
                        }}
                      />
                    )}
                  />
                  <Label htmlFor="active-toggle">Active</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="contact_person">Contact</Label>
                  <Input
                    id="contact_person"
                    {...register("contact_person")}
                    onBlur={handleAutoSave}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    {...register("phone")}
                    onBlur={handleAutoSave}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    {...register("email")}
                    onBlur={handleAutoSave}
                  />
                  {errors.email && (
                    <p className="text-xs text-destructive mt-1">
                      {errors.email.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  {...register("address")}
                  onBlur={handleAutoSave}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="suburb">Suburb</Label>
                  <Input
                    id="suburb"
                    {...register("suburb")}
                    onBlur={handleAutoSave}
                  />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Controller
                    control={control}
                    name="state"
                    render={({ field }) => (
                      <Select
                        value={field.value || "_none"}
                        onValueChange={(v) => {
                          field.onChange(v === "_none" ? "" : v);
                          setTimeout(handleAutoSave, 0);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Select</SelectItem>
                          {[
                            "VIC",
                            "NSW",
                            "QLD",
                            "WA",
                            "SA",
                            "TAS",
                            "ACT",
                            "NT",
                          ].map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div>
                  <Label htmlFor="postcode">Postcode</Label>
                  <Input
                    id="postcode"
                    {...register("postcode")}
                    maxLength={4}
                    onBlur={handleAutoSave}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Payment Terms</Label>
                  <Controller
                    control={control}
                    name="payment_terms"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={(v) => {
                          field.onChange(v);
                          setTimeout(handleAutoSave, 0);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_TERMS_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div>
                  <Label>Order Channel</Label>
                  <Controller
                    control={control}
                    name="preferred_order_channel"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={(v) => {
                          field.onChange(v);
                          setTimeout(handleAutoSave, 0);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ORDER_CHANNEL_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              {/* HACCP */}
              <div className="border-t pt-4 space-y-4">
                <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                  Food Safety
                </h3>
                <div className="flex items-center gap-2">
                  <Controller
                    control={control}
                    name="haccp_certified"
                    render={({ field }) => (
                      <Switch
                        id="haccp-toggle"
                        checked={field.value}
                        onCheckedChange={(v) => {
                          field.onChange(v);
                          setTimeout(handleAutoSave, 0);
                        }}
                      />
                    )}
                  />
                  <Label htmlFor="haccp-toggle">HACCP Certified</Label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="certificate_number">
                      Certificate Number
                    </Label>
                    <Input
                      id="certificate_number"
                      {...register("certificate_number")}
                      onBlur={handleAutoSave}
                    />
                  </div>
                  <div>
                    <Label htmlFor="certificate_expiry">
                      Certificate Expiry
                    </Label>
                    <Input
                      id="certificate_expiry"
                      type="date"
                      {...register("certificate_expiry")}
                      onBlur={handleAutoSave}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  {...register("notes")}
                  rows={3}
                  onBlur={handleAutoSave}
                />
              </div>
            </Card>
          </TabsContent>

          {/* ── B) Delivery Schedule + C) Schedule Overrides ── */}
          <TabsContent value="schedule" className="space-y-4">
            <DeliveryScheduleGrid
              schedule={deliverySchedule}
              onChange={handleScheduleSave}
            />

            {/* Schedule Overrides */}
            <Card className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <CalendarOff className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-semibold">
                  Schedule Overrides
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Add temporary overrides for holidays, closures, or special
                periods.
              </p>

              {scheduleOverrides.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>End</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scheduleOverrides.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium">{o.name}</TableCell>
                        <TableCell>{o.start_date}</TableCell>
                        <TableCell>{o.end_date}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {o.note || "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveOverride(o.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input
                    placeholder="e.g., Easter break"
                    value={newOverride.name}
                    onChange={(e) =>
                      setNewOverride({ ...newOverride, name: e.target.value })
                    }
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Start</Label>
                  <Input
                    type="date"
                    value={newOverride.start_date}
                    onChange={(e) =>
                      setNewOverride({
                        ...newOverride,
                        start_date: e.target.value,
                      })
                    }
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">End</Label>
                  <Input
                    type="date"
                    value={newOverride.end_date}
                    onChange={(e) =>
                      setNewOverride({
                        ...newOverride,
                        end_date: e.target.value,
                      })
                    }
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Note</Label>
                  <Input
                    placeholder="Optional"
                    value={newOverride.note}
                    onChange={(e) =>
                      setNewOverride({ ...newOverride, note: e.target.value })
                    }
                    className="h-8 text-sm"
                  />
                </div>
                <Button size="sm" className="h-8" onClick={handleAddOverride}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* ── D) Products Supplied (read-only) ──────────────── */}
          <TabsContent value="products" className="space-y-4">
            <Card>
              {supplierProducts.length === 0 ? (
                <div className="p-12 text-center">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Products</h3>
                  <p className="text-sm text-muted-foreground">
                    No ingredients are linked to this supplier yet.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplierProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">
                          {product.name}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="text-xs capitalize"
                          >
                            {product.category}
                          </Badge>
                        </TableCell>
                        <TableCell>{product.unit}</TableCell>
                        <TableCell className="text-right">
                          ${(product.cost_per_unit / 100).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm font-mono">
                          {product.product_code || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={product.active ? "default" : "secondary"}
                          >
                            {product.active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </TabsContent>

          {/* ── E) Order History + Monthly Spend Sparkline ────── */}
          <TabsContent value="orders" className="space-y-4">
            {/* Sparkline */}
            {monthlySpendData.some((m) => m.spend > 0) && (
              <Card className="p-4">
                <Label className="text-sm font-semibold mb-2 block">
                  Monthly Spend (6 months)
                </Label>
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={monthlySpendData}>
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={50} />
                    <Tooltip
                      formatter={(value: number) => [
                        `$${value.toFixed(2)}`,
                        "Spend",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="spend"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            )}

            {supplierPOs.length === 0 ? (
              <Card className="p-12 text-center">
                <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Orders Yet</h3>
                <p className="text-sm text-muted-foreground">
                  Order history will appear once purchase orders are created.
                </p>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PO #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Delivery</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplierPOs.map((po) => (
                      <TableRow
                        key={po.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() =>
                          navigate(`/inventory/purchase-orders/${po.id}`)
                        }
                      >
                        <TableCell className="font-mono font-medium">
                          {po.po_number}
                        </TableCell>
                        <TableCell>
                          {format(new Date(po.order_date), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell>
                          {format(
                            new Date(po.expected_delivery_date),
                            "dd MMM yyyy",
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={PO_STATUS_COLORS[po.status] || ""}>
                            {po.status.charAt(0).toUpperCase() +
                              po.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>{po.items?.length || 0}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(po.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          {/* ── F) Price History ───────────────────────────────── */}
          <TabsContent value="prices" className="space-y-4">
            {Object.keys(priceHistory).length === 0 ? (
              <Card className="p-12 text-center">
                <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Price History</h3>
                <p className="text-sm text-muted-foreground">
                  Price trends will appear once ingredient costs are tracked
                  over time.
                </p>
              </Card>
            ) : (
              Object.entries(priceHistory).map(([name, data]) => (
                <Card key={name} className="p-4">
                  <Label className="text-sm font-semibold mb-2 block">
                    {name}
                  </Label>
                  <ResponsiveContainer width="100%" height={100}>
                    <LineChart data={data}>
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} width={45} />
                      <Tooltip
                        formatter={(value: number) => [
                          `$${value.toFixed(2)}`,
                          "Cost",
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="cost"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
}
