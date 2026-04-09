import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { AlertTriangle, X } from 'lucide-react'
import { useState } from 'react'

export default function DemoModeBanner() {
  const { currentOrg } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  
  // Only show for demo organizations
  const isDemoOrg = currentOrg?.name?.includes('Bella Vista')
  
  if (!isDemoOrg || dismissed) {
    return null
  }

  const handleExitDemo = async () => {
    if (confirm('This will sign you out. Continue?')) {
      await supabase.auth.signOut()
      window.location.href = '/login'
    }
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="text-sm">
            <span className="font-medium text-amber-900">Demo Mode Active</span>
            <span className="text-amber-700 ml-2">
              You're using a demo organization with sample data
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExitDemo}
            className="text-amber-700 hover:text-amber-900"
          >
            Exit Demo
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDismissed(true)}
            className="text-amber-600 hover:text-amber-800 p-1"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}