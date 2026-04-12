import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  AlertTriangle,
  XCircle,
  X,
  ChevronLeft,
  PlusCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDataStore } from "@/lib/store/dataStore";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  parseInvoice,
  ParsedInvoice,
  ParsedLineItem,
} from "@/lib/services/invoiceParser";
import { matchLineItems, MatchResult } from "@/lib/services/ingredientMatcher";
import { Invoice, InvoiceLineItem } from "@/types";
import { toast } from "sonner";
import { PageShell, PageToolbar } from "@/components/shared";
import { formatCurrency } from "@/lib/utils/formatters";

type Step = "upload" | "parsing" | "review" | "saving";

interface ReviewLine extends ParsedLineItem {
  id: string;
  matchResult: MatchResult;
  // Operator edits
  editedQuantity: string;
  editedUnitPrice: string;
  editedIngredientId: string; // '' = unmatched/new
  editedIngredientName: string; // for new ingredient creation
}

function confidenceBadge(score: number) {
  if (score >= 0.85)
    return (
      <Badge variant="default" className="bg-green-500 text-white text-xs">
        High
      </Badge>
    );
  if (score >= 0.5)
    return (
      <Badge
        variant="secondary"
        className="bg-amber-100 text-amber-700 border-amber-300 text-xs"
      >
        Medium
      </Badge>
    );
  return (
    <Badge variant="destructive" className="text-xs">
      Low
    </Badge>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function InvoiceUpload() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectSupplierId = searchParams.get("supplier");

  const { currentVenue, currentOrg, user } = useAuth();
  const { suppliers, ingredients, invoices, addInvoice } = useDataStore();

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedInvoice | null>(null);
  const [reviewLines, setReviewLines] = useState<ReviewLine[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  // Invoice-level overrides
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState(
    preselectSupplierId ?? "",
  );
  const [notes, setNotes] = useState("");
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

  const dropRef = useRef<HTMLDivElement>(null);

  const venueSuppliers = suppliers.filter((s) => s.active !== false);

  const handleFileSelect = useCallback((selected: File | null) => {
    if (!selected) return;
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];
    if (!allowed.includes(selected.type)) {
      toast.error("Only PDF, JPEG, PNG, or WebP files are supported.");
      return;
    }
    if (selected.size > 20 * 1024 * 1024) {
      toast.error("File must be under 20 MB.");
      return;
    }
    setFile(selected);
    setParseError(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const dropped = e.dataTransfer.files[0];
      handleFileSelect(dropped ?? null);
    },
    [handleFileSelect],
  );

  const handleParse = async () => {
    if (!file) return;
    if (!currentVenue?.id || currentVenue.id === "all") {
      toast.error(
        "Please select a specific venue before uploading an invoice.",
      );
      return;
    }

    setStep("parsing");
    setParseError(null);

    try {
      const parsed = await parseInvoice(file);
      setParsedData(parsed);

      // Pre-populate invoice-level fields
      setInvoiceNumber(parsed.invoice_number ?? "");
      setInvoiceDate(parsed.invoice_date ?? "");

      // Auto-select supplier if matched by name
      if (!selectedSupplierId && parsed.supplier_name) {
        const match = venueSuppliers.find(
          (s) =>
            s.name
              .toLowerCase()
              .includes(parsed.supplier_name!.toLowerCase()) ||
            parsed.supplier_name!.toLowerCase().includes(s.name.toLowerCase()),
        );
        if (match) setSelectedSupplierId(match.id);
      }

      // Match line items to ingredients
      const matchResults = matchLineItems(parsed.line_items, ingredients);

      const lines: ReviewLine[] = parsed.line_items.map((item, idx) => {
        const mr = matchResults[idx];
        return {
          ...item,
          id: crypto.randomUUID(),
          matchResult: mr,
          editedQuantity: item.extracted_quantity?.toString() ?? "",
          editedUnitPrice: item.extracted_unit_price?.toString() ?? "",
          editedIngredientId: mr.matched_ingredient?.id ?? "",
          editedIngredientName: "",
        };
      });

      setReviewLines(lines);
      setStep("review");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to parse invoice";
      setParseError(msg);
      setStep("upload");
      toast.error(msg);
    }
  };

  const updateLine = (id: string, updates: Partial<ReviewLine>) => {
    setReviewLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...updates } : l)),
    );
  };

  const checkDuplicate = (): boolean => {
    if (!invoiceNumber || !selectedSupplierId) return false;
    return invoices.some(
      (inv) =>
        inv.invoice_number === invoiceNumber &&
        inv.supplier_id === selectedSupplierId &&
        inv.status !== "duplicate",
    );
  };

  const performSave = async (asDuplicate: boolean) => {
    if (!currentVenue?.id || currentOrg?.id == null) return;
    setStep("saving");

    try {
      // 1. Upload file to Supabase Storage
      let fileUrl: string | undefined;
      if (file) {
        const filePath = `${currentOrg.id}/${currentVenue.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: uploadError } = await supabase.storage
          .from("invoices")
          .upload(filePath, file, { contentType: file.type, upsert: false });

        if (uploadError) {
          console.warn(
            "[InvoiceUpload] Storage upload failed (non-fatal):",
            uploadError,
          );
          toast.warning(
            "File upload failed, but invoice will be saved without attachment.",
          );
        } else {
          fileUrl = filePath;
        }
      }

      const invoiceId = crypto.randomUUID();
      const now = new Date().toISOString();
      const selectedSupplier = venueSuppliers.find(
        (s) => s.id === selectedSupplierId,
      );

      const invoice: Invoice = {
        id: invoiceId,
        org_id: currentOrg.id,
        venue_id: currentVenue.id,
        supplier_id: selectedSupplierId || undefined,
        supplier_name: selectedSupplier?.name,
        source: "upload",
        original_file_url: fileUrl,
        original_filename: file?.name,
        invoice_number: invoiceNumber || undefined,
        invoice_date: invoiceDate || undefined,
        subtotal: parsedData?.subtotal ?? undefined,
        tax_amount: parsedData?.tax_amount ?? undefined,
        total_amount: parsedData?.total_amount ?? undefined,
        currency: parsedData?.currency ?? "AUD",
        document_type: parsedData?.document_type ?? "invoice",
        status: asDuplicate ? "duplicate" : "pending_review",
        notes: notes || undefined,
        processing_metadata: parsedData ? { raw: parsedData } : undefined,
        created_at: now,
        updated_at: now,
      };

      const lineItems: InvoiceLineItem[] = reviewLines.map((line) => ({
        id: line.id,
        invoice_id: invoiceId,
        ingredient_id: line.editedIngredientId || undefined,
        ingredient_name: ingredients.find(
          (i) => i.id === line.editedIngredientId,
        )?.name,
        raw_description: line.raw_description,
        extracted_quantity: line.extracted_quantity ?? undefined,
        extracted_unit: line.extracted_unit ?? undefined,
        extracted_unit_price: line.extracted_unit_price ?? undefined,
        extracted_line_total: line.extracted_line_total ?? undefined,
        extracted_tax: line.extracted_tax ?? undefined,
        extracted_discount: line.extracted_discount ?? undefined,
        confidence_score: line.confidence_score,
        match_status: line.editedIngredientId
          ? line.matchResult.match_status === "auto_matched"
            ? "auto_matched"
            : "manual_matched"
          : line.editedIngredientName
            ? "new_ingredient"
            : "unmatched",
        confirmed_quantity: line.editedQuantity
          ? parseFloat(line.editedQuantity)
          : undefined,
        confirmed_unit_price: line.editedUnitPrice
          ? parseFloat(line.editedUnitPrice)
          : undefined,
        created_at: now,
      }));

      await addInvoice(invoice, lineItems);

      toast.success("Invoice saved successfully.");
      navigate(`/inventory/invoices/${invoiceId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save invoice";
      toast.error(msg);
      setStep("review");
    }
  };

  const handleSave = async () => {
    if (!currentVenue?.id || currentVenue.id === "all") {
      toast.error("Please select a specific venue.");
      return;
    }
    if (!currentOrg?.id) {
      toast.error("No organisation found.");
      return;
    }
    if (checkDuplicate()) {
      setShowDuplicateDialog(true);
      return;
    }
    performSave(false);
  };

  const toolbar = (
    <PageToolbar
      title="Upload Invoice"
      filters={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/inventory/invoices")}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Invoices
        </Button>
      }
    />
  );

  return (
    <PageShell toolbar={toolbar}>
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        {/* ── Step 1: File Drop Zone ──────────────────────────────── */}
        {(step === "upload" || step === "parsing") && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select Invoice File</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drop zone */}
              <div
                ref={dropRef}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors cursor-pointer ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : file
                      ? "border-green-400 bg-green-50 dark:bg-green-950/20"
                      : "border-muted-foreground/30 hover:border-primary/50"
                }`}
                onClick={() =>
                  document.getElementById("invoice-file-input")?.click()
                }
              >
                <input
                  id="invoice-file-input"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={(e) =>
                    handleFileSelect(e.target.files?.[0] ?? null)
                  }
                />
                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="h-8 w-8 text-green-600" />
                    <div className="text-left">
                      <p className="font-medium text-sm">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatSize(file.size)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setStep("upload");
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-sm font-medium">
                      Drop invoice here or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, JPEG, PNG, WebP · Max 20 MB
                    </p>
                  </>
                )}
              </div>

              {parseError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded p-3">
                  <XCircle className="h-4 w-4 shrink-0" />
                  {parseError}
                </div>
              )}

              <Button
                className="w-full"
                disabled={!file || step === "parsing"}
                onClick={handleParse}
              >
                {step === "parsing" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Extracting invoice data...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Extract & Review
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Step 2: Review ───────────────────────────────────────── */}
        {step === "review" && parsedData && (
          <>
            {/* Invoice metadata */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Invoice Details</CardTitle>
                  <Badge variant="outline" className="gap-1">
                    {confidenceBadge(parsedData.overall_confidence)}
                    <span className="text-xs ml-1">
                      {Math.round(parsedData.overall_confidence * 100)}%
                      confidence
                    </span>
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="supplier">Supplier</Label>
                    <Select
                      value={selectedSupplierId}
                      onValueChange={setSelectedSupplierId}
                    >
                      <SelectTrigger id="supplier">
                        <SelectValue placeholder="Select supplier..." />
                      </SelectTrigger>
                      <SelectContent>
                        {venueSuppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {parsedData.supplier_name && (
                      <p className="text-xs text-muted-foreground">
                        Extracted: {parsedData.supplier_name}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="inv-num">Invoice Number</Label>
                    <Input
                      id="inv-num"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="e.g. INV-12345"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="inv-date">Invoice Date</Label>
                    <Input
                      id="inv-date"
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Total Amount</Label>
                    <div className="h-10 flex items-center px-3 border rounded-md bg-muted/30 text-sm font-medium">
                      {parsedData.total_amount != null
                        ? formatCurrency(parsedData.total_amount * 100)
                        : "—"}
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-1">
                  <Label htmlFor="notes">Notes</Label>
                  <Input
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional notes..."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Line items review */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Line Items
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({reviewLines.length} extracted)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>Confidence</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead>Unit Price</TableHead>
                        <TableHead>Line Total</TableHead>
                        <TableHead>Map to Ingredient</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reviewLines.map((line) => {
                        const isLowConf = (line.confidence_score ?? 0) < 0.5;
                        return (
                          <TableRow
                            key={line.id}
                            className={
                              isLowConf
                                ? "bg-amber-50/50 dark:bg-amber-950/20"
                                : ""
                            }
                          >
                            <TableCell className="max-w-[200px]">
                              <p
                                className="text-sm truncate"
                                title={line.raw_description}
                              >
                                {line.raw_description}
                              </p>
                            </TableCell>
                            <TableCell>
                              {confidenceBadge(line.confidence_score ?? 0)}
                            </TableCell>
                            <TableCell>
                              <Input
                                className={`w-20 h-8 text-sm ${isLowConf ? "border-amber-400" : ""}`}
                                value={line.editedQuantity}
                                onChange={(e) =>
                                  updateLine(line.id, {
                                    editedQuantity: e.target.value,
                                  })
                                }
                                placeholder="—"
                              />
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {line.extracted_unit ?? "—"}
                            </TableCell>
                            <TableCell>
                              <Input
                                className={`w-24 h-8 text-sm ${isLowConf ? "border-amber-400" : ""}`}
                                value={line.editedUnitPrice}
                                onChange={(e) =>
                                  updateLine(line.id, {
                                    editedUnitPrice: e.target.value,
                                  })
                                }
                                placeholder="—"
                              />
                            </TableCell>
                            <TableCell className="text-sm">
                              {line.extracted_line_total != null
                                ? formatCurrency(
                                    line.extracted_line_total * 100,
                                  )
                                : "—"}
                            </TableCell>
                            <TableCell className="min-w-[180px]">
                              <Select
                                value={line.editedIngredientId}
                                onValueChange={(v) =>
                                  updateLine(line.id, { editedIngredientId: v })
                                }
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Select or create..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="">
                                    — Unmatched —
                                  </SelectItem>
                                  {/* Show top candidates first */}
                                  {line.matchResult.candidates.map((c) => (
                                    <SelectItem
                                      key={c.ingredient.id}
                                      value={c.ingredient.id}
                                    >
                                      {c.ingredient.name}
                                      {c.score >= 0.85 && " ✓"}
                                    </SelectItem>
                                  ))}
                                  {/* Then remaining ingredients not in candidates */}
                                  {ingredients
                                    .filter(
                                      (i) =>
                                        !line.matchResult.candidates.find(
                                          (c) => c.ingredient.id === i.id,
                                        ),
                                    )
                                    .map((i) => (
                                      <SelectItem key={i.id} value={i.id}>
                                        {i.name}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                              {!line.editedIngredientId && (
                                <div className="mt-1 flex items-center gap-1">
                                  <PlusCircle className="h-3 w-3 text-muted-foreground" />
                                  <Input
                                    className="h-6 text-xs"
                                    placeholder="Or create new..."
                                    value={line.editedIngredientName}
                                    onChange={(e) =>
                                      updateLine(line.id, {
                                        editedIngredientName: e.target.value,
                                      })
                                    }
                                  />
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Duplicate warning */}
            {checkDuplicate() && (
              <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-lg p-3">
                <AlertTriangle className="h-4 w-4 shrink-0" />A invoice with
                number <strong>{invoiceNumber}</strong> already exists for this
                supplier. Saving will mark it as a duplicate.
              </div>
            )}

            {/* Totals summary */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="space-y-1 text-muted-foreground">
                    <p>
                      Subtotal:{" "}
                      {parsedData.subtotal != null
                        ? formatCurrency(parsedData.subtotal * 100)
                        : "—"}
                    </p>
                    <p>
                      Tax (GST):{" "}
                      {parsedData.tax_amount != null
                        ? formatCurrency(parsedData.tax_amount * 100)
                        : "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold">
                      {parsedData.total_amount != null
                        ? formatCurrency(parsedData.total_amount * 100)
                        : "—"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setStep("upload");
                  setFile(null);
                  setParsedData(null);
                }}
              >
                Start Over
              </Button>
              <Button onClick={handleSave}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirm &amp; Save
              </Button>
            </div>
          </>
        )}

        {step === "saving" && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
            <Loader2 className="h-10 w-10 animate-spin" />
            <p className="text-sm">Saving invoice...</p>
          </div>
        )}
      </div>

      {/* Duplicate invoice confirmation dialog */}
      <AlertDialog
        open={showDuplicateDialog}
        onOpenChange={setShowDuplicateDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate Invoice Detected</AlertDialogTitle>
            <AlertDialogDescription>
              An invoice with number &ldquo;{invoiceNumber}&rdquo; from this
              supplier already exists. Would you like to save this as a
              duplicate?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowDuplicateDialog(false);
                performSave(true);
              }}
            >
              Save as Duplicate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
