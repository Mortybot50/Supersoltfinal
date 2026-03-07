"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Upload, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { track } from "@/lib/analytics";

interface ImportResult {
  created: number;
  updated: number;
  unchanged: number;
  errors: { row: number; message: string }[];
  totalErrors?: number;
}

interface PreviewData {
  parsed: any[];
  errors: { row: number; message: string }[];
  totalErrors?: number;
}

interface ImportTabProps {
  type: string;
  title: string;
  description: string;
  orgId?: string;
  venueId?: string;
}

function ImportTab({ type, title, description, orgId, venueId }: ImportTabProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isCommitLoading, setIsCommitLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [commitResult, setCommitResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === "text/csv") {
      setFile(droppedFile);
      setPreviewData(null);
      setCommitResult(null);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewData(null);
      setCommitResult(null);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(`/api/import/templates?type=${type}`);
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
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Could not download template",
        variant: "destructive",
      });
    }
  };

  const handlePreview = async () => {
    if (!file) return;

    setIsPreviewLoading(true);
    setPreviewData(null);
    setCommitResult(null);

    try {
      const text = await file.text();
      const response = await fetch(`/api/import/${type}/preview`, {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: text,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Preview failed");
      }

      const data = await response.json();
      setPreviewData(data);
      
      // Track preview event
      track("import_preview", {
        type,
        rows: data.parsed.length,
        errors: data.errors?.length || 0,
      });
      
      toast({
        title: "Preview complete",
        description: `${data.parsed.length} rows ready to import`,
      });
    } catch (error: any) {
      toast({
        title: "Preview failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!previewData || previewData.errors.length > 0) return;

    setIsCommitLoading(true);
    setCommitResult(null);

    try {
      const response = await fetch(`/api/import/${type}/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parsed: previewData.parsed }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Commit failed");
      }

      const result = await response.json();
      setCommitResult(result);
      
      // Track commit event
      track("import_commit", {
        type,
        created: result.created,
        updated: result.updated,
        unchanged: result.unchanged,
        errors: result.errors?.length || 0,
      });
      
      toast({
        title: "Import complete",
        description: `Created: ${result.created}, Updated: ${result.updated}, Unchanged: ${result.unchanged}`,
      });
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCommitLoading(false);
    }
  };

  const hasErrors = previewData && previewData.errors.length > 0;
  const canCommit = previewData && previewData.parsed.length > 0 && !hasErrors;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Button
            variant="outline"
            onClick={handleDownloadTemplate}
            data-testid={`button-download-template-${type}`}
          >
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging ? "border-primary bg-primary/5" : "border-border"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-2">
            Drag and drop your CSV file here, or click to browse
          </p>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
            id={`file-upload-${type}`}
            data-testid={`input-file-${type}`}
          />
          <label htmlFor={`file-upload-${type}`}>
            <Button variant="secondary" asChild>
              <span>Choose File</span>
            </Button>
          </label>
          {file && (
            <p className="text-sm mt-2 text-foreground">
              Selected: <strong>{file.name}</strong>
            </p>
          )}
        </div>

        {file && !previewData && (
          <div className="flex gap-2">
            <Button
              onClick={handlePreview}
              disabled={isPreviewLoading}
              data-testid={`button-preview-${type}`}
            >
              {isPreviewLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Preview Import
            </Button>
          </div>
        )}

        {previewData && (
          <div className="space-y-4">
            <Alert variant={hasErrors ? "destructive" : "default"}>
              {hasErrors ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <AlertDescription>
                {hasErrors ? (
                  <div>
                    <p className="font-semibold">
                      {previewData.errors.length} error{previewData.errors.length !== 1 ? "s" : ""} found
                    </p>
                    <p className="text-sm mt-1">
                      Fix errors in your CSV and upload again
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="font-semibold">
                      Ready to import {previewData.parsed.length} row{previewData.parsed.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                )}
              </AlertDescription>
            </Alert>

            {hasErrors && (
              <div className="max-h-64 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.errors.map((err, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{err.row}</TableCell>
                        <TableCell className="text-sm">{err.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {canCommit && (
              <div className="flex gap-2">
                <Button
                  onClick={handleCommit}
                  disabled={isCommitLoading}
                  data-testid={`button-commit-${type}`}
                >
                  {isCommitLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Commit Import
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setPreviewData(null);
                    setFile(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}

        {commitResult && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <p className="font-semibold">Import completed successfully</p>
                <p className="text-sm">
                  Created: {commitResult.created} | Updated: {commitResult.updated} | Unchanged: {commitResult.unchanged}
                </p>
                {commitResult.errors && commitResult.errors.length > 0 && (
                  <p className="text-sm text-destructive">
                    {commitResult.errors.length} row{commitResult.errors.length !== 1 ? "s" : ""} failed
                  </p>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

export function ImportsClient({ orgId, venueId }: { orgId?: string; venueId?: string }) {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Data Imports</h1>
        <p className="text-muted-foreground mt-2">
          Import CSV files to quickly populate your venue with sales data, ingredients, menu items, staff, and stock levels.
        </p>
      </div>

      <Tabs defaultValue="sales" className="w-full">
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="ingredients">Ingredients</TabsTrigger>
          <TabsTrigger value="menu">Menu</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="mt-6">
          <ImportTab
            type="sales"
            title="Sales Data Import"
            description="Import historical sales data for demand forecasting and analytics"
            orgId={orgId}
            venueId={venueId}
          />
        </TabsContent>

        <TabsContent value="suppliers" className="mt-6">
          <ImportTab
            type="suppliers"
            title="Suppliers Import"
            description="Import supplier contact information and details"
            orgId={orgId}
            venueId={venueId}
          />
        </TabsContent>

        <TabsContent value="ingredients" className="mt-6">
          <ImportTab
            type="ingredients"
            title="Ingredients Import"
            description="Import ingredients with pack sizes, costs, and supplier relationships"
            orgId={orgId}
            venueId={venueId}
          />
        </TabsContent>

        <TabsContent value="menu" className="mt-6">
          <ImportTab
            type="menu"
            title="Menu Items & Recipes Import"
            description="Import menu items with prices and recipes (including nested sub-recipes)"
            orgId={orgId}
            venueId={venueId}
          />
        </TabsContent>

        <TabsContent value="staff" className="mt-6">
          <ImportTab
            type="staff"
            title="Staff Import"
            description="Import staff members with roles and hourly rates"
            orgId={orgId}
            venueId={venueId}
          />
        </TabsContent>

        <TabsContent value="stock" className="mt-6">
          <ImportTab
            type="stock"
            title="Stock on Hand Import"
            description="Update current stock levels for ingredients"
            orgId={orgId}
            venueId={venueId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
