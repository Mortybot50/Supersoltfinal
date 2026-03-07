"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, Check, XCircle, Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ImportType = "ingredients" | "menu_items" | "recipes" | "staff" | "sales" | "stock";
type Step = "upload" | "map" | "validate" | "done";

const IMPORT_TYPES: Array<{ value: ImportType; label: string; description: string }> = [
  { value: "ingredients", label: "Ingredients", description: "Import ingredients with supplier info" },
  { value: "menu_items", label: "Menu Items", description: "Import menu items with prices" },
  { value: "recipes", label: "Recipes", description: "Import recipe lines for menu items" },
  { value: "staff", label: "Staff", description: "Import staff members with rates" },
  { value: "sales", label: "Sales History", description: "Import historical sales data" },
  { value: "stock", label: "Stock On Hand", description: "Import current stock levels" },
];

const CANONICAL_FIELDS: Record<ImportType, Array<{ field: string; label: string; required: boolean }>> = {
  ingredients: [
    { field: "name", label: "Ingredient Name", required: true },
    { field: "purchase_unit", label: "Purchase Unit (g/kg/ml/l/each)", required: true },
    { field: "preferred_supplier", label: "Supplier Name", required: false },
    { field: "supplier_sku", label: "Supplier SKU", required: false },
    { field: "pack_size", label: "Pack Size (number)", required: false },
    { field: "pack_unit", label: "Pack Unit", required: false },
    { field: "pack_cost", label: "Pack Cost ($ or ¢)", required: false },
  ],
  menu_items: [
    { field: "name", label: "Menu Item Name", required: true },
    { field: "price", label: "Price ($ or ¢)", required: true },
    { field: "tax", label: "Tax Amount", required: false },
  ],
  recipes: [
    { field: "menu_item_name", label: "Menu Item Name", required: false },
    { field: "menu_item_id", label: "Menu Item ID", required: false },
    { field: "ingredient_name", label: "Ingredient Name", required: false },
    { field: "ingredient_id", label: "Ingredient ID", required: false },
    { field: "qty", label: "Quantity", required: true },
    { field: "unit", label: "Unit", required: true },
    { field: "yield_pct", label: "Yield %", required: false },
    { field: "wastage_pct", label: "Wastage %", required: false },
  ],
  staff: [
    { field: "name", label: "Staff Name", required: true },
    { field: "email", label: "Email", required: true },
    { field: "role", label: "Role (FOH/BOH/Bar/Manager)", required: true },
    { field: "hourly_rate", label: "Hourly Rate ($ or ¢)", required: true },
  ],
  sales: [
    { field: "date", label: "Date (YYYY-MM-DD)", required: true },
    { field: "menu_item_name", label: "Menu Item Name", required: false },
    { field: "menu_item_id", label: "Menu Item ID", required: false },
    { field: "qty", label: "Quantity Sold", required: true },
    { field: "unit_price", label: "Unit Price ($ or ¢)", required: false },
  ],
  stock: [
    { field: "ingredient_name", label: "Ingredient Name", required: false },
    { field: "ingredient_id", label: "Ingredient ID", required: false },
    { field: "qty", label: "Quantity", required: true },
    { field: "unit", label: "Unit", required: true },
  ],
};

export default function ImportsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("upload");
  const [type, setType] = useState<ImportType | null>(null);
  const [csvText, setCsvText] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sample, setSample] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [validationResult, setValidationResult] = useState<any>(null);
  const [commitResult, setCommitResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    setCsvText(text);
  };

  const handleDownloadTemplate = async () => {
    if (!type) return;

    try {
      const response = await fetch(`/api/imports/templates?type=${type}`);
      if (!response.ok) throw new Error("Failed to download template");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}_template.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Download failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpload = async () => {
    if (!type || !csvText) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/imports/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          filename: `import_${type}_${Date.now()}.csv`,
          text: csvText,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }

      const data = await response.json();
      setJobId(data.jobId);
      setHeaders(data.headers);
      setSample(data.sample);
      setStep("map");

      toast({
        title: "Upload successful",
        description: `${data.totalRows} rows uploaded`,
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveMapping = async () => {
    if (!jobId || !type) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/imports/${jobId}/mapping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapping }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Mapping failed");
      }

      const data = await response.json();
      setValidationResult(data);
      
      if (data.status === "ready") {
        setStep("validate");
      }

      toast({
        title: data.status === "ready" ? "Validation successful" : "Validation errors found",
        description: `${data.errorsCount} errors found`,
        variant: data.status === "ready" ? "default" : "destructive",
      });
    } catch (error: any) {
      toast({
        title: "Mapping failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!jobId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/imports/${jobId}/commit`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Import failed");
      }

      const data = await response.json();
      setCommitResult(data);
      setStep("done");

      toast({
        title: "Import complete",
        description: `Created: ${data.created}, Updated: ${data.updated}`,
      });
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fields = type ? CANONICAL_FIELDS[type] : [];

  return (
    <div className="container mx-auto p-6 max-w-6xl" data-testid="page-imports">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Data Import Wizard</h1>
        <p className="text-muted-foreground mt-2">
          Upload CSV files to bulk-import ingredients, menu items, recipes, staff, sales, or stock data
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        {["upload", "map", "validate", "done"].map((s, idx) => (
          <div key={s} className="flex items-center gap-2">
            <Badge variant={step === s ? "default" : "secondary"} data-testid={`step-${s}`}>
              {idx + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
            </Badge>
            {idx < 3 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Upload CSV</CardTitle>
            <CardDescription>Select import type and upload your CSV file</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Import Type</Label>
              <Select value={type || ""} onValueChange={(v) => setType(v as ImportType)}>
                <SelectTrigger data-testid="select-import-type">
                  <SelectValue placeholder="Select import type..." />
                </SelectTrigger>
                <SelectContent>
                  {IMPORT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <div>
                        <div className="font-medium">{t.label}</div>
                        <div className="text-sm text-muted-foreground">{t.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {type && (
              <>
                <Button
                  variant="outline"
                  onClick={handleDownloadTemplate}
                  data-testid="button-download-template"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>

                <div className="space-y-2">
                  <Label>CSV Content</Label>
                  <Textarea
                    placeholder="Paste CSV content here, or upload a file..."
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    rows={10}
                    data-testid="textarea-csv"
                  />
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="csv-upload"
                  />
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById("csv-upload")?.click()}
                    data-testid="button-upload-file"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload File
                  </Button>
                </div>

                <Button
                  onClick={handleUpload}
                  disabled={isLoading || !csvText}
                  data-testid="button-upload-csv"
                >
                  {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Upload & Parse
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {step === "map" && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Map Columns</CardTitle>
            <CardDescription>Map your CSV headers to the required fields</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field) => (
              <div key={field.field} className="grid grid-cols-2 gap-4 items-center">
                <Label>
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                <Select
                  value={mapping[field.field] || ""}
                  onValueChange={(v) => {
                    if (v === "SKIP") {
                      const newMapping = { ...mapping };
                      delete newMapping[field.field];
                      setMapping(newMapping);
                    } else {
                      setMapping({ ...mapping, [field.field]: v });
                    }
                  }}
                >
                  <SelectTrigger data-testid={`select-${field.field}`}>
                    <SelectValue placeholder="Select column..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SKIP">-- Skip --</SelectItem>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}

            <div className="flex gap-2">
              <Button onClick={() => setStep("upload")} variant="outline">
                Back
              </Button>
              <Button onClick={handleSaveMapping} disabled={isLoading} data-testid="button-save-mapping">
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Validate
              </Button>
            </div>

            {validationResult && validationResult.errorsCount > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Found {validationResult.errorsCount} errors. Please fix them before continuing.
                </AlertDescription>
              </Alert>
            )}

            {validationResult?.preview && validationResult.preview.length > 0 && (
              <div className="mt-4">
                <h3 className="font-medium mb-2">Error Preview (first 30)</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validationResult.preview.map((err: any) => (
                      <TableRow key={err.rowNumber}>
                        <TableCell>{err.rowNumber}</TableCell>
                        <TableCell className="text-destructive">{err.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === "validate" && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Ready to Import</CardTitle>
            <CardDescription>Review and commit your import</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription>
                All rows validated successfully. Ready to import.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button onClick={() => setStep("map")} variant="outline">
                Back
              </Button>
              <Button onClick={handleCommit} disabled={isLoading} data-testid="button-commit">
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Commit Import
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "done" && commitResult && (
        <Card>
          <CardHeader>
            <CardTitle>
              {commitResult.status === "failed" && commitResult.created === 0 && commitResult.updated === 0
                ? "Import Failed"
                : commitResult.errors && commitResult.errors.length > 0
                ? "Import Completed with Errors"
                : "Import Complete!"}
            </CardTitle>
            <CardDescription>
              {commitResult.status === "failed" && commitResult.created === 0 && commitResult.updated === 0
                ? "The import encountered errors and no data was imported"
                : "Your data has been processed"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 border rounded-md">
                <div className="text-2xl font-bold text-green-600">{commitResult.created || 0}</div>
                <div className="text-sm text-muted-foreground">Created</div>
              </div>
              <div className="text-center p-4 border rounded-md">
                <div className="text-2xl font-bold text-blue-600">{commitResult.updated || 0}</div>
                <div className="text-sm text-muted-foreground">Updated</div>
              </div>
              <div className="text-center p-4 border rounded-md">
                <div className="text-2xl font-bold text-gray-600">{commitResult.skipped || 0}</div>
                <div className="text-sm text-muted-foreground">Skipped</div>
              </div>
            </div>

            {commitResult.errors && commitResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {commitResult.errors.length} errors occurred during import
                </AlertDescription>
              </Alert>
            )}

            {commitResult.errors && commitResult.errors.length > 0 && (
              <div className="mt-4">
                <h3 className="font-medium mb-2">Error Details (first 30)</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commitResult.errors.slice(0, 30).map((err: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>{err.row}</TableCell>
                        <TableCell className="text-destructive">{err.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {commitResult.errors.length > 30 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    ... and {commitResult.errors.length - 30} more errors
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Button onClick={() => window.location.reload()} variant="outline">
                Import More Data
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
