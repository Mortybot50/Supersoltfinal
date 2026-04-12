import { useEffect, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ChevronLeft,
  FileText,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  GitMerge,
  Calendar,
  Building,
  Hash,
  Upload,
  Mail,
  ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useDataStore } from "@/lib/store/dataStore";
import { useAuth } from "@/contexts/AuthContext";
import { Invoice, InvoiceLineItem } from "@/types";
import { format, isValid } from "date-fns";
import { PageShell, PageToolbar } from "@/components/shared";
import { formatCurrency } from "@/lib/utils/formatters";
import { supabase } from "@/integrations/supabase/client";

function safeFormat(date: unknown, fmt: string, fallback = "—"): string {
  try {
    const d = date instanceof Date ? date : new Date(date as string);
    return isValid(d) ? format(d, fmt) : fallback;
  } catch {
    return fallback;
  }
}

const STATUS_CONFIG: Record<
  Invoice["status"],
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    color: string;
  }
> = {
  pending_review: {
    label: "Pending Review",
    variant: "secondary",
    color: "text-amber-600",
  },
  confirmed: {
    label: "Confirmed",
    variant: "default",
    color: "text-green-600",
  },
  disputed: {
    label: "Disputed",
    variant: "destructive",
    color: "text-destructive",
  },
  duplicate: {
    label: "Duplicate",
    variant: "outline",
    color: "text-muted-foreground",
  },
};

const MATCH_CONFIG: Record<
  InvoiceLineItem["match_status"],
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  auto_matched: { label: "Auto Matched", variant: "default" },
  manual_matched: { label: "Manual Match", variant: "secondary" },
  new_ingredient: { label: "New Ingredient", variant: "outline" },
  unmatched: { label: "Unmatched", variant: "destructive" },
};

export default function InvoiceDetail() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const { currentVenue } = useAuth();
  const { invoices, suppliers, purchaseOrders, loadInvoicesFromDB } =
    useDataStore();

  useEffect(() => {
    if (currentVenue?.id && currentVenue.id !== "all") {
      loadInvoicesFromDB(currentVenue.id);
    }
  }, [currentVenue?.id, loadInvoicesFromDB]);

  const invoice = useMemo(
    () => invoices.find((inv) => inv.id === invoiceId),
    [invoices, invoiceId],
  );

  const supplier = useMemo(
    () =>
      invoice?.supplier_id
        ? suppliers.find((s) => s.id === invoice.supplier_id)
        : null,
    [invoice, suppliers],
  );

  const matchedPO = useMemo(
    () =>
      invoice?.matched_po_id
        ? purchaseOrders.find((po) => po.id === invoice.matched_po_id)
        : null,
    [invoice, purchaseOrders],
  );

  const handleViewFile = async () => {
    if (!invoice?.original_file_url) return;
    const { data } = await supabase.storage
      .from("invoices")
      .createSignedUrl(invoice.original_file_url, 300);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  };

  if (!invoice) {
    return (
      <PageShell toolbar={<div />}>
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FileText className="h-10 w-10 opacity-30 mb-2" />
          <p className="text-sm">Invoice not found.</p>
          <Button
            variant="ghost"
            className="mt-4"
            onClick={() => navigate("/inventory/invoices")}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Back to Invoices
          </Button>
        </div>
      </PageShell>
    );
  }

  const statusCfg = STATUS_CONFIG[invoice.status];
  const lineItems = invoice.line_items ?? [];

  const toolbar = (
    <PageToolbar
      title={
        invoice.invoice_number
          ? `Invoice ${invoice.invoice_number}`
          : "Invoice Detail"
      }
      filters={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/inventory/invoices")}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
      }
      actions={
        invoice.status !== "confirmed" && invoice.status !== "duplicate" ? (
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() =>
              navigate(`/inventory/purchases/from-invoice/${invoice.id}`)
            }
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Create Purchase
          </Button>
        ) : undefined
      }
      primaryAction={
        invoice.status === "pending_review"
          ? {
              label: "Reconcile",
              icon: GitMerge,
              onClick: () =>
                navigate(`/inventory/invoices/${invoice.id}/reconcile`),
              variant: "default",
            }
          : undefined
      }
    />
  );

  return (
    <PageShell toolbar={toolbar}>
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        {/* ── Invoice Metadata ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Status
                </CardTitle>
                <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building className="h-4 w-4" />
                <span className="font-medium text-foreground">
                  {invoice.supplier_name ?? "—"}
                </span>
                {supplier && (
                  <Link to={`/suppliers/${supplier.id}`} className="ml-auto">
                    <Button variant="ghost" size="sm" className="h-7 text-xs">
                      View Supplier <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                )}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Hash className="h-4 w-4" />
                <span>{invoice.invoice_number ?? "No invoice number"}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>
                  {safeFormat(invoice.invoice_date, "d MMMM yyyy")}
                  {invoice.due_date && (
                    <span className="ml-2 text-xs">
                      (Due: {safeFormat(invoice.due_date, "d MMM yyyy")})
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                {invoice.source === "email" ? (
                  <Mail className="h-4 w-4" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                <span className="capitalize">{invoice.source}</span>
                {invoice.sender_email && (
                  <span className="text-xs ml-1">({invoice.sender_email})</span>
                )}
              </div>
              {invoice.original_file_url && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleViewFile}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  View Original File
                  <ExternalLink className="h-3 w-3 ml-auto" />
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Financials
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>
                  {invoice.subtotal != null
                    ? formatCurrency(invoice.subtotal * 100)
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">GST</span>
                <span>
                  {invoice.tax_amount != null
                    ? formatCurrency(invoice.tax_amount * 100)
                    : "—"}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-base">
                <span>Total</span>
                <span>
                  {invoice.total_amount != null
                    ? formatCurrency(invoice.total_amount * 100)
                    : "—"}
                </span>
              </div>
              {invoice.document_type !== "invoice" && (
                <Badge variant="outline" className="mt-1 capitalize">
                  {invoice.document_type.replace("_", " ")}
                </Badge>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── PO Match ─────────────────────────────────────────────── */}
        {matchedPO && (
          <Card className="border-blue-200 bg-blue-50/30 dark:bg-blue-950/20">
            <CardContent className="pt-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <GitMerge className="h-4 w-4 text-blue-600" />
                <span>Matched to PO:</span>
                <span className="font-medium">{matchedPO.po_number}</span>
              </div>
              <Link to={`/inventory/purchase-orders/${matchedPO.id}`}>
                <Button variant="outline" size="sm">
                  View PO <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* ── Line Items ───────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Line Items
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({lineItems.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {lineItems.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No line items recorded.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Ingredient</TableHead>
                      <TableHead>Match</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Confidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((li) => {
                      const matchCfg = MATCH_CONFIG[li.match_status];
                      const conf = li.confidence_score ?? 0;
                      return (
                        <TableRow key={li.id}>
                          <TableCell className="text-sm max-w-[180px]">
                            <p className="truncate" title={li.raw_description}>
                              {li.raw_description}
                            </p>
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {li.ingredient_name ?? (
                              <span className="text-muted-foreground italic">
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={matchCfg.variant}
                              className="text-xs"
                            >
                              {matchCfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {li.confirmed_quantity ??
                              li.extracted_quantity ??
                              "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {li.extracted_unit ?? "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {(li.confirmed_unit_price ??
                              li.extracted_unit_price) != null
                              ? formatCurrency(
                                  (li.confirmed_unit_price ??
                                    li.extracted_unit_price)! * 100,
                                )
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {li.extracted_line_total != null
                              ? formatCurrency(li.extracted_line_total * 100)
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {conf >= 0.85 ? (
                                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                              ) : conf >= 0.5 ? (
                                <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                              ) : (
                                <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                              )}
                              <span className="text-xs text-muted-foreground">
                                {Math.round(conf * 100)}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Notes ───────────────────────────────────────────────── */}
        {invoice.notes && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{invoice.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* ── Actions ─────────────────────────────────────────────── */}
        {invoice.status !== "confirmed" && invoice.status !== "duplicate" && (
          <div className="flex justify-end gap-3">
            {invoice.status === "pending_review" && (
              <Button
                variant="outline"
                onClick={() =>
                  navigate(`/inventory/invoices/${invoice.id}/reconcile`)
                }
              >
                <GitMerge className="h-4 w-4 mr-2" />
                Reconcile Invoice
              </Button>
            )}
            <Button
              onClick={() =>
                navigate(`/inventory/purchases/from-invoice/${invoice.id}`)
              }
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Create Purchase
            </Button>
          </div>
        )}
      </div>
    </PageShell>
  );
}
