import { useState, useEffect } from 'react'
import { Save, Upload, Plus, X, GripVertical, Download, AlertCircle, Calendar, CheckCircle, ImagePlus } from 'lucide-react'
import { PageShell, PageToolbar } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDataStore } from '@/lib/store/dataStore'
import { useAuth } from '@/contexts/AuthContext'
import { AU_STATES, AU_TIMEZONES, FSANZ_ALLERGENS, DEFAULT_CSV_COLUMNS, MenuSection, Organization, OrgBranding, OrgMenuDefaults, OrgApprovals, OrgHolidays, OrgExportMappings, OrgSecurity, validateABN, formatABN, MONTH_NAMES } from '@/types'
import { toast } from 'sonner'

export default function OrgSettings() {
  const { currentOrg } = useAuth()
  const {
    organization,
    branding,
    menuDefaults,
    approvals,
    holidays,
    exportMappings,
    security,
    auditLogs,
    updateOrganization,
    updateBranding,
    updateMenuDefaults,
    updateApprovals,
    updateHolidays,
    updateExportMappings,
    updateSecurity,
    initializeOrgDefaults,
    publishToVenues,
  } = useDataStore()
  
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [activeTab, setActiveTab] = useState('profile')
  const [abnValid, setAbnValid] = useState<boolean | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)

  // Initialize defaults on mount, and sync real org name from auth
  useEffect(() => {
    initializeOrgDefaults()
    if (currentOrg?.name && (!organization?.name || organization.name === 'My Restaurant Group')) {
      updateOrganization({ name: currentOrg.name })
    }
  }, [initializeOrgDefaults, currentOrg])
  
  // Local form state (to track unsaved changes)
  const [formData, setFormData] = useState<{
    organization: Partial<Organization>
    branding: Partial<OrgBranding>
    menuDefaults: Partial<OrgMenuDefaults>
    approvals: Partial<OrgApprovals>
    holidays: Partial<OrgHolidays>
    exportMappings: Partial<OrgExportMappings>
    security: Partial<OrgSecurity>
  }>({
    organization: organization || {},
    branding: branding || {},
    menuDefaults: menuDefaults || {},
    approvals: approvals || {},
    holidays: holidays || {},
    exportMappings: exportMappings || {},
    security: security || {},
  })
  
  // Sync form data when store updates
  useEffect(() => {
    setFormData({
      organization: organization || {},
      branding: branding || {},
      menuDefaults: menuDefaults || {},
      approvals: approvals || {},
      holidays: holidays || {},
      exportMappings: exportMappings || {},
      security: security || {},
    })
  }, [organization, branding, menuDefaults, approvals, holidays, exportMappings, security])
  
  // Detect unsaved changes
  useEffect(() => {
    const hasChanges =
      JSON.stringify(formData.organization) !== JSON.stringify(organization) ||
      JSON.stringify(formData.branding) !== JSON.stringify(branding) ||
      JSON.stringify(formData.menuDefaults) !== JSON.stringify(menuDefaults) ||
      JSON.stringify(formData.approvals) !== JSON.stringify(approvals) ||
      JSON.stringify(formData.holidays) !== JSON.stringify(holidays) ||
      JSON.stringify(formData.exportMappings) !== JSON.stringify(exportMappings) ||
      JSON.stringify(formData.security) !== JSON.stringify(security)
    
    setHasUnsavedChanges(hasChanges)
  }, [formData, organization, branding, menuDefaults, approvals, holidays, exportMappings, security])
  
  // Handle logo upload
  const handleLogoUpload = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,image/jpeg,image/svg+xml'
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement
      const file = target.files?.[0]
      if (!file) return
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Logo must be under 2MB')
        return
      }
      setLogoUploading(true)
      // Create local preview URL (in production, upload to Supabase storage)
      const url = URL.createObjectURL(file)
      setFormData((prev) => ({
        ...prev,
        branding: { ...prev.branding, logo_url: url },
      }))
      setLogoUploading(false)
      toast.success('Logo uploaded')
    }
    input.click()
  }

  // Handle save
  const handleSave = () => {
    // Validation
    if (!formData.organization.name?.trim()) {
      toast.error('Organization name is required')
      return
    }

    if (formData.organization.gst_rate_percent < 0 || formData.organization.gst_rate_percent > 100) {
      toast.error('GST rate must be between 0 and 100')
      return
    }

    // ABN validation (only if provided)
    const abnValue = formData.organization.abn?.replace(/\s/g, '')
    if (abnValue && !validateABN(abnValue)) {
      toast.error('Invalid ABN — must be a valid 11-digit Australian Business Number')
      setActiveTab('profile')
      return
    }
    
    // Save all sections
    updateOrganization(formData.organization)
    updateBranding(formData.branding)
    updateMenuDefaults(formData.menuDefaults)
    updateApprovals(formData.approvals)
    updateHolidays(formData.holidays)
    updateExportMappings(formData.exportMappings)
    updateSecurity(formData.security)
    
    toast.success('Settings saved successfully')
    setHasUnsavedChanges(false)
  }
  
  // Handle reset
  const handleReset = () => {
    if (confirm('Discard all unsaved changes?')) {
      setFormData({
        organization: organization || {},
        branding: branding || {},
        menuDefaults: menuDefaults || {},
        approvals: approvals || {},
        holidays: holidays || {},
        exportMappings: exportMappings || {},
        security: security || {},
      })
      setHasUnsavedChanges(false)
      toast.info('Changes discarded')
    }
  }
  
  // Warn on navigation with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])
  
  const toolbar = (
    <PageToolbar
      title="Organisation Settings"
      actions={
        <>
          {hasUnsavedChanges && (
            <>
              <Button variant="outline" size="sm" onClick={handleReset}>
                Discard Changes
              </Button>
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Unsaved
              </Badge>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => publishToVenues()}>
            Publish to Venues
          </Button>
        </>
      }
      primaryAction={{
        label: 'Save Settings',
        icon: Save,
        onClick: handleSave,
        disabled: !hasUnsavedChanges,
        variant: 'primary',
      }}
    />
  )

  return (
    <PageShell toolbar={toolbar}>
      <div className="p-6 space-y-6">
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="menu">Menu</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="holidays">Holidays</TabsTrigger>
          <TabsTrigger value="exports">Exports</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>
        
        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Organization Profile</CardTitle>
              <CardDescription>Basic organization information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Organization Name</Label>
                  <Input
                    id="org-name"
                    value={formData.organization.name || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        organization: { ...prev.organization, name: e.target.value },
                      }))
                    }
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="abn">ABN (Optional)</Label>
                  <Input
                    id="abn"
                    placeholder="12 345 678 910"
                    maxLength={14}
                    value={formatABN(formData.organization.abn || '')}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/[^0-9]/g, '').slice(0, 11)
                      setFormData((prev) => ({
                        ...prev,
                        organization: { ...prev.organization, abn: cleaned },
                      }))
                      if (cleaned.length === 11) {
                        setAbnValid(validateABN(cleaned))
                      } else if (cleaned.length === 0) {
                        setAbnValid(null)
                      } else {
                        setAbnValid(null)
                      }
                    }}
                  />
                  {abnValid === true && (
                    <div className="flex items-center gap-1 text-sm text-green-600">
                      <CheckCircle className="h-3 w-3" />
                      Valid ABN
                    </div>
                  )}
                  {abnValid === false && (
                    <div className="flex items-center gap-1 text-sm text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      Invalid ABN — check the number
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    11-digit Australian Business Number
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={formData.organization.timezone || 'Australia/Melbourne'}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        organization: { ...prev.organization, timezone: value },
                      }))
                    }
                  >
                    <SelectTrigger id="timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AU_TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="week-starts">Week Starts On</Label>
                  <Select
                    value={formData.organization.week_starts_on || 'Monday'}
                    onValueChange={(value: 'Monday' | 'Sunday') =>
                      setFormData((prev) => ({
                        ...prev,
                        organization: { ...prev.organization, week_starts_on: value },
                      }))
                    }
                  >
                    <SelectTrigger id="week-starts">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Monday">Monday</SelectItem>
                      <SelectItem value="Sunday">Sunday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gst-rate">GST Rate (%)</Label>
                  <Input
                    id="gst-rate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.organization.gst_rate_percent || 10}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        organization: { ...prev.organization, gst_rate_percent: parseFloat(e.target.value) },
                      }))
                    }
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="price-display">Price Display Mode</Label>
                  <Select
                    value={formData.organization.price_display_mode || 'INC_GST'}
                    onValueChange={(value: 'INC_GST' | 'EX_GST') =>
                      setFormData((prev) => ({
                        ...prev,
                        organization: { ...prev.organization, price_display_mode: value },
                      }))
                    }
                  >
                    <SelectTrigger id="price-display">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INC_GST">GST Inclusive</SelectItem>
                      <SelectItem value="EX_GST">GST Exclusive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="gp-target">Default GP Target (%)</Label>
                <Input
                  id="gp-target"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.organization.default_gp_target_percent || 65}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      organization: { ...prev.organization, default_gp_target_percent: parseInt(e.target.value) },
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Used for recipe pricing calculations
                </p>
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="financial-year">Financial Year Starts</Label>
                  <Select
                    value={String(formData.organization.financial_year_start_month || 7)}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        organization: { ...prev.organization, financial_year_start_month: parseInt(value) },
                      }))
                    }
                  >
                    <SelectTrigger id="financial-year">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_NAMES.map((month, index) => (
                        <SelectItem key={index + 1} value={String(index + 1)}>
                          {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Australian default: July
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={formData.organization.currency_code || 'AUD'}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        organization: { ...prev.organization, currency_code: value },
                      }))
                    }
                  >
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AUD">AUD — Australian Dollar ($)</SelectItem>
                      <SelectItem value="NZD">NZD — New Zealand Dollar ($)</SelectItem>
                      <SelectItem value="USD">USD — US Dollar ($)</SelectItem>
                      <SelectItem value="GBP">GBP — British Pound (£)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payroll-cycle">Payroll Cycle</Label>
                  <Select
                    value={formData.organization.payroll_cycle || 'fortnightly'}
                    onValueChange={(value: 'weekly' | 'fortnightly' | 'monthly') =>
                      setFormData((prev) => ({
                        ...prev,
                        organization: { ...prev.organization, payroll_cycle: value },
                      }))
                    }
                  >
                    <SelectTrigger id="payroll-cycle">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="fortnightly">Fortnightly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Determines pay period for timesheets and payroll
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Branding Tab */}
        <TabsContent value="branding" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Branding & Print Settings</CardTitle>
              <CardDescription>Logo, colors, and print templates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Organization Logo</Label>
                <div className="flex items-start gap-4">
                  <div className="w-24 h-24 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/30 overflow-hidden">
                    {formData.branding.logo_url ? (
                      <img
                        src={formData.branding.logo_url}
                        alt="Logo"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <ImagePlus className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLogoUpload}
                      disabled={logoUploading}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {logoUploading ? 'Uploading...' : 'Upload Logo'}
                    </Button>
                    {formData.branding.logo_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            branding: { ...prev.branding, logo_url: '' },
                          }))
                        }
                      >
                        <X className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG, or SVG. Max 2MB. Shown on receipts and reports.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="brand-color">Brand Color (Hex)</Label>
                <div className="flex gap-2">
                  <Input
                    id="brand-color"
                    value={formData.branding.brand_color_hex || '#6C5CE7'}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        branding: { ...prev.branding, brand_color_hex: e.target.value },
                      }))
                    }
                  />
                  <div
                    className="w-12 h-10 rounded border"
                    style={{ backgroundColor: formData.branding.brand_color_hex || '#6C5CE7' }}
                  />
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Label htmlFor="receipt-footer">Receipt Footer Text</Label>
                <Textarea
                  id="receipt-footer"
                  placeholder="Thanks for dining with us!"
                  rows={3}
                  value={formData.branding.receipt_footer_text || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      branding: { ...prev.branding, receipt_footer_text: e.target.value },
                    }))
                  }
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="menu-header">Menu Print Header</Label>
                <Textarea
                  id="menu-header"
                  placeholder="Our carefully crafted menu..."
                  rows={3}
                  value={formData.branding.menu_print_header || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      branding: { ...prev.branding, menu_print_header: e.target.value },
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Menu Defaults Tab */}
        <TabsContent value="menu" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Menu Defaults</CardTitle>
              <CardDescription>Default sections, allergens, and pricing rules</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Default Menu Sections</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  These sections will be used when creating new menus
                </p>
                <div className="space-y-2">
                  {(formData.menuDefaults.menu_sections || []).map((section: MenuSection, index: number) => (
                    <div key={section.id} className="flex items-center gap-2 p-2 border rounded">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <Input value={section.name} className="flex-1" readOnly />
                      <Checkbox checked={section.is_drinks} disabled />
                      <span className="text-xs text-muted-foreground w-20">
                        {section.is_drinks ? 'Drinks' : 'Food'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price-endings">Price Endings</Label>
                  <Select
                    value={formData.menuDefaults.price_endings || '.90'}
                    onValueChange={(value: OrgMenuDefaults['price_endings']) =>
                      setFormData((prev) => ({
                        ...prev,
                        menuDefaults: { ...prev.menuDefaults, price_endings: value },
                      }))
                    }
                  >
                    <SelectTrigger id="price-endings">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=".00">.00</SelectItem>
                      <SelectItem value=".50">.50</SelectItem>
                      <SelectItem value=".90">.90</SelectItem>
                      <SelectItem value=".95">.95</SelectItem>
                      <SelectItem value=".99">.99</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="rounding">Rounding Mode</Label>
                  <Select
                    value={formData.menuDefaults.rounding_mode || 'NEAREST'}
                    onValueChange={(value: OrgMenuDefaults['rounding_mode']) =>
                      setFormData((prev) => ({
                        ...prev,
                        menuDefaults: { ...prev.menuDefaults, rounding_mode: value },
                      }))
                    }
                  >
                    <SelectTrigger id="rounding">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEAREST">Nearest</SelectItem>
                      <SelectItem value="UP">Up</SelectItem>
                      <SelectItem value="DOWN">Down</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="default-gst">Default GST Mode</Label>
                  <Select
                    value={formData.menuDefaults.default_gst_mode_items || 'INC'}
                    onValueChange={(value: OrgMenuDefaults['default_gst_mode_items']) =>
                      setFormData((prev) => ({
                        ...prev,
                        menuDefaults: { ...prev.menuDefaults, default_gst_mode_items: value },
                      }))
                    }
                  >
                    <SelectTrigger id="default-gst">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INC">GST Inclusive</SelectItem>
                      <SelectItem value="EX">GST Exclusive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <Label>Default Allergen List (FSANZ)</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Australian Food Standards allergen list
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {FSANZ_ALLERGENS.map((allergen) => (
                    <div key={allergen} className="flex items-center gap-2 p-2 bg-muted rounded">
                      <Checkbox checked disabled />
                      <span className="text-sm">{allergen}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Approvals Tab */}
        <TabsContent value="approvals" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Approval Workflows</CardTitle>
              <CardDescription>Set thresholds for requiring approvals</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="price-change">Max Price Change Without Approval (%)</Label>
                <Input
                  id="price-change"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.approvals.price_change_max_percent_no_approval || 5}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      approvals: { ...prev.approvals, price_change_max_percent_no_approval: parseInt(e.target.value) },
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Price changes exceeding this require owner approval
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="roster-budget">Roster Over Budget Requires Owner (%)</Label>
                <Input
                  id="roster-budget"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.approvals.roster_over_budget_percent_requires_owner || 10}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      approvals: { ...prev.approvals, roster_over_budget_percent_requires_owner: parseInt(e.target.value) },
                    }))
                  }
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="po-amount">PO Amount Requiring Owner Approval (AUD)</Label>
                <Input
                  id="po-amount"
                  type="number"
                  min="0"
                  value={formData.approvals.po_amount_over_requires_owner || 1000}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      approvals: { ...prev.approvals, po_amount_over_requires_owner: parseInt(e.target.value) },
                    }))
                  }
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="gp-threshold">Below GP Threshold Alert (%)</Label>
                <Input
                  id="gp-threshold"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.approvals.below_gp_threshold_alert_percent || 60}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      approvals: { ...prev.approvals, below_gp_threshold_alert_percent: parseInt(e.target.value) },
                    }))
                  }
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center gap-2">
                <Checkbox
                  id="ai-suggestions"
                  checked={formData.approvals.enable_ai_suggestions || false}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      approvals: { ...prev.approvals, enable_ai_suggestions: !!checked },
                    }))
                  }
                />
                <Label htmlFor="ai-suggestions" className="cursor-pointer">
                  Enable AI Suggestions
                </Label>
              </div>
              
              <div className="flex items-center gap-2">
                <Checkbox
                  id="require-reason"
                  checked={formData.approvals.require_reason_on_override || false}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      approvals: { ...prev.approvals, require_reason_on_override: !!checked },
                    }))
                  }
                />
                <Label htmlFor="require-reason" className="cursor-pointer">
                  Require Reason on Override
                </Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Holidays Tab */}
        <TabsContent value="holidays" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Holidays & Closed Dates</CardTitle>
              <CardDescription>Manage public holidays and custom closed dates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="state">State/Territory</Label>
                <Select
                  value={formData.holidays.state || 'VIC'}
                  onValueChange={(value: OrgHolidays['state']) =>
                    setFormData((prev) => ({
                      ...prev,
                      holidays: { ...prev.holidays, state: value },
                    }))
                  }
                >
                  <SelectTrigger id="state">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AU_STATES.map((state) => (
                      <SelectItem key={state.value} value={state.value}>
                        {state.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2">
                <Checkbox
                  id="au-holidays"
                  checked={formData.holidays.use_au_public_holidays || false}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      holidays: { ...prev.holidays, use_au_public_holidays: !!checked },
                    }))
                  }
                />
                <Label htmlFor="au-holidays" className="cursor-pointer">
                  Use Australian Public Holidays
                </Label>
              </div>
              
              <Separator />
              
              <div>
                <Label>Custom Closed Dates</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Add dates when venues are closed
                </p>
                <div className="space-y-2">
                  {(formData.holidays.custom_closed_dates || []).map((date, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1">{date}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newDates = [...(formData.holidays.custom_closed_dates || [])]
                          newDates.splice(index, 1)
                          setFormData((prev) => ({
                            ...prev,
                            holidays: { ...prev.holidays, custom_closed_dates: newDates },
                          }))
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newDate = new Date().toISOString().split('T')[0]
                      setFormData((prev) => ({
                        ...prev,
                        holidays: {
                          ...prev.holidays,
                          custom_closed_dates: [...(prev.holidays.custom_closed_dates || []), newDate],
                        },
                      }))
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Date
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* TAB 6: EXPORTS & INTEGRATIONS */}
        <TabsContent value="exports" className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">POS Integration Defaults</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pos_provider">POS Provider</Label>
                  <Select
                    value={formData.exportMappings.pos_provider || 'Square'}
                    onValueChange={(value: OrgExportMappings['pos_provider']) =>
                      setFormData({
                        ...formData,
                        exportMappings: { ...formData.exportMappings, pos_provider: value },
                      })
                    }
                  >
                    <SelectTrigger id="pos_provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Square">Square</SelectItem>
                      <SelectItem value="Lightspeed">Lightspeed</SelectItem>
                      <SelectItem value="Kounta">Kounta</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="tax_code">Default Tax Code</Label>
                  <Input
                    id="tax_code"
                    value={formData.exportMappings.default_tax_code || 'GST'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        exportMappings: {
                          ...formData.exportMappings,
                          default_tax_code: e.target.value,
                        },
                      })
                    }
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="accounting_inc_gst"
                  checked={formData.exportMappings.accounting_price_inc_gst || false}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      exportMappings: {
                        ...formData.exportMappings,
                        accounting_price_inc_gst: checked as boolean,
                      },
                    })
                  }
                />
                <Label htmlFor="accounting_inc_gst" className="cursor-pointer">
                  Export prices including GST for accounting systems
                </Label>
              </div>
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">CSV Export Column Layout</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  // Generate sample CSV
                  const headers = formData.exportMappings.csv_columns || []
                  const sampleRow = {
                    section_name: 'Mains',
                    item_name: 'Margherita Pizza',
                    plu_code: '101',
                    price_inc_gst: '12.00',
                    price_ex_gst: '10.91',
                    gst_rate_percent: '10',
                    gst_mode: 'INC',
                    recipe_id: 'RECIPE-001',
                  }
                  
                  const csv = [
                    headers.join(','),
                    headers.map((col) => sampleRow[col as keyof typeof sampleRow] || '').join(','),
                  ].join('\n')
                  
                  const blob = new Blob([csv], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'sample-export.csv'
                  a.click()
                  
                  toast.success('Sample CSV downloaded')
                }}
              >
                <Download className="h-3 w-3 mr-2" />
                Download Sample CSV
              </Button>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-3">
                Drag to reorder columns for your POS/accounting exports
              </p>
              
              {(formData.exportMappings.csv_columns || []).map((column, index) => (
                <div
                  key={column}
                  className="flex items-center gap-2 p-2 border rounded-lg bg-muted/30"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                  <span className="flex-1 font-mono text-sm">{column}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const updated = formData.exportMappings.csv_columns!.filter(
                        (_, i) => i !== index
                      )
                      setFormData({
                        ...formData,
                        exportMappings: { ...formData.exportMappings, csv_columns: updated },
                      })
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
        
        {/* TAB 7: SECURITY & PRIVACY */}
        <TabsContent value="security" className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Data Privacy & Security</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">PII Redaction on Exports</p>
                  <p className="text-sm text-muted-foreground">
                    Automatically redact personal information in exported reports
                  </p>
                </div>
                <Checkbox
                  checked={formData.security.pii_redaction_on_exports || false}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      security: {
                        ...formData.security,
                        pii_redaction_on_exports: checked as boolean,
                      },
                    })
                  }
                />
              </div>
              
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Allow Crew to View Cost Fields</p>
                  <p className="text-sm text-muted-foreground">
                    Crew members can see product costs and GP%
                  </p>
                </div>
                <Checkbox
                  checked={formData.security.allow_crew_view_costs || false}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      security: {
                        ...formData.security,
                        allow_crew_view_costs: checked as boolean,
                      },
                    })
                  }
                />
              </div>
              
              <div>
                <Label htmlFor="retention">Document Retention Period (Months)</Label>
                <Input
                  id="retention"
                  type="number"
                  min="0"
                  value={formData.security.document_retention_months || 36}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      security: {
                        ...formData.security,
                        document_retention_months: parseInt(e.target.value) || 36,
                      },
                    })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Documents older than this will be archived. Australian legal requirement: 36 months
                </p>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                <div className="flex gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900">Data Protection Notice</p>
                    <p className="text-sm text-blue-700 mt-1">
                      All data is encrypted at rest and in transit. Access logs are maintained for
                      all sensitive operations. Your data is stored in Australian data centers and
                      complies with the Privacy Act 1988.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
        
        {/* TAB 8: AUDIT LOG */}
        <TabsContent value="audit" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Audit Trail</h3>
                <p className="text-sm text-muted-foreground">
                  Complete history of organization settings changes
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  // Export audit log as CSV
                  const headers = ['Timestamp', 'User', 'Action', 'Changes']
                  const rows = auditLogs.map((log) => [
                    new Date(log.created_at).toLocaleString(),
                    log.actor_name,
                    log.action,
                    'View details in app',
                  ])
                  
                  const csv = [
                    headers.join(','),
                    ...rows.map((row) => row.join(',')),
                  ].join('\n')
                  
                  const blob = new Blob([csv], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`
                  a.click()
                  
                  toast.success('Audit log exported')
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
            
            {auditLogs.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No audit entries yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Changes to organization settings will appear here
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Summary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.slice(0, 50).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {new Date(log.created_at).toLocaleString('en-AU', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
                            {log.actor_name.charAt(0)}
                          </div>
                          <span className="text-sm">{log.actor_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.action === 'settings.publish_to_venues' ? (
                          <span>Published to {log.after_snapshot?.venue_count || 0} venues</span>
                        ) : (
                          <span>Settings updated</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            
            {auditLogs.length > 50 && (
              <div className="text-center py-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing 50 most recent entries. Export CSV for full history.
                </p>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </PageShell>
  )
}
