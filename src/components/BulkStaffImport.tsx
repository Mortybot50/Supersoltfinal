/**
 * BulkStaffImport — modal for importing staff from CSV.
 * Parses CSV, shows preview, and creates staff via API.
 */
import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Upload, Download, Loader2, AlertTriangle, Check } from "lucide-react";
import {
  parseStaffCSV,
  generateStaffTemplate,
  downloadCSV,
  type StaffCSVRow,
} from "@/lib/utils/csvImport";
import { createStaffInDB } from "@/lib/services/labourService";
import { useAuth } from "@/contexts/AuthContext";
import type { Staff } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

export function BulkStaffImport({
  open,
  onOpenChange,
  onImportComplete,
}: Props) {
  const { currentOrg, currentVenue } = useAuth();
  const [parsed, setParsed] = useState<StaffCSVRow[]>([]);
  const [errors, setErrors] = useState<{ row: number; message: string }[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{
    success: number;
    failed: number;
  } | null>(null);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        const result = parseStaffCSV(text);
        setParsed(result.data);
        setErrors(result.errors);
        setImportResults(null);
      };
      reader.readAsText(file);
      // Reset input so same file can be selected again
      e.target.value = "";
    },
    [],
  );

  const handleImport = async () => {
    if (!currentOrg?.id || !currentVenue?.id || parsed.length === 0) return;

    setImporting(true);
    setImportProgress(0);
    let success = 0;
    let failed = 0;

    for (let i = 0; i < parsed.length; i++) {
      const row = parsed[i];
      const staffData: Staff = {
        id: "",
        organization_id: currentOrg.id,
        venue_id: currentVenue.id,
        name: `${row.first_name} ${row.last_name}`.trim(),
        email: row.email || "",
        phone: row.phone,
        role: row.role,
        employment_type: row.employment_type.replace(
          "_",
          "-",
        ) as Staff["employment_type"],
        hourly_rate: Math.round(row.base_hourly_rate * 100), // dollars to cents
        award_classification: row.award_classification,
        start_date: row.start_date ? new Date(row.start_date) : new Date(),
        status: "active",
        onboarding_status: "not_started",
        onboarding_progress: 0,
      };

      const result = await createStaffInDB(staffData);
      if (result) {
        success++;
      } else {
        failed++;
      }
      setImportProgress(((i + 1) / parsed.length) * 100);
    }

    setImporting(false);
    setImportResults({ success, failed });

    if (success > 0) {
      toast.success(
        `Imported ${success} staff member${success !== 1 ? "s" : ""}`,
      );
      onImportComplete();
    }
    if (failed > 0) {
      toast.error(
        `${failed} staff member${failed !== 1 ? "s" : ""} failed to import`,
      );
    }
  };

  const handleClose = () => {
    setParsed([]);
    setErrors([]);
    setImportResults(null);
    setImportProgress(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Staff from CSV</DialogTitle>
        </DialogHeader>

        {/* Download template */}
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          <Download className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 text-sm text-muted-foreground">
            Need a template? Download and fill in your staff details.
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadCSV(generateStaffTemplate(), "staff-import-template.csv")
            }
          >
            Download Template
          </Button>
        </div>

        {/* File upload */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-muted transition-colors">
            <Upload className="h-4 w-4" />
            <span className="text-sm">Choose CSV File</span>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
          {parsed.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {parsed.length} staff member{parsed.length !== 1 ? "s" : ""} found
            </span>
          )}
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {errors.length} row{errors.length !== 1 ? "s" : ""} had errors:
              <ul className="mt-1 list-disc list-inside text-xs">
                {errors.slice(0, 5).map((e, i) => (
                  <li key={i}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
                {errors.length > 5 && <li>...and {errors.length - 5} more</li>}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Preview table */}
        {parsed.length > 0 && (
          <div className="rounded-lg border max-h-64 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Award</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsed.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">
                      {row.first_name} {row.last_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.role}</Badge>
                    </TableCell>
                    <TableCell>
                      {row.employment_type.replace("_", " ")}
                    </TableCell>
                    <TableCell>${row.base_hourly_rate.toFixed(2)}/hr</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.award_classification || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Import progress */}
        {importing && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Importing... {Math.round(importProgress)}%
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-brand transition-all"
                style={{ width: `${importProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Results */}
        {importResults && (
          <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg text-sm">
            <Check className="h-4 w-4 text-green-600" />
            <span>
              {importResults.success} imported successfully
              {importResults.failed > 0 && `, ${importResults.failed} failed`}
            </span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {importResults ? "Close" : "Cancel"}
          </Button>
          {parsed.length > 0 && !importResults && (
            <Button
              onClick={handleImport}
              disabled={importing}
              className="bg-brand hover:bg-brand-500 text-gray-900 font-semibold"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>Import {parsed.length} Staff</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
