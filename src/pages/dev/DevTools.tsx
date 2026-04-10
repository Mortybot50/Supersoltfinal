import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, Sparkles, Trash2, AlertTriangle, CheckCircle } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { seedDemoData } from '@/lib/demo-seed'

export default function DevTools() {
  const { user, currentOrg, session } = useAuth()
  const navigate = useNavigate()
  const [seeding, setSeeding] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    navigate('/dashboard')
    return null
  }

  const handleSeedData = async () => {
    if (!user) return
    
    setSeeding(true)
    setMessage(null)

    try {
      // Use the client-side seed function directly
      const result = await seedDemoData(supabase, user.id)
      
      setMessage({ 
        type: 'success', 
        text: `Demo data seeded! Organization ID: ${result.orgId}` 
      })
      // Refresh page to load new org
      setTimeout(() => window.location.href = '/dashboard', 2000)
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to seed demo data' 
      })
    } finally {
      setSeeding(false)
    }
  }

  const handleResetOrg = async () => {
    if (!currentOrg || !session) return
    
    setResetting(true)
    setMessage(null)

    try {
      const response = await fetch(`/api/dev/reset?orgId=${currentOrg.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ 
          type: 'success', 
          text: 'Organization reset successfully!' 
        })
        // Sign out after reset
        setTimeout(() => {
          supabase.auth.signOut()
          navigate('/login')
        }, 2000)
      } else {
        throw new Error(data.error || 'Failed to reset organization')
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to reset organization' 
      })
    } finally {
      setResetting(false)
    }
  }

  const isDemoOrg = currentOrg?.name?.includes('Bella Vista')

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Developer Tools</h1>
          <p className="text-muted-foreground mt-1">
            Testing utilities for SuperSolt development
          </p>
        </div>
        <Badge variant="outline" className="text-orange-600 border-orange-600">
          DEV MODE
        </Badge>
      </div>

      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription className="flex items-center gap-2">
            {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : null}
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Seed Demo Data
            </CardTitle>
            <CardDescription>
              Create a new demo organization with realistic Australian restaurant data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm space-y-2">
              <p>This will create:</p>
              <ul className="list-disc list-inside text-muted-foreground ml-2">
                <li>Bella Vista Restaurant Group (demo org)</li>
                <li>2 venues (CBD & Docklands)</li>
                <li>5 staff members with AU details</li>
                <li>16 ingredients & 3 suppliers</li>
                <li>10 menu items</li>
                <li>30 days of sales history</li>
              </ul>
            </div>
            <Button 
              onClick={handleSeedData} 
              disabled={seeding}
              className="w-full"
            >
              {seeding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating demo data...
                </>
              ) : (
                'Create Demo Organization'
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Reset Current Organization
            </CardTitle>
            <CardDescription>
              Remove all data from the current organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentOrg ? (
              <>
                <div className="p-3 bg-muted rounded-md space-y-1">
                  <p className="text-sm font-medium">Current Organization</p>
                  <p className="text-sm text-muted-foreground">{currentOrg.name}</p>
                  <p className="text-xs font-mono text-muted-foreground">ID: {currentOrg.id}</p>
                  {isDemoOrg && (
                    <Badge variant="secondary" className="mt-2">
                      Demo Organization
                    </Badge>
                  )}
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      disabled={resetting}
                      className="w-full"
                    >
                      {resetting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Resetting...
                        </>
                      ) : (
                        'Reset Organization'
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete ALL data from {currentOrg.name}, including:
                        venues, staff, sales, inventory, and all other records.
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleResetOrg}>
                        Yes, reset everything
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  No organization selected. Create one first.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Keyboard Shortcuts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-3">
              <kbd className="px-2 py-1 text-xs bg-muted rounded">Cmd/Ctrl</kbd>
              <span>+</span>
              <kbd className="px-2 py-1 text-xs bg-muted rounded">Shift</kbd>
              <span>+</span>
              <kbd className="px-2 py-1 text-xs bg-muted rounded">D</kbd>
              <span className="text-muted-foreground">Open Dev Tools</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}