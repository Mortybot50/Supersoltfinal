import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Database, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface EmptyStateProps {
  title?: string
  description?: string
  showImportButton?: boolean
}

export function EmptyState({ 
  title = "No Sales Data Available",
  description = "Import sales data to see insights and analytics.",
  showImportButton = true
}: EmptyStateProps) {
  const navigate = useNavigate()
  
  return (
    <Card className="p-12">
      <div className="flex flex-col items-center justify-center text-center space-y-4">
        <div className="rounded-full bg-muted p-4">
          <Database className="h-8 w-8 text-muted-foreground" />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {description}
          </p>
        </div>
        
        {showImportButton && (
          <Button 
            onClick={() => navigate('/data-imports')}
            className="mt-4"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import Sales Data
          </Button>
        )}
      </div>
    </Card>
  )
}
