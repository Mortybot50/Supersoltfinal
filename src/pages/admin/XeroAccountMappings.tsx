/**
 * XeroAccountMappings — standalone page for Xero account mapping.
 * Accessible at /admin/integrations/xero/mappings
 */
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { PageShell, PageToolbar } from '@/components/shared'
import XeroSettings from './XeroSettings'

export default function XeroAccountMappings() {
  const navigate = useNavigate()
  return (
    <PageShell toolbar={<PageToolbar title="Xero — Account Mapping" />}>
      <div className="p-4 md:p-6 space-y-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/integrations')}>
          ← Back to Integrations
        </Button>
        <XeroSettings />
      </div>
    </PageShell>
  )
}
