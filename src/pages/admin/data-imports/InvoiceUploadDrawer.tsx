import { useState, useRef, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  X,
  FileText,
  Image as ImageIcon,
  Plus,
  Trash2,
  Link2,
} from "lucide-react";
import { useInvoiceIntakeStore } from "@/stores/useInvoiceIntakeStore";
import { useDataStore } from "@/lib/store/dataStore";
import { toast } from "sonner";
import { GSTMode, InvoiceIntakeJob } from "@/types";

interface ManualLine {
  description: string;
  qty: number;
  unit_price: number; // dollars
}

export function InvoiceUploadDrawer() {
  const { uploadDrawerOpen, isProcessing, uploadInvoice, jobs } =
    useInvoiceIntakeStore();
  const { suppliers, purchaseOrders } = useDataStore();

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [venueId, setVenueId] = useState("main");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"upload" | "manual">("upload");

  // Manual entry state
  const [manualSupplierId, setManualSupplierId] = useState("");
  const [manualInvoiceNum, setManualInvoiceNum] = useState("");
  const [manualInvoiceDate, setManualInvoiceDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [manualGstMode, setManualGstMode] = useState<GSTMode>("INC");
  const [manualPoNumber, setManualPoNumber] = useState("");
  const [manualLines, setManualLines] = useState<ManualLine[]>([
    { description: "", qty: 1, unit_price: 0 },
  ]);

  // Supplier search
  const [supplierSearch, setSupplierSearch] = useState("");
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch) return suppliers.filter((s) => s.active).slice(0, 10);
    const q = supplierSearch.toLowerCase();
    return suppliers
      .filter(
        (s) =>
          s.active && (s.name.toLowerCase().includes(q) || s.abn?.includes(q)),
      )
      .slice(0, 10);
  }, [suppliers, supplierSearch]);

  const selectedSupplier = suppliers.find((s) => s.id === manualSupplierId);

  // POs for selected supplier
  const supplierPOs = useMemo(() => {
    if (!manualSupplierId) return [];
    return purchaseOrders
      .filter(
        (po) =>
          po.supplier_id === manualSupplierId &&
          (po.status === "submitted" || po.status === "confirmed"),
      )
      .slice(0, 20);
  }, [purchaseOrders, manualSupplierId]);

  // Calculate totals
  const manualSubtotal = manualLines.reduce(
    (sum, l) => sum + l.qty * l.unit_price,
    0,
  );
  const manualGst =
    manualGstMode === "NONE"
      ? 0
      : manualGstMode === "INC"
        ? manualSubtotal / 11
        : manualSubtotal * 0.1;
  const manualTotal =
    manualGstMode === "NONE"
      ? manualSubtotal
      : manualGstMode === "INC"
        ? manualSubtotal
        : manualSubtotal + manualGst;

  // Duplicate check
  const isDuplicate = useMemo(() => {
    if (!manualInvoiceNum || !selectedSupplier?.abn) return false;
    const key = `${selectedSupplier.abn}_${manualInvoiceNum}_${manualInvoiceDate}`;
    return jobs.some((j) => j.dedupe_key === key && j.status !== "failed");
  }, [manualInvoiceNum, selectedSupplier, manualInvoiceDate, jobs]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = [
        "image/jpeg",
        "image/png",
        "image/jpg",
        "application/pdf",
      ];
      if (!validTypes.includes(file.type)) {
        toast.error("Invalid file type. Please upload JPG, PNG, or PDF.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File too large. Maximum size is 10MB.");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file");
      return;
    }
    try {
      await uploadInvoice(selectedFile, venueId);
      toast.success("Invoice uploaded! Parsing...");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      toast.error("Upload failed.");
    }
  };

  const handleManualSubmit = async () => {
    if (!manualSupplierId) {
      toast.error("Select a supplier");
      return;
    }
    if (!manualInvoiceNum.trim()) {
      toast.error("Invoice number is required");
      return;
    }
    if (isDuplicate) {
      toast.error(
        "Duplicate invoice — this invoice number already exists for this supplier",
      );
      return;
    }
    const validLines = manualLines.filter(
      (l) => l.description.trim() && l.qty > 0 && l.unit_price > 0,
    );
    if (validLines.length === 0) {
      toast.error("Add at least one line item");
      return;
    }

    // Create a manual job directly (bypassing OCR)
    const supplier = suppliers.find((s) => s.id === manualSupplierId);
    if (!supplier) return;

    const newJob: InvoiceIntakeJob = {
      id: `intake-manual-${Date.now()}`,
      org_id: "DEMO-ORG",
      venue_id: venueId,
      created_by_user_id: "current-user",
      source: "MANUAL" as const,
      status: "needs_review" as const,
      file_url: "",
      original_filename: "manual_entry",
      supplier_confidence: 1,
      totals_confidence: 1,
      header_json: {
        invoice_number: manualInvoiceNum.trim(),
        invoice_date: manualInvoiceDate,
        supplier_name: supplier.name,
        abn: supplier.abn,
        po_number: manualPoNumber || undefined,
        gst_mode: manualGstMode,
        subtotal:
          manualGstMode === "INC" ? manualSubtotal - manualGst : manualSubtotal,
        gst: manualGst,
        total: manualTotal,
      },
      lines_json: validLines.map((l, i) => ({
        line_index: i,
        raw_desc: l.description,
        qty: l.qty,
        unit_price: l.unit_price,
        ext_price: l.qty * l.unit_price,
        confidence: 1,
      })),
      mapping_json: [],
      dedupe_key: `${supplier.abn || supplier.id}_${manualInvoiceNum.trim()}_${manualInvoiceDate}`,
      created_at: new Date(),
      updated_at: new Date(),
    };

    useInvoiceIntakeStore.setState((state) => ({
      jobs: [newJob, ...state.jobs],
      uploadDrawerOpen: false,
    }));

    toast.success("Invoice created — ready for review");
    resetManualForm();
  };

  const resetManualForm = () => {
    setManualSupplierId("");
    setManualInvoiceNum("");
    setManualInvoiceDate(new Date().toISOString().split("T")[0]);
    setManualGstMode("INC");
    setManualPoNumber("");
    setManualLines([{ description: "", qty: 1, unit_price: 0 }]);
    setSupplierSearch("");
  };

  const addLine = () => {
    setManualLines([
      ...manualLines,
      { description: "", qty: 1, unit_price: 0 },
    ]);
  };

  const removeLine = (index: number) => {
    if (manualLines.length <= 1) return;
    setManualLines(manualLines.filter((_, i) => i !== index));
  };

  const updateLine = (
    index: number,
    field: keyof ManualLine,
    value: string | number,
  ) => {
    setManualLines(
      manualLines.map((l, i) => (i === index ? { ...l, [field]: value } : l)),
    );
  };

  const handleClose = () => {
    useInvoiceIntakeStore.setState({ uploadDrawerOpen: false });
    setSelectedFile(null);
  };

  return (
    <Sheet
      open={uploadDrawerOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add Invoice</SheetTitle>
          <SheetDescription>
            Upload a file or enter invoice details manually
          </SheetDescription>
        </SheetHeader>

        <div className="py-4">
          <Tabs
            value={mode}
            onValueChange={(v) => setMode(v as "upload" | "manual")}
          >
            <TabsList className="w-full">
              <TabsTrigger value="upload" className="flex-1">
                Upload File
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex-1">
                Manual Entry
              </TabsTrigger>
            </TabsList>

            {/* FILE UPLOAD TAB */}
            <TabsContent value="upload" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Venue</Label>
                <Select value={venueId} onValueChange={setVenueId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="main">Main Venue</SelectItem>
                    <SelectItem value="cafe">Cafe</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Invoice File</Label>
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {selectedFile ? (
                    <div className="space-y-2">
                      <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        {selectedFile.type.startsWith("image/") ? (
                          <ImageIcon className="h-6 w-6 text-primary" />
                        ) : (
                          <FileText className="h-6 w-6 text-primary" />
                        )}
                      </div>
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                          if (fileInputRef.current)
                            fileInputRef.current.value = "";
                        }}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                        <Upload className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">Click to upload</p>
                        <p className="text-sm text-muted-foreground">
                          JPG, PNG, or PDF (max 10MB)
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              <Button
                onClick={handleUpload}
                disabled={!selectedFile || isProcessing}
                className="w-full"
              >
                {isProcessing ? "Uploading..." : "Upload & Parse"}
              </Button>
            </TabsContent>

            {/* MANUAL ENTRY TAB */}
            <TabsContent value="manual" className="space-y-4 mt-4">
              {/* Supplier */}
              <div className="space-y-2">
                <Label>Supplier *</Label>
                {manualSupplierId && selectedSupplier ? (
                  <div className="flex items-center justify-between bg-muted rounded-md px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">
                        {selectedSupplier.name}
                      </p>
                      {selectedSupplier.abn && (
                        <p className="text-xs text-muted-foreground font-mono">
                          ABN{" "}
                          {selectedSupplier.abn.replace(
                            /(\d{2})(\d{3})(\d{3})(\d{3})/,
                            "$1 $2 $3 $4",
                          )}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setManualSupplierId("")}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Input
                      placeholder="Search supplier by name or ABN..."
                      value={supplierSearch}
                      onChange={(e) => setSupplierSearch(e.target.value)}
                    />
                    {filteredSuppliers.length > 0 && (
                      <div className="border rounded-md max-h-32 overflow-y-auto">
                        {filteredSuppliers.map((s) => (
                          <button
                            key={s.id}
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                            onClick={() => {
                              setManualSupplierId(s.id);
                              setSupplierSearch("");
                            }}
                          >
                            {s.name}
                            {s.abn && (
                              <span className="text-xs text-muted-foreground ml-2">
                                ABN {s.abn}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Invoice # and Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Invoice # *</Label>
                  <Input
                    value={manualInvoiceNum}
                    onChange={(e) => setManualInvoiceNum(e.target.value)}
                    placeholder="INV-001"
                  />
                  {isDuplicate && (
                    <p className="text-xs text-red-500 font-medium">
                      Duplicate invoice detected
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Invoice Date</Label>
                  <Input
                    type="date"
                    value={manualInvoiceDate}
                    onChange={(e) => setManualInvoiceDate(e.target.value)}
                  />
                </div>
              </div>

              {/* GST Mode & PO Match */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>GST</Label>
                  <Select
                    value={manualGstMode}
                    onValueChange={(v) => setManualGstMode(v as GSTMode)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INC">GST Inclusive</SelectItem>
                      <SelectItem value="EX">GST Exclusive</SelectItem>
                      <SelectItem value="NONE">GST Free</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Match to PO</Label>
                  <Select
                    value={manualPoNumber || "_none"}
                    onValueChange={(v) =>
                      setManualPoNumber(v === "_none" ? "" : v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">None</SelectItem>
                      {supplierPOs.map((po) => (
                        <SelectItem key={po.id} value={po.po_number}>
                          {po.po_number} — ${(po.total / 100).toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Line Items</Label>
                  <Button variant="ghost" size="sm" onClick={addLine}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Line
                  </Button>
                </div>

                <div className="space-y-2">
                  {manualLines.map((line, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-[1fr_60px_80px_28px] gap-1.5 items-end"
                    >
                      <div>
                        {idx === 0 && (
                          <Label className="text-[10px] text-muted-foreground">
                            Description
                          </Label>
                        )}
                        <Input
                          value={line.description}
                          onChange={(e) =>
                            updateLine(idx, "description", e.target.value)
                          }
                          placeholder="Item description"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        {idx === 0 && (
                          <Label className="text-[10px] text-muted-foreground">
                            Qty
                          </Label>
                        )}
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={line.qty}
                          onChange={(e) =>
                            updateLine(
                              idx,
                              "qty",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        {idx === 0 && (
                          <Label className="text-[10px] text-muted-foreground">
                            Unit $
                          </Label>
                        )}
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unit_price || ""}
                          onChange={(e) =>
                            updateLine(
                              idx,
                              "unit_price",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="h-8 text-sm"
                          placeholder="0.00"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-7 p-0"
                        onClick={() => removeLine(idx)}
                        disabled={manualLines.length <= 1}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="bg-muted rounded-md p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">
                    $
                    {(manualGstMode === "INC"
                      ? manualSubtotal - manualGst
                      : manualSubtotal
                    ).toFixed(2)}
                  </span>
                </div>
                {manualGstMode !== "NONE" && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">GST</span>
                    <span className="font-medium">${manualGst.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1 font-semibold">
                  <span>Total</span>
                  <span>${manualTotal.toFixed(2)}</span>
                </div>
              </div>

              <Button
                onClick={handleManualSubmit}
                disabled={isProcessing}
                className="w-full"
              >
                {manualPoNumber ? (
                  <>
                    <Link2 className="h-4 w-4 mr-2" />
                    Create & Match to PO
                  </>
                ) : (
                  "Create Invoice"
                )}
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
