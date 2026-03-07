"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { queryClient, apiRequest } from "@/lib/queryClient"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Upload, FileText, AlertCircle, CheckCircle2 } from "lucide-react"

export default function SalesImportPage() {
  const { toast } = useToast()
  const [csvText, setCsvText] = useState("")
  const [columnMapping, setColumnMapping] = useState({
    date: "Date",
    menuItem: "Menu Item",
    quantity: "Quantity",
  })
  const [importResult, setImportResult] = useState<{
    success: boolean
    imported: number
    errors?: string[]
    created?: any[]
  } | null>(null)

  const importCSVMutation = useMutation({
    mutationFn: (data: { csvData: string; columnMapping: any }) =>
      apiRequest("POST", "/api/sales/import/csv", data),
    onSuccess: (response: any) => {
      const data = response.json ? response.json() : response
      setImportResult(data)
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] })
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] })
      
      if (data.errors && data.errors.length > 0) {
        toast({
          title: "Import completed with warnings",
          description: `Imported ${data.imported} records, ${data.errors.length} errors`,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Import successful",
          description: `Successfully imported ${data.imported} sales records`,
        })
        setCsvText("")
      }
    },
    onError: (error: any) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const importOCRMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData()
      formData.append("file", file)
      return apiRequest("POST", "/api/sales/import/ocr", formData)
    },
    onSuccess: () => {
      toast({
        title: "OCR not yet implemented",
        description: "Please use CSV upload for now",
        variant: "destructive",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleCSVImport = () => {
    if (!csvText.trim()) {
      toast({
        title: "No data to import",
        description: "Please paste or upload CSV data",
        variant: "destructive",
      })
      return
    }

    importCSVMutation.mutate({
      csvData: csvText,
      columnMapping,
    })
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setCsvText(text)
    }
    reader.readAsText(file)
  }

  const handleOCRUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    importOCRMutation.mutate(file)
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Import Sales Data</h1>
        <p className="text-muted-foreground">
          Import historical sales data via CSV or OCR
        </p>
      </div>

      <Tabs defaultValue="csv" className="space-y-6">
        <TabsList>
          <TabsTrigger value="csv" data-testid="tab-csv">
            <FileText className="h-4 w-4 mr-2" />
            CSV Upload
          </TabsTrigger>
          <TabsTrigger value="ocr" data-testid="tab-ocr">
            <Upload className="h-4 w-4 mr-2" />
            OCR (Beta)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="csv" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload CSV File</CardTitle>
              <CardDescription>
                Upload a CSV file with sales data. Expected format: Date, Menu Item, Quantity
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="csv-file">Select CSV File</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  data-testid="input-csv-file"
                />
              </div>

              <div>
                <Label htmlFor="csv-text">Or Paste CSV Data</Label>
                <Textarea
                  id="csv-text"
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder="Date,Menu Item,Quantity&#10;2025-01-15,Fish & Chips,12&#10;2025-01-15,Burger,8"
                  rows={10}
                  data-testid="textarea-csv"
                />
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  CSV must have headers in the first row. Make sure your column names match the mapping below.
                </AlertDescription>
              </Alert>

              <div className="border rounded-lg p-4 space-y-4">
                <Label>Column Mapping</Label>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="col-date" className="text-sm text-muted-foreground">
                      Date Column
                    </Label>
                    <Input
                      id="col-date"
                      value={columnMapping.date}
                      onChange={(e) => setColumnMapping({ ...columnMapping, date: e.target.value })}
                      placeholder="Date"
                      data-testid="input-col-date"
                    />
                  </div>
                  <div>
                    <Label htmlFor="col-menuitem" className="text-sm text-muted-foreground">
                      Menu Item Column
                    </Label>
                    <Input
                      id="col-menuitem"
                      value={columnMapping.menuItem}
                      onChange={(e) => setColumnMapping({ ...columnMapping, menuItem: e.target.value })}
                      placeholder="Menu Item"
                      data-testid="input-col-menuitem"
                    />
                  </div>
                  <div>
                    <Label htmlFor="col-quantity" className="text-sm text-muted-foreground">
                      Quantity Column
                    </Label>
                    <Input
                      id="col-quantity"
                      value={columnMapping.quantity}
                      onChange={(e) => setColumnMapping({ ...columnMapping, quantity: e.target.value })}
                      placeholder="Quantity"
                      data-testid="input-col-quantity"
                    />
                  </div>
                </div>
              </div>

              <Button
                onClick={handleCSVImport}
                disabled={!csvText.trim() || importCSVMutation.isPending}
                className="w-full"
                data-testid="button-import-csv"
              >
                {importCSVMutation.isPending ? "Importing..." : "Import CSV Data"}
              </Button>
            </CardContent>
          </Card>

          {importResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {importResult.success ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      Import Results
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-5 w-5 text-destructive" />
                      Import Results
                    </>
                  )}
                </CardTitle>
                <CardDescription>
                  {importResult.imported} records imported
                  {importResult.errors && importResult.errors.length > 0 && `, ${importResult.errors.length} errors`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {importResult.errors && importResult.errors.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-destructive">Errors</Label>
                    <div className="space-y-1">
                      {importResult.errors.map((error, idx) => (
                        <Alert key={idx} variant="destructive">
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </div>
                )}

                {importResult.created && importResult.created.length > 0 && (
                  <div className="space-y-2">
                    <Label>Imported Records ({importResult.created.length})</Label>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Menu Item ID</TableHead>
                          <TableHead>Quantity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importResult.created && importResult.created.slice(0, 10).map((record, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{record.saleDate}</TableCell>
                            <TableCell className="font-mono text-xs">{record.menuItemId}</TableCell>
                            <TableCell>{record.quantitySold}</TableCell>
                          </TableRow>
                        ))}
                        {importResult.created && importResult.created.length > 10 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground">
                              ... and {importResult.created.length - 10} more records
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="ocr">
          <Card>
            <CardHeader>
              <CardTitle>OCR Import (Beta)</CardTitle>
              <CardDescription>
                Extract sales data from images or PDFs using OCR
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-semibold">OCR functionality is coming soon</p>
                    <p>Please use the CSV upload tab for now to import your sales data.</p>
                  </div>
                </AlertDescription>
              </Alert>

              <div>
                <Label htmlFor="ocr-file">Select Image or PDF</Label>
                <Input
                  id="ocr-file"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleOCRUpload}
                  disabled
                  data-testid="input-ocr-file"
                />
              </div>

              <Button disabled className="w-full" data-testid="button-import-ocr">
                <Upload className="h-4 w-4 mr-2" />
                Process with OCR (Coming Soon)
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
