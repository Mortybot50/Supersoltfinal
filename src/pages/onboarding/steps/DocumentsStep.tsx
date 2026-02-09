import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { useDataStore } from '@/lib/store/dataStore'
import { DOCUMENT_TYPES } from '@/lib/constants/onboarding'
import { Upload, FileText, CheckCircle, X } from 'lucide-react'

interface DocumentsStepProps {
  staffId: string
  onComplete: () => void
  onBack?: () => void
}

export default function DocumentsStep({ staffId, onComplete, onBack }: DocumentsStepProps) {
  const { toast } = useToast()
  const { onboardingDocuments, addOnboardingDocument } = useDataStore()
  const [uploading, setUploading] = useState(false)

  const staffDocuments = onboardingDocuments.filter(doc => doc.staff_id === staffId)

  const handleFileUpload = async (docType: string, file: File) => {
    setUploading(true)
    
    // Simulate file upload (in real app, upload to storage service)
    setTimeout(() => {
      const newDoc = {
        id: crypto.randomUUID(),
        staff_id: staffId,
        document_type: docType as 'id_proof' | 'tfn_declaration' | 'super_choice' | 'rsa_rsg' | 'food_safety' | 'first_aid',
        file_name: file.name,
        file_url: URL.createObjectURL(file),
        file_size: file.size,
        mime_type: file.type,
        status: 'pending' as const,
        uploaded_at: new Date(),
        uploaded_by: staffId
      }

      addOnboardingDocument(newDoc)
      setUploading(false)
      
      toast({
        title: 'Document uploaded',
        description: `${file.name} has been uploaded successfully.`
      })
    }, 1000)
  }

  const handleRemoveDocument = (docId: string) => {
    // In real app, remove from store
    toast({
      title: 'Document removed',
      description: 'The document has been removed.'
    })
  }

  const requiredDocsUploaded = DOCUMENT_TYPES.filter(dt => dt.required).every(dt =>
    staffDocuments.some(doc => doc.document_type === dt.value)
  )

  const handleContinue = () => {
    if (!requiredDocsUploaded) {
      toast({
        title: 'Missing Required Documents',
        description: 'Please upload all required documents before continuing.',
        variant: 'destructive'
      })
      return
    }
    onComplete()
  }

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-4">Upload Documents</h2>
      <p className="text-muted-foreground mb-6">
        Please upload the required documents. All files are securely stored and encrypted.
      </p>

      <Alert className="mb-6">
        <AlertDescription>
          <strong>Accepted formats:</strong> PDF, JPG, PNG (Max 10MB per file)
        </AlertDescription>
      </Alert>

      <div className="space-y-6">
        {DOCUMENT_TYPES.map(docType => {
          const existingDoc = staffDocuments.find(doc => doc.document_type === docType.value)
          
          return (
            <div key={docType.value} className="border rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Label className="text-base">{docType.label}</Label>
                    {docType.required && (
                      <Badge variant="destructive" className="text-xs">Required</Badge>
                    )}
                  </div>
                </div>
                
                {existingDoc ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveDocument(existingDoc.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    onClick={() => {
                      const input = document.createElement('input')
                      input.type = 'file'
                      input.accept = 'application/pdf,image/jpeg,image/png'
                      input.onchange = (e: Event) => {
                        const target = e.target as HTMLInputElement
                        const file = target.files?.[0]
                        if (file) handleFileUpload(docType.value, file)
                      }
                      input.click()
                    }}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </Button>
                )}
              </div>
              
              {existingDoc && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                  <FileText className="w-4 h-4" />
                  <span>{existingDoc.file_name}</span>
                  <span>({Math.round(existingDoc.file_size / 1024)}KB)</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex gap-2 pt-6 border-t mt-6">
        {onBack && (
          <Button type="button" variant="outline" onClick={onBack}>
            Back
          </Button>
        )}
        <Button onClick={handleContinue} disabled={!requiredDocsUploaded}>
          Save & Continue
        </Button>
      </div>
    </Card>
  )
}
