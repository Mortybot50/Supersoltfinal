"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Download, Upload, AlertCircle, CheckCircle2, XCircle, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ImportType = "sales" | "ingredients" | "menu" | "staff";

interface ImportError {
  row: number;
  message: string;
}

interface ImportResult {
  inserted?: number;
  updated?: number;
  skipped?: number;
  total: number;
  errors?: ImportError[];
  menuItems?: { inserted: number; updated: number };
  recipes?: { inserted: number; updated: number };
  ingredients?: { inserted: number; updated: number };
  supplierItems?: { inserted: number; updated: number };
}

const IMPORT_TYPES = [
  {
    id: "sales" as const,
    label: "Sales Data",
    description: "Import daily sales data",
    templatePath: "/templates/sales_import.csv",
    endpoint: "/api/import/sales",
  },
  {
    id: "ingredients" as const,
    label: "Ingredients",
    description: "Import ingredients and suppliers",
    templatePath: "/templates/ingredients_import.csv",
    endpoint: "/api/import/ingredients",
  },
  {
    id: "menu" as const,
    label: "Menu Items",
    description: "Import menu items and recipes",
    templatePath: "/templates/menu_import.csv",
    endpoint: "/api/import/menu",
  },
  {
    id: "staff" as const,
    label: "Staff",
    description: "Import staff members",
    templatePath: "/templates/staff_import.csv",
    endpoint: "/api/import/staff",
  },
];

function ImportTab({ type }: { type: typeof IMPORT_TYPES[number] }) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const importMutation = useMutation({
    mutationFn: async (csvText: string) => {
      const response = await fetch(type.endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: csvText,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Import failed");
      }

      return response.json() as Promise<ImportResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      
      // Invalidate relevant queries
      if (type.id === "sales") {
        queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
        queryClient.invalidateQueries({ queryKey: ["/api/forecast"] });
      } else if (type.id === "ingredients") {
        queryClient.invalidateQueries({ queryKey: ["/api/ingredients"] });
        queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      } else if (type.id === "menu") {
        queryClient.invalidateQueries({ queryKey: ["/api/menu-items"] });
        queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      } else if (type.id === "staff") {
        queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      }

      toast({
        title: "Import completed",
        description: `Successfully processed ${data.total} rows`,
      });
    },
    onError: (error) => {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (selectedFile: File | null) => {
    setFile(selectedFile);
    setResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith(".csv")) {
      handleFileChange(droppedFile);
    } else {
      toast({
        title: "Invalid file",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const csvText = e.target?.result as string;
      importMutation.mutate(csvText);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Upload CSV File</CardTitle>
          <CardDescription>{type.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              asChild
              data-testid="button-download-template"
            >
              <a href={type.templatePath} download>
                <Download className="w-4 h-4 mr-2" />
                Download Template
              </a>
            </Button>
          </div>

          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging ? "border-primary bg-accent/50" : "border-border"
            }`}
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            data-testid="dropzone-upload"
          >
            {file ? (
              <div className="space-y-2">
                <FileSpreadsheet className="w-12 h-12 mx-auto text-primary" />
                <p className="text-sm font-medium" data-testid="text-filename">
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleFileChange(null)}
                  data-testid="button-clear-file"
                >
                  Clear
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drag and drop your CSV file here, or
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = ".csv";
                    input.onchange = (e) => {
                      const target = e.target as HTMLInputElement;
                      handleFileChange(target.files?.[0] || null);
                    };
                    input.click();
                  }}
                  data-testid="button-browse-file"
                >
                  Browse Files
                </Button>
              </div>
            )}
          </div>

          {file && (
            <div className="flex justify-end">
              <Button
                onClick={handleUpload}
                disabled={importMutation.isPending}
                data-testid="button-upload-csv"
              >
                {importMutation.isPending ? "Importing..." : "Import CSV"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Import Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {result.inserted !== undefined && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Inserted</p>
                  <p className="text-2xl font-bold text-green-600" data-testid="text-inserted">
                    {result.inserted}
                  </p>
                </div>
              )}
              {result.updated !== undefined && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Updated</p>
                  <p className="text-2xl font-bold text-blue-600" data-testid="text-updated">
                    {result.updated}
                  </p>
                </div>
              )}
              {result.skipped !== undefined && result.skipped > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Skipped</p>
                  <p className="text-2xl font-bold text-yellow-600" data-testid="text-skipped">
                    {result.skipped}
                  </p>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-bold" data-testid="text-total">
                  {result.total}
                </p>
              </div>
            </div>

            {/* Special formatting for nested results (menu, ingredients) */}
            {result.menuItems && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">Menu Items</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Inserted</p>
                    <p className="text-lg font-bold text-green-600">{result.menuItems.inserted}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Updated</p>
                    <p className="text-lg font-bold text-blue-600">{result.menuItems.updated}</p>
                  </div>
                </div>
              </div>
            )}

            {result.recipes && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">Recipes</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Inserted</p>
                    <p className="text-lg font-bold text-green-600">{result.recipes.inserted}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Updated</p>
                    <p className="text-lg font-bold text-blue-600">{result.recipes.updated}</p>
                  </div>
                </div>
              </div>
            )}

            {result.ingredients && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">Ingredients</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Inserted</p>
                    <p className="text-lg font-bold text-green-600">{result.ingredients.inserted}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Updated</p>
                    <p className="text-lg font-bold text-blue-600">{result.ingredients.updated}</p>
                  </div>
                </div>
              </div>
            )}

            {result.supplierItems && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">Supplier Items</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Inserted</p>
                    <p className="text-lg font-bold text-green-600">{result.supplierItems.inserted}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Updated</p>
                    <p className="text-lg font-bold text-blue-600">{result.supplierItems.updated}</p>
                  </div>
                </div>
              </div>
            )}

            {result.errors && result.errors.length > 0 && (
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <p className="text-sm font-medium">
                    Errors ({result.errors.length})
                  </p>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {result.errors.map((error, idx) => (
                    <Alert key={idx} variant="destructive">
                      <AlertDescription>
                        <span className="font-medium">Row {error.row}:</span> {error.message}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}

            {result.errors && result.errors.length === 0 && (
              <Alert>
                <CheckCircle2 className="w-4 h-4" />
                <AlertDescription>
                  All rows processed successfully with no errors!
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ImportsPage() {
  const [activeTab, setActiveTab] = useState<ImportType>("sales");

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">CSV Import Center</h1>
        <p className="text-muted-foreground mt-1">
          Bulk import data from CSV files to quickly onboard vendors and populate your database
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ImportType)}>
        <TabsList className="grid w-full grid-cols-4" data-testid="tabs-import-types">
          {IMPORT_TYPES.map((type) => (
            <TabsTrigger
              key={type.id}
              value={type.id}
              data-testid={`tab-${type.id}`}
            >
              {type.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {IMPORT_TYPES.map((type) => (
          <TabsContent key={type.id} value={type.id}>
            <ImportTab type={type} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
