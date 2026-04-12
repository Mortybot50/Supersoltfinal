import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDataStore } from "@/lib/store/dataStore";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, PageToolbar } from "@/components/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MoreVertical,
  CheckCircle,
  AlertTriangle,
  XCircle,
  MinusCircle,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { format, addMonths } from "date-fns";
import { Staff } from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

interface QualificationType {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  validity_months?: number;
  required_for_roles: string[];
}

interface StaffQualification {
  id: string;
  org_id: string;
  staff_id: string;
  qualification_type_id: string;
  issue_date?: string;
  expiry_date?: string;
  certificate_number?: string;
  evidence_url?: string;
  status: "valid" | "expiring" | "expired";
}

type MatrixStatus =
  | "valid"
  | "expiring"
  | "expired"
  | "not_assigned"
  | "not_required";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const HOSPO_QUAL_PRESETS = [
  "RSA (Responsible Service of Alcohol)",
  "Food Safety Supervisor Certificate",
  "First Aid Certificate",
  "Working With Children (WWC)",
  "Barista Certificate",
];

const ROLE_OPTIONS = ["manager", "supervisor", "crew"];

function computeStatus(expiry?: string): "valid" | "expiring" | "expired" {
  if (!expiry) return "valid";
  const exp = new Date(expiry);
  const now = new Date();
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  if (exp < now) return "expired";
  if (exp <= in30) return "expiring";
  return "valid";
}

function QualStatusBadge({
  status,
}: {
  status: "valid" | "expiring" | "expired";
}) {
  if (status === "valid")
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200">
        Valid
      </Badge>
    );
  if (status === "expiring")
    return (
      <Badge className="bg-amber-100 text-amber-800 border-amber-200">
        Expiring
      </Badge>
    );
  return <Badge variant="destructive">Expired</Badge>;
}

function MatrixCell({ status }: { status: MatrixStatus }) {
  if (status === "valid")
    return (
      <div className="flex justify-center">
        <CheckCircle className="h-5 w-5 text-green-600" />
      </div>
    );
  if (status === "expiring")
    return (
      <div className="flex justify-center">
        <AlertTriangle className="h-5 w-5 text-amber-500" />
      </div>
    );
  if (status === "expired")
    return (
      <div className="flex justify-center">
        <XCircle className="h-5 w-5 text-destructive" />
      </div>
    );
  if (status === "not_assigned")
    return (
      <div className="flex justify-center">
        <MinusCircle className="h-5 w-5 text-muted-foreground/30" />
      </div>
    );
  return null; // not_required
}

// ─── Qual Type Dialog ─────────────────────────────────────────────────────────

interface QualTypeDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orgId: string;
  editing?: QualificationType;
  onSaved: (q: QualificationType) => void;
  onDeleted?: (id: string) => void;
}

function QualTypeDialog({
  open,
  onOpenChange,
  orgId,
  editing,
  onSaved,
  onDeleted,
}: QualTypeDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [validityMonths, setValidity] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Populate on edit
  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setDescription(editing?.description ?? "");
      setValidity(
        editing?.validity_months ? String(editing.validity_months) : "",
      );
      setRoles(editing?.required_for_roles ?? []);
    }
  }, [open, editing]);

  const toggleRole = (role: string) =>
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    const payload = {
      org_id: orgId,
      name: name.trim(),
      description: description.trim() || null,
      validity_months: validityMonths ? parseInt(validityMonths) : null,
      required_for_roles: roles,
    };
    let data: QualificationType | null = null;
    let error = null;
    if (editing) {
      const res = await supabase
        .from("qualification_types")
        .update(payload)
        .eq("id", editing.id)
        .select()
        .single();
      data = res.data as QualificationType;
      error = res.error;
    } else {
      const res = await supabase
        .from("qualification_types")
        .insert(payload)
        .select()
        .single();
      data = res.data as QualificationType;
      error = res.error;
    }
    setSaving(false);
    if (error || !data) {
      toast.error("Failed to save");
      return;
    }
    onSaved(data);
    toast.success(editing ? "Updated" : "Created");
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!editing) return;
    const { error } = await supabase
      .from("qualification_types")
      .delete()
      .eq("id", editing.id);
    if (error) {
      toast.error("Failed to delete");
      return;
    }
    onDeleted?.(editing.id);
    toast.success("Deleted");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit" : "New"} Qualification Type
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. RSA Certificate"
              list="hospo-presets"
            />
            <datalist id="hospo-presets">
              {HOSPO_QUAL_PRESETS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
          <div>
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div>
            <Label>Validity Period (months)</Label>
            <Input
              type="number"
              min="1"
              max="120"
              value={validityMonths}
              onChange={(e) => setValidity(e.target.value)}
              placeholder="Leave blank = no expiry"
            />
          </div>
          <div>
            <Label>Required for Roles</Label>
            <div className="flex gap-2 mt-1">
              {ROLE_OPTIONS.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors capitalize ${
                    roles.includes(role)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-input hover:border-foreground"
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          {editing && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="mr-auto"
            >
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Assign Staff Qual Dialog ─────────────────────────────────────────────────

interface AssignDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orgId: string;
  qualTypes: QualificationType[];
  staffList: Staff[];
  existingQuals: StaffQualification[];
  onSaved: (q: StaffQualification) => void;
}

function AssignDialog({
  open,
  onOpenChange,
  orgId,
  qualTypes,
  staffList,
  existingQuals,
  onSaved,
}: AssignDialogProps) {
  const [staffId, setStaffId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [issueDate, setIssue] = useState("");
  const [expiryDate, setExpiry] = useState("");
  const [certNum, setCertNum] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedType = qualTypes.find((t) => t.id === typeId);
  const takenTypeIds = existingQuals
    .filter((q) => q.staff_id === staffId)
    .map((q) => q.qualification_type_id);

  useEffect(() => {
    if (issueDate && selectedType?.validity_months) {
      setExpiry(
        addMonths(new Date(issueDate), selectedType.validity_months)
          .toISOString()
          .split("T")[0],
      );
    }
  }, [issueDate, selectedType]);

  const handleSave = async () => {
    if (!staffId || !typeId) {
      toast.error("Select staff and qualification type");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("staff_qualifications")
      .insert({
        org_id: orgId,
        staff_id: staffId,
        qualification_type_id: typeId,
        issue_date: issueDate || null,
        expiry_date: expiryDate || null,
        certificate_number: certNum || null,
        status: computeStatus(expiryDate || undefined),
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error("Failed to save qualification");
      return;
    }
    onSaved(data as StaffQualification);
    toast.success("Qualification assigned");
    onOpenChange(false);
    setStaffId("");
    setTypeId("");
    setIssue("");
    setExpiry("");
    setCertNum("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Qualification</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Staff Member *</Label>
            <Select
              value={staffId}
              onValueChange={(v) => {
                setStaffId(v);
                setTypeId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select staff…" />
              </SelectTrigger>
              <SelectContent>
                {staffList
                  .filter((s) => s.status === "active")
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Qualification Type *</Label>
            <Select
              value={typeId}
              onValueChange={setTypeId}
              disabled={!staffId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type…" />
              </SelectTrigger>
              <SelectContent>
                {qualTypes
                  .filter((t) => !takenTypeIds.includes(t.id))
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Issue Date</Label>
              <Input
                type="date"
                value={issueDate}
                onChange={(e) => setIssue(e.target.value)}
              />
            </div>
            <div>
              <Label>Expiry Date</Label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiry(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Certificate Number</Label>
            <Input
              value={certNum}
              onChange={(e) => setCertNum(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Qualifications() {
  const { currentOrg } = useAuth();
  const { staff: staffList } = useDataStore();

  const [qualTypes, setQualTypes] = useState<QualificationType[]>([]);
  const [staffQuals, setStaffQuals] = useState<StaffQualification[]>([]);
  const [loading, setLoading] = useState(true);

  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<
    QualificationType | undefined
  >();
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentOrg?.id) return;
    setLoading(true);
    const [{ data: types }, { data: quals }] = await Promise.all([
      supabase
        .from("qualification_types")
        .select("*")
        .eq("org_id", currentOrg.id)
        .order("name"),
      supabase
        .from("staff_qualifications")
        .select("*")
        .eq("org_id", currentOrg.id),
    ]);
    if (types) setQualTypes(types as QualificationType[]);
    if (quals) {
      setStaffQuals(
        (quals as StaffQualification[]).map((q) => ({
          ...q,
          status: computeStatus(q.expiry_date),
        })),
      );
    }
    setLoading(false);
  }, [currentOrg?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Alerts: expiring / expired across all staff
  const alerts = staffQuals.filter((q) => q.status !== "valid");
  const expiredCount = alerts.filter((q) => q.status === "expired").length;
  const expiringCount = alerts.filter((q) => q.status === "expiring").length;

  const handleTypeSaved = (q: QualificationType) => {
    setQualTypes((prev) => {
      const exists = prev.find((t) => t.id === q.id);
      return exists ? prev.map((t) => (t.id === q.id ? q : t)) : [...prev, q];
    });
  };

  const handleTypeDeleted = (id: string) => {
    setQualTypes((prev) => prev.filter((t) => t.id !== id));
    setStaffQuals((prev) => prev.filter((q) => q.qualification_type_id !== id));
  };

  const handleQualAssigned = (q: StaffQualification) => {
    setStaffQuals((prev) => [
      ...prev,
      { ...q, status: computeStatus(q.expiry_date) },
    ]);
  };

  const handleDeleteQual = async (id: string) => {
    const { error } = await supabase
      .from("staff_qualifications")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Failed to remove");
      return;
    }
    setStaffQuals((prev) => prev.filter((q) => q.id !== id));
    toast.success("Removed");
  };

  const activeStaff = staffList.filter((s) => s.status === "active");

  // ── Toolbar ───────────────────────────────────────────────────────────────

  const toolbar = (
    <PageToolbar
      title="Qualifications"
      actions={
        <div className="flex gap-2">
          {(expiredCount > 0 || expiringCount > 0) && (
            <div className="flex items-center gap-1 text-sm">
              {expiredCount > 0 && (
                <Badge variant="destructive">{expiredCount} expired</Badge>
              )}
              {expiringCount > 0 && (
                <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                  {expiringCount} expiring
                </Badge>
              )}
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingType(undefined);
              setTypeDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Qual Type
          </Button>
          <Button size="sm" onClick={() => setAssignDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Assign
          </Button>
        </div>
      }
    />
  );

  if (loading) {
    return (
      <PageShell toolbar={toolbar}>
        <div className="p-4 text-center text-muted-foreground">Loading…</div>
      </PageShell>
    );
  }

  return (
    <PageShell toolbar={toolbar}>
      <div className="px-6 py-6">
        <Tabs defaultValue="types">
          <TabsList className="mb-4">
            <TabsTrigger value="types">
              Qualification Types ({qualTypes.length})
            </TabsTrigger>
            <TabsTrigger value="staff">
              Staff Records ({staffQuals.length})
              {alerts.length > 0 && (
                <AlertTriangle className="h-3 w-3 ml-1 text-amber-500" />
              )}
            </TabsTrigger>
            <TabsTrigger value="matrix">Matrix</TabsTrigger>
          </TabsList>

          {/* ── Types Tab ── */}
          <TabsContent value="types">
            {qualTypes.length === 0 ? (
              <Card className="p-8 text-center">
                <Shield className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">No qualification types yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Add common types like RSA, Food Safety, First Aid, WWC,
                  Barista.
                </p>
                <Button
                  onClick={() => {
                    setEditingType(undefined);
                    setTypeDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Qualification Type
                </Button>
              </Card>
            ) : (
              <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 dark:bg-slate-800/80">
                      <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                        Name
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                        Description
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                        Validity
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                        Required For
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                        Staff Holding
                      </TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {qualTypes.map((t) => {
                      const holdingCount = staffQuals.filter(
                        (q) => q.qualification_type_id === t.id,
                      ).length;
                      return (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">
                            {t.name}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {t.description || "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {t.validity_months
                              ? `${t.validity_months} months`
                              : "No expiry"}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {t.required_for_roles.length > 0 ? (
                                t.required_for_roles.map((r) => (
                                  <Badge
                                    key={r}
                                    variant="outline"
                                    className="capitalize text-xs"
                                  >
                                    {r}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  —
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {holdingCount}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditingType(t);
                                    setTypeDialogOpen(true);
                                  }}
                                >
                                  Edit
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* ── Staff Records Tab ── */}
          <TabsContent value="staff">
            {staffQuals.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="font-medium mb-2">
                  No staff qualifications assigned yet
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Assign qualifications to staff members to track expiry and
                  compliance.
                </p>
                <Button onClick={() => setAssignDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Assign Qualification
                </Button>
              </Card>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Member</TableHead>
                    <TableHead>Qualification</TableHead>
                    <TableHead>Certificate #</TableHead>
                    <TableHead>Issue Date</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffQuals.map((q) => {
                    const staffMember = staffList.find(
                      (s) => s.id === q.staff_id,
                    );
                    const qualType = qualTypes.find(
                      (t) => t.id === q.qualification_type_id,
                    );
                    return (
                      <TableRow key={q.id}>
                        <TableCell className="font-medium">
                          {staffMember?.name ?? "—"}
                        </TableCell>
                        <TableCell>{qualType?.name ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {q.certificate_number ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {q.issue_date
                            ? format(new Date(q.issue_date), "dd MMM yyyy")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {q.expiry_date
                            ? format(new Date(q.expiry_date), "dd MMM yyyy")
                            : "No expiry"}
                        </TableCell>
                        <TableCell>
                          <QualStatusBadge status={q.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteQual(q.id)}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* ── Matrix Tab ── */}
          <TabsContent value="matrix">
            {qualTypes.length === 0 || activeStaff.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">
                  {qualTypes.length === 0
                    ? "Add qualification types first to see the matrix."
                    : "No active staff found."}
                </p>
              </Card>
            ) : (
              <div className="overflow-x-auto">
                <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-green-600" /> Valid
                  </span>
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />{" "}
                    Expiring (&lt;30 days)
                  </span>
                  <span className="flex items-center gap-1">
                    <XCircle className="h-4 w-4 text-destructive" /> Expired
                  </span>
                  <span className="flex items-center gap-1">
                    <MinusCircle className="h-4 w-4 text-muted-foreground/30" />{" "}
                    Not assigned
                  </span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[140px]">
                        Staff Member
                      </TableHead>
                      {qualTypes.map((t) => (
                        <TableHead
                          key={t.id}
                          className="text-center min-w-[110px]"
                        >
                          <div className="text-xs leading-tight">{t.name}</div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeStaff.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        {qualTypes.map((t) => {
                          const qual = staffQuals.find(
                            (q) =>
                              q.staff_id === s.id &&
                              q.qualification_type_id === t.id,
                          );
                          const isRequired = t.required_for_roles.includes(
                            s.role,
                          );
                          let cellStatus: MatrixStatus;
                          if (qual) {
                            cellStatus = qual.status;
                          } else if (isRequired) {
                            cellStatus = "not_assigned";
                          } else {
                            cellStatus = "not_required";
                          }
                          return (
                            <TableCell key={t.id}>
                              <MatrixCell status={cellStatus} />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <QualTypeDialog
        open={typeDialogOpen}
        onOpenChange={setTypeDialogOpen}
        orgId={currentOrg?.id ?? ""}
        editing={editingType}
        onSaved={handleTypeSaved}
        onDeleted={handleTypeDeleted}
      />

      <AssignDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        orgId={currentOrg?.id ?? ""}
        qualTypes={qualTypes}
        staffList={staffList}
        existingQuals={staffQuals}
        onSaved={handleQualAssigned}
      />
    </PageShell>
  );
}
