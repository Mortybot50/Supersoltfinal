import { useState, useRef } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Upload, X, FileText, Image as ImageIcon } from 'lucide-react'
import { useInvoiceIntakeStore } from '@/stores/useInvoiceIntakeStore'
import { toast } from 'sonner'

export function InvoiceUploadDrawer() {
  const { uploadDrawerOpen, isProcessing, uploadInvoice } = useInvoiceIntakeStore()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [venueId, setVenueId] = useState('main')
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
      if (!validTypes.includes(file.type)) {
        toast.error('Invalid file type. Please upload JPG, PNG, or PDF.')
        return
      }
      
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File too large. Maximum size is 10MB.')
        return
      }
      
      setSelectedFile(file)
    }
  }
  
  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file')
      return
    }
    
    try {
      await uploadInvoice(selectedFile, venueId)
      toast.success('Invoice uploaded! Parsing...')
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (error) {
      toast.error('Upload failed.')
    }
  }
  
  const handleClose = () => {
    useInvoiceIntakeStore.setState({ uploadDrawerOpen: false })
    setSelectedFile(null)
  }
  
  return (
    <Sheet open={uploadDrawerOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Upload Invoice</SheetTitle>
          <SheetDescription>
            Upload a photo or PDF of your supplier invoice
          </SheetDescription>
        </SheetHeader>
        
        <div className="space-y-6 py-6">
          <div className="space-y-2">
            <Label>Venue</Label>
            <Select value={venueId} onValueChange={setVenueId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main">Main Venue</SelectItem>
                <SelectItem value="cafe">Café</SelectItem>
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
                    {selectedFile.type.startsWith('image/') ? (
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
                      e.stopPropagation()
                      setSelectedFile(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
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
                    <p className="text-sm text-muted-foreground">JPG, PNG, or PDF (max 10MB)</p>
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
          
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">Tips for best results:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Ensure the invoice is clear and well-lit</li>
              <li>Include all pages if multi-page</li>
              <li>Make sure ABN and line items are visible</li>
            </ul>
          </div>
          
          <div className="flex gap-3">
            <Button onClick={handleUpload} disabled={!selectedFile || isProcessing} className="flex-1">
              {isProcessing ? 'Uploading...' : 'Upload & Parse'}
            </Button>
            <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
