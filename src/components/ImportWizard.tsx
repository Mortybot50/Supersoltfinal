import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, Download, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { processImport } from '@/lib/services/importProcessor'
import { downloadTemplate } from '@/lib/utils/excelImport'
import { importMappings } from '@/lib/config/importMappings'
import { z } from 'zod'
import { useToast } from '@/hooks/use-toast'

interface ImportWizardProps {
  entityType: string
  entityLabel: string
  validationSchema: z.ZodSchema<any>
  onImportComplete: (data: any[]) => void
}

export function ImportWizard({ 
  entityType, 
  entityLabel, 
  validationSchema,
  onImportComplete 
}: ImportWizardProps) {
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [step, setStep] = useState<'upload' | 'preview' | 'complete'>('upload')
  const { toast } = useToast()
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0])
      setResult(null)
      setStep('upload')
    }
  }
  
  const handleImport = async () => {
    if (!file) return
    
    setImporting(true)
    try {
      const importResult = await processImport(file, entityType, validationSchema)
      setResult(importResult)
      setStep('preview')
      
      if (importResult.success) {
        toast({
          title: "File processed successfully",
          description: `${importResult.validRows} records ready to import`,
        })
      }
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setImporting(false)
    }
  }
  
  const handleConfirm = () => {
    if (result?.data) {
      onImportComplete(result.data)
      setStep('complete')
      toast({
        title: "Import complete!",
        description: `Successfully imported ${result.validRows} ${entityLabel.toLowerCase()}`,
      })
    }
  }
  
  const handleDownloadTemplate = () => {
    const mappings = importMappings[entityType]
    downloadTemplate(entityType, mappings)
    toast({
      title: "Template downloaded",
      description: `Check your downloads folder for ${entityType}-import-template.xlsx`,
    })
  }
  
  return (
    <div className="space-y-6">
      {/* Step 1: Upload */}
      {step === 'upload' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Import {entityLabel}</h3>
          
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center border-border">
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              
              {!file ? (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload an Excel (.xlsx, .xls) or CSV file
                  </p>
                  <label>
                    <Button variant="outline">
                      Choose File
                    </Button>
                    <input 
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </label>
                </>
              ) : (
                <>
                  <p className="font-medium mb-2">{file.name}</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button onClick={handleImport} disabled={importing}>
                      {importing ? 'Processing...' : 'Process File'}
                    </Button>
                    <label>
                      <Button variant="outline">
                        Change File
                      </Button>
                      <input 
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                    </label>
                  </div>
                </>
              )}
            </div>
            
            <Alert>
              <Download className="h-4 w-4" />
              <AlertDescription>
                Don't have a file yet? 
                <Button 
                  variant="link" 
                  className="px-1 h-auto"
                  onClick={handleDownloadTemplate}
                >
                  Download template
                </Button>
                with the correct format.
              </AlertDescription>
            </Alert>
          </div>
        </Card>
      )}
      
      {/* Step 2: Preview & Validate */}
      {step === 'preview' && result && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Import Preview</h3>
          
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className="p-4">
              <div className="text-2xl font-bold">{result.totalRows}</div>
              <div className="text-sm text-muted-foreground">Total Rows</div>
            </Card>
            <Card className="p-4 border-green-600">
              <div className="text-2xl font-bold text-green-600">{result.validRows}</div>
              <div className="text-sm text-muted-foreground">Valid</div>
            </Card>
            <Card className="p-4 border-red-600">
              <div className="text-2xl font-bold text-red-600">{result.invalidRows}</div>
              <div className="text-sm text-muted-foreground">Invalid</div>
            </Card>
          </div>
          
          {/* Errors */}
          {result.errors.length > 0 && (
            <div className="mb-6">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-600" />
                Errors ({result.errors.length})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {result.errors.slice(0, 10).map((error: any, idx: number) => (
                  <Alert key={idx} variant="destructive">
                    <AlertDescription>
                      <strong>Row {error.row}:</strong> {error.field} - {error.message}
                    </AlertDescription>
                  </Alert>
                ))}
                {result.errors.length > 10 && (
                  <p className="text-sm text-muted-foreground">
                    ... and {result.errors.length - 10} more errors
                  </p>
                )}
              </div>
            </div>
          )}
          
          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="mb-6">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                Warnings ({result.warnings.length})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {result.warnings.map((warning: any, idx: number) => (
                  <Alert key={idx}>
                    <AlertDescription>
                      <strong>Row {warning.row}:</strong> {warning.field} - {warning.message}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </div>
          )}
          
          {/* Actions */}
          <div className="flex gap-2">
            {result.validRows > 0 && (
              <Button onClick={handleConfirm}>
                Import {result.validRows} Record{result.validRows !== 1 ? 's' : ''}
              </Button>
            )}
            <Button variant="outline" onClick={() => setStep('upload')}>
              Cancel
            </Button>
          </div>
        </Card>
      )}
      
      {/* Step 3: Complete */}
      {step === 'complete' && (
        <Card className="p-6 text-center">
          <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-600" />
          <h3 className="text-xl font-semibold mb-2">Import Complete!</h3>
          <p className="text-muted-foreground mb-4">
            Successfully imported {result?.validRows} {entityLabel.toLowerCase()}
          </p>
          <Button onClick={() => {
            setFile(null)
            setResult(null)
            setStep('upload')
          }}>
            Import More
          </Button>
        </Card>
      )}
    </div>
  )
}
