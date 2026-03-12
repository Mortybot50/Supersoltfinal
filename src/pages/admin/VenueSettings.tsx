import React, { useState, useEffect } from "react";
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner'
import { Save, UploadCloud, RotateCcw, Plus, Copy, FileDown } from "lucide-react";
import CloneVenueDialog from "@/components/venues/CloneVenueDialog";
import SaveAsTemplateDialog from "@/components/venues/SaveAsTemplateDialog";
import { fetchVenueTemplates, type VenueTemplate } from "@/lib/venueTemplates";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { z } from "zod";
import { PageShell, PageToolbar } from '@/components/shared';
import type { VenueSettings as VenueSettingsType } from "@/lib/venueSettings";
import { getDefaultOrgSettings } from "@/lib/venueSettings";

export default function VenueSettings() {
  const { user, currentVenue, venues } = useAuth();
  const [selectedVenue, setSelectedVenue] = useState(currentVenue?.id || '');
  const [settings, setSettings] = useState<Partial<VenueSettingsType>>({
    venue_id: selectedVenue,
    timezone: 'Australia/Melbourne',
    price_display_mode: 'INC_GST',
    gst_rate_percent: 10.0,
    week_starts_on: 'Monday',
    default_gp_target_percent: 70.0,
    menu_sections: [],
    price_endings: '.00',
    rounding_mode: 'NEAREST',
    inherit: {},
  });
  const [originalSettings, setOriginalSettings] = useState<Partial<VenueSettingsType>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [newVenueOpen, setNewVenueOpen] = useState(false);

  // Pre-fill new venue form from org defaults when dialog opens
  const openNewVenueWithDefaults = () => {
    const orgId = currentVenue?.org_id || venues[0]?.org_id;
    if (orgId) {
      supabase
        .from('organizations')
        .select('settings')
        .eq('id', orgId)
        .single()
        .then(({ data }) => {
          if (data?.settings && typeof data.settings === 'object') {
            const s = data.settings as Record<string, unknown>;
            setNewVenueForm((prev) => ({
              ...prev,
              timezone: (s.timezone as string) || prev.timezone,
              trading_hours: s.default_trading_hours
                ? JSON.stringify(s.default_trading_hours, null, 2)
                : prev.trading_hours,
            }));
          }
        });
    }
    setNewVenueOpen(true);
  };
  const [newVenueForm, setNewVenueForm] = useState({ name: '', address: '', timezone: 'Australia/Melbourne', trading_hours: '' });
  const [newVenueSaving, setNewVenueSaving] = useState(false);
  const [newVenueErrors, setNewVenueErrors] = useState<Record<string, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneSourceVenue, setCloneSourceVenue] = useState<{ id: string; name: string; org_id: string } | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templates, setTemplates] = useState<VenueTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');

  const orgSettings = getDefaultOrgSettings();

  // Load venue templates
  useEffect(() => {
    const orgId = currentVenue?.org_id || venues[0]?.org_id;
    if (!orgId) return;
    fetchVenueTemplates(orgId).then(setTemplates).catch(console.error);
  }, [currentVenue?.org_id, venues]);

  const newVenueSchema = z.object({
    name: z.string().min(1, 'Venue name is required').max(100),
    address: z.string().optional(),
    timezone: z.string().min(1),
    trading_hours: z.string().optional(),
  });

  const handleCreateVenue = async () => {
    const result = newVenueSchema.safeParse(newVenueForm);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach(e => { errs[e.path[0] as string] = e.message; });
      setNewVenueErrors(errs);
      return;
    }
    setNewVenueErrors({});
    setNewVenueSaving(true);

    const orgId = currentVenue?.org_id || venues[0]?.org_id;
    if (!orgId) {
      toast.error('Error', { description: 'No organization found' });
      setNewVenueSaving(false);
      return;
    }

    try {
      const tradingHours = newVenueForm.trading_hours
        ? (() => { try { return JSON.parse(newVenueForm.trading_hours); } catch { return { notes: newVenueForm.trading_hours }; } })()
        : {};

      const { data, error } = await supabase
        .from('venues')
        .insert({
          org_id: orgId,
          name: newVenueForm.name.trim(),
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      // Refresh venues in auth context
      toast.success('Venue created', { description: `${newVenueForm.name} has been created. Refresh the page to see it in the venue list.` });
      setNewVenueOpen(false);
      setNewVenueForm({ name: '', address: '', timezone: 'Australia/Melbourne', trading_hours: '' });

      // Force reload to pick up new venue
      window.location.reload();
    } catch (err) {
      console.error('Create venue error:', err);
      toast.error('Error', { description: 'Failed to create venue' });
    } finally {
      setNewVenueSaving(false);
    }
  };

  // Sync selectedVenue when auth context loads
  useEffect(() => {
    if (currentVenue?.id && !selectedVenue) {
      setSelectedVenue(currentVenue.id);
    }
  }, [currentVenue, selectedVenue]);

  useEffect(() => {
    if (!selectedVenue) return;
    loadVenueSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVenue]); // loadVenueSettings is a local function

  const loadVenueSettings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('venue_settings')
        .select('*')
        .eq('venue_id', selectedVenue)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // Convert Json types to proper arrays
        const convertedData: Partial<VenueSettingsType> = {
          ...data,
          menu_sections: Array.isArray(data.menu_sections) ? data.menu_sections : [],
          primary_suppliers: Array.isArray(data.primary_suppliers) ? (data.primary_suppliers as string[]) : [],
          delivery_windows: Array.isArray(data.delivery_windows) ? data.delivery_windows : [],
          order_cutoffs: Array.isArray(data.order_cutoffs) ? data.order_cutoffs : [],
          printer_map: Array.isArray(data.printer_map) ? data.printer_map : [],
          custom_closed_dates: Array.isArray(data.custom_closed_dates) ? (data.custom_closed_dates as string[]) : [],
          inherit: typeof data.inherit === 'object' && data.inherit !== null ? data.inherit as Record<string, boolean> : {},
        };
        setSettings(convertedData);
        setOriginalSettings(convertedData);
      } else {
        // No settings yet, use defaults
        const defaultSettings = {
          venue_id: selectedVenue,
          ...orgSettings,
          inherit: {},
        };
        setSettings(defaultSettings);
        setOriginalSettings(defaultSettings);
      }
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error loading venue settings:', error);
      toast.error("Error", { description: "Failed to load venue settings",
        variant: "destructive", });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFieldChange = (field: string, value: unknown) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  const handleInheritToggle = (field: string, inherit: boolean) => {
    setSettings(prev => ({
      ...prev,
      inherit: { ...prev.inherit, [field]: inherit },
    }));
    setHasUnsavedChanges(true);
  };

  const isFieldInherited = (field: string) => {
    return settings.inherit?.[field] === true;
  };

  const getFieldValue = (field: string) => {
    if (isFieldInherited(field)) {
      return orgSettings[field];
    }
    return settings[field as keyof VenueSettingsType];
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('venue_settings')
        .upsert({
          ...settings,
          venue_id: selectedVenue,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast.success("Settings Saved", { description: "Settings saved (not published)", });
      setHasUnsavedChanges(false);
      setOriginalSettings(settings);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error("Error", { description: "Failed to save settings",
        variant: "destructive", });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublish = async () => {
    setIsLoading(true);
    try {
      // Create audit record
      await supabase.from('venue_settings_audit').insert({
        venue_id: selectedVenue,
        actor_user_id: user?.id || 'unknown',
        action: 'published',
        before_snapshot: originalSettings.last_published_snapshot,
        after_snapshot: settings,
        diff_summary: 'Settings published',
      });

      // Update settings with new snapshot
      const { error } = await supabase
        .from('venue_settings')
        .upsert({
          ...settings,
          venue_id: selectedVenue,
          last_published_snapshot: settings,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast.success("Settings Published", { description: `Settings published to ${selectedVenue}`, });
      setHasUnsavedChanges(false);
      await loadVenueSettings();
    } catch (error) {
      console.error('Error publishing settings:', error);
      toast.error("Error", { description: "Failed to publish settings",
        variant: "destructive", });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSettings(originalSettings);
    setHasUnsavedChanges(false);
    toast.success("Changes Discarded", { description: "Reverted to last saved settings", });
  };

  const toolbar = (
    <PageToolbar
      title="Venue Settings"
      actions={
        <>
          {hasUnsavedChanges && (
            <Badge variant="outline" className="text-warning">
              Unsaved
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={!hasUnsavedChanges || isLoading}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </>
      }
      primaryAction={{
        label: 'Save Settings',
        icon: Save,
        onClick: handleSave,
        disabled: isLoading,
        variant: 'primary',
      }}
    />
  )

  return (
    <PageShell toolbar={toolbar}>
      <div className="px-6 py-6 space-y-6">
      {/* Venue Selector */}
      <div className="flex items-center gap-4">
        <Label className="text-sm font-medium">Venue:</Label>
        <Select value={selectedVenue} onValueChange={setSelectedVenue}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select venue" />
          </SelectTrigger>
          <SelectContent>
            {venues.map((v) => (
              <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={openNewVenueWithDefaults}>
          <Plus className="h-4 w-4 mr-2" />
          New Venue
        </Button>
        {selectedVenue && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const v = venues.find((v) => v.id === selectedVenue);
                if (v) {
                  setCloneSourceVenue(v);
                  setCloneDialogOpen(true);
                }
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Clone Venue
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTemplateDialogOpen(true)}
            >
              <FileDown className="h-4 w-4 mr-2" />
              Save as Template
            </Button>
          </>
        )}
      </div>

      {/* New Venue Dialog */}
      <Dialog open={newVenueOpen} onOpenChange={setNewVenueOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Venue</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {templates.length > 0 && (
              <div className="space-y-2">
                <Label>Apply Template</Label>
                <Select
                  value={selectedTemplate}
                  onValueChange={(val) => {
                    setSelectedTemplate(val);
                    const tmpl = templates.find((t) => t.id === val);
                    if (tmpl?.template_data) {
                      setNewVenueForm((prev) => ({
                        ...prev,
                        timezone: tmpl.template_data.timezone || prev.timezone,
                        trading_hours: tmpl.template_data.trading_hours
                          ? JSON.stringify(tmpl.template_data.trading_hours, null, 2)
                          : prev.trading_hours,
                      }));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="new-venue-name">Venue Name *</Label>
              <Input
                id="new-venue-name"
                placeholder="e.g. CBD Store, Southbank Kitchen"
                value={newVenueForm.name}
                onChange={(e) => setNewVenueForm(prev => ({ ...prev, name: e.target.value }))}
              />
              {newVenueErrors.name && <p className="text-sm text-destructive">{newVenueErrors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-venue-address">Address</Label>
              <Input
                id="new-venue-address"
                placeholder="123 Collins St, Melbourne VIC 3000"
                value={newVenueForm.address}
                onChange={(e) => setNewVenueForm(prev => ({ ...prev, address: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-venue-tz">Timezone</Label>
              <Select
                value={newVenueForm.timezone}
                onValueChange={(value) => setNewVenueForm(prev => ({ ...prev, timezone: value }))}
              >
                <SelectTrigger id="new-venue-tz">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Australia/Melbourne">Melbourne (AEST/AEDT)</SelectItem>
                  <SelectItem value="Australia/Sydney">Sydney (AEST/AEDT)</SelectItem>
                  <SelectItem value="Australia/Brisbane">Brisbane (AEST)</SelectItem>
                  <SelectItem value="Australia/Adelaide">Adelaide (ACST/ACDT)</SelectItem>
                  <SelectItem value="Australia/Perth">Perth (AWST)</SelectItem>
                  <SelectItem value="Australia/Darwin">Darwin (ACST)</SelectItem>
                  <SelectItem value="Australia/Hobart">Hobart (AEST/AEDT)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-venue-hours">Trading Hours</Label>
              <Textarea
                id="new-venue-hours"
                placeholder="Mon-Fri 7am-10pm, Sat-Sun 8am-11pm"
                rows={3}
                value={newVenueForm.trading_hours}
                onChange={(e) => setNewVenueForm(prev => ({ ...prev, trading_hours: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewVenueOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateVenue} disabled={newVenueSaving}>
              {newVenueSaving ? 'Creating...' : 'Create Venue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <Tabs defaultValue="locale" className="space-y-6">
        <TabsList>
          <TabsTrigger value="locale">Locale & Display</TabsTrigger>
          <TabsTrigger value="menu">Menu & Pricing</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers & Ordering</TabsTrigger>
          <TabsTrigger value="workforce">Workforce</TabsTrigger>
          {/* Hidden for MVP: <TabsTrigger value="pos">POS & Printers</TabsTrigger> */}
          {/* Hidden for MVP: <TabsTrigger value="calendar">Calendar</TabsTrigger> */}
          {/* Hidden for MVP: <TabsTrigger value="guardrails">Guardrails</TabsTrigger> */}
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        {/* LOCALE & DISPLAY TAB */}
        <TabsContent value="locale">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Locale & Display Settings</CardTitle>
                <CardDescription>
                  Configure timezone, GST display, and regional preferences
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="inherit-locale">Inherit from Organization</Label>
                <Switch
                  id="inherit-locale"
                  checked={isFieldInherited('timezone')}
                  onCheckedChange={(checked) => {
                    handleInheritToggle('timezone', checked);
                    handleInheritToggle('week_starts_on', checked);
                    handleInheritToggle('price_display_mode', checked);
                    handleInheritToggle('gst_rate_percent', checked);
                  }}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Timezone */}
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                {isFieldInherited('timezone') ? (
                  <div className="flex items-center gap-2">
                    <Input value={getFieldValue('timezone')} disabled />
                    <Badge>Inherited from Org</Badge>
                  </div>
                ) : (
                  <Select
                    value={String(settings.timezone)}
                    onValueChange={(value) => handleFieldChange('timezone', value)}
                  >
                    <SelectTrigger id="timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Australia/Melbourne">Australia/Melbourne (AEDT)</SelectItem>
                      <SelectItem value="Australia/Sydney">Australia/Sydney (AEDT)</SelectItem>
                      <SelectItem value="Australia/Brisbane">Australia/Brisbane (AEST)</SelectItem>
                      <SelectItem value="Australia/Perth">Australia/Perth (AWST)</SelectItem>
                      <SelectItem value="Australia/Adelaide">Australia/Adelaide (ACDT)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Week Starts On */}
              <div className="space-y-2">
                <Label>Week Starts On</Label>
                {isFieldInherited('week_starts_on') ? (
                  <div className="flex items-center gap-2">
                    <Input value={getFieldValue('week_starts_on')} disabled />
                    <Badge>Inherited from Org</Badge>
                  </div>
                ) : (
                  <RadioGroup
                    value={String(settings.week_starts_on)}
                    onValueChange={(value) => handleFieldChange('week_starts_on', value)}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Monday" id="monday" />
                      <Label htmlFor="monday">Monday</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Sunday" id="sunday" />
                      <Label htmlFor="sunday">Sunday</Label>
                    </div>
                  </RadioGroup>
                )}
              </div>

              {/* Price Display Mode */}
              <div className="space-y-2">
                <Label>Price Display Mode</Label>
                {isFieldInherited('price_display_mode') ? (
                  <div className="flex items-center gap-2">
                    <Input value={getFieldValue('price_display_mode')} disabled />
                    <Badge>Inherited from Org</Badge>
                  </div>
                ) : (
                  <RadioGroup
                    value={String(settings.price_display_mode)}
                    onValueChange={(value) => handleFieldChange('price_display_mode', value)}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="INC_GST" id="inc-gst" />
                      <Label htmlFor="inc-gst">Inclusive of GST</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="EX_GST" id="ex-gst" />
                      <Label htmlFor="ex-gst">Exclusive of GST</Label>
                    </div>
                  </RadioGroup>
                )}
              </div>

              {/* GST Rate */}
              <div className="space-y-2">
                <Label htmlFor="gst-rate">GST Rate (%)</Label>
                {isFieldInherited('gst_rate_percent') ? (
                  <div className="flex items-center gap-2">
                    <Input value={getFieldValue('gst_rate_percent')} disabled />
                    <Badge>Inherited from Org</Badge>
                  </div>
                ) : (
                  <Input
                    id="gst-rate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={settings.gst_rate_percent || 10}
                    onChange={(e) => handleFieldChange('gst_rate_percent', parseFloat(e.target.value))}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MENU & PRICING TAB */}
        <TabsContent value="menu">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Menu & Pricing Settings</CardTitle>
                <CardDescription>
                  Configure pricing rules, GP targets, and menu structure
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="inherit-menu">Inherit from Organization</Label>
                <Switch
                  id="inherit-menu"
                  checked={isFieldInherited('default_gp_target_percent')}
                  onCheckedChange={(checked) => {
                    handleInheritToggle('default_gp_target_percent', checked);
                    handleInheritToggle('price_endings', checked);
                    handleInheritToggle('rounding_mode', checked);
                    handleInheritToggle('menu_sections', checked);
                  }}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Default GP Target */}
              <div className="space-y-2">
                <Label htmlFor="gp-target">Default GP Target (%)</Label>
                <p className="text-sm text-muted-foreground">
                  Target gross profit percentage for menu items
                </p>
                {isFieldInherited('default_gp_target_percent') ? (
                  <div className="flex items-center gap-2">
                    <Input value={getFieldValue('default_gp_target_percent')} disabled />
                    <Badge>Inherited from Org</Badge>
                  </div>
                ) : (
                  <Input
                    id="gp-target"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={settings.default_gp_target_percent || 70}
                    onChange={(e) => handleFieldChange('default_gp_target_percent', parseFloat(e.target.value))}
                  />
                )}
              </div>

              {/* Price Endings */}
              <div className="space-y-2">
                <Label htmlFor="price-endings">Price Endings</Label>
                {isFieldInherited('price_endings') ? (
                  <div className="flex items-center gap-2">
                    <Input value={getFieldValue('price_endings')} disabled />
                    <Badge>Inherited from Org</Badge>
                  </div>
                ) : (
                  <Select
                    value={String(settings.price_endings)}
                    onValueChange={(value) => handleFieldChange('price_endings', value)}
                  >
                    <SelectTrigger id="price-endings">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=".00">.00 (e.g., $12.00)</SelectItem>
                      <SelectItem value=".50">.50 (e.g., $12.50)</SelectItem>
                      <SelectItem value=".90">.90 (e.g., $12.90)</SelectItem>
                      <SelectItem value=".95">.95 (e.g., $12.95)</SelectItem>
                      <SelectItem value=".99">.99 (e.g., $12.99)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Rounding Mode */}
              <div className="space-y-2">
                <Label>Rounding Mode</Label>
                {isFieldInherited('rounding_mode') ? (
                  <div className="flex items-center gap-2">
                    <Input value={getFieldValue('rounding_mode')} disabled />
                    <Badge>Inherited from Org</Badge>
                  </div>
                ) : (
                  <RadioGroup
                    value={String(settings.rounding_mode)}
                    onValueChange={(value) => handleFieldChange('rounding_mode', value)}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="NEAREST" id="nearest" />
                      <Label htmlFor="nearest">Nearest</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="UP" id="up" />
                      <Label htmlFor="up">Round Up</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="DOWN" id="down" />
                      <Label htmlFor="down">Round Down</Label>
                    </div>
                  </RadioGroup>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Other tabs - Coming Soon placeholders */}
        {/* SUPPLIERS & ORDERING TAB */}
        <TabsContent value="suppliers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Suppliers & Ordering</CardTitle>
                <CardDescription>Delivery windows and order cutoff times</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="inherit-suppliers">Inherit from Organization</Label>
                <Switch
                  id="inherit-suppliers"
                  checked={isFieldInherited('primary_suppliers')}
                  onCheckedChange={(checked) => {
                    handleInheritToggle('primary_suppliers', checked);
                    handleInheritToggle('delivery_windows', checked);
                    handleInheritToggle('order_cutoffs', checked);
                  }}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Default Order Lead Time (hours)</Label>
                {isFieldInherited('primary_suppliers') ? (
                  <div className="flex items-center gap-2">
                    <Input value="24" disabled />
                    <Badge>Inherited from Org</Badge>
                  </div>
                ) : (
                  <Input
                    type="number"
                    min="0"
                    max="168"
                    value={settings.order_lead_time_hours || 24}
                    onChange={(e) => handleFieldChange('order_lead_time_hours', parseInt(e.target.value))}
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  Minimum hours before delivery for new purchase orders
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WORKFORCE TAB */}
        <TabsContent value="workforce">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Workforce Defaults</CardTitle>
                <CardDescription>Trading hours, labour targets, and staff defaults</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="inherit-workforce">Inherit from Organization</Label>
                <Switch
                  id="inherit-workforce"
                  checked={isFieldInherited('labour_budget_percent')}
                  onCheckedChange={(checked) => {
                    handleInheritToggle('labour_budget_percent', checked);
                    handleInheritToggle('trading_hours', checked);
                  }}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="labour-budget">Labour Budget Target (%)</Label>
                  {isFieldInherited('labour_budget_percent') ? (
                    <div className="flex items-center gap-2">
                      <Input value="30" disabled />
                      <Badge>Inherited from Org</Badge>
                    </div>
                  ) : (
                    <Input
                      id="labour-budget"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={settings.labour_budget_percent || 30}
                      onChange={(e) => handleFieldChange('labour_budget_percent', parseFloat(e.target.value))}
                    />
                  )}
                  <p className="text-xs text-muted-foreground">
                    Target labour cost as percentage of revenue
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-weekly-hours">Max Weekly Hours per Staff</Label>
                  <Input
                    id="max-weekly-hours"
                    type="number"
                    min="0"
                    max="60"
                    value={settings.max_weekly_hours || 38}
                    onChange={(e) => handleFieldChange('max_weekly_hours', parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Award compliance: 38h ordinary + overtime
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="trading-open">Trading Hours — Open</Label>
                  <Input
                    id="trading-open"
                    type="time"
                    value={settings.trading_hours_open || '07:00'}
                    onChange={(e) => handleFieldChange('trading_hours_open', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="trading-close">Trading Hours — Close</Label>
                  <Input
                    id="trading-close"
                    type="time"
                    value={settings.trading_hours_close || '22:00'}
                    onChange={(e) => handleFieldChange('trading_hours_close', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* POS & PRINTERS TAB */}
        <TabsContent value="pos">
          <Card>
            <CardHeader>
              <CardTitle>POS & Printers</CardTitle>
              <CardDescription>Point of sale system and printer configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pos-type">POS System</Label>
                <Select
                  value={String(settings.pos_type || 'square')}
                  onValueChange={(value) => handleFieldChange('pos_type', value)}
                >
                  <SelectTrigger id="pos-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="square">Square</SelectItem>
                    <SelectItem value="lightspeed">Lightspeed</SelectItem>
                    <SelectItem value="kounta">Kounta</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pos-location-id">POS Location ID</Label>
                <Input
                  id="pos-location-id"
                  placeholder="e.g. LXXXXXXXXXXXXXXX"
                  value={settings.pos_location_id || ''}
                  onChange={(e) => handleFieldChange('pos_location_id', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Used for API sync when integration is connected
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CALENDAR TAB */}
        <TabsContent value="calendar">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Holidays & Trading Calendar</CardTitle>
                <CardDescription>Venue-specific closed dates and trading exceptions</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="inherit-calendar">Inherit from Organization</Label>
                <Switch
                  id="inherit-calendar"
                  checked={isFieldInherited('custom_closed_dates')}
                  onCheckedChange={(checked) => {
                    handleInheritToggle('custom_closed_dates', checked);
                  }}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isFieldInherited('custom_closed_dates') ? (
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">Using organization holiday calendar</p>
                  <Badge>Inherited from Org</Badge>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Additional Closed Dates</Label>
                  <p className="text-xs text-muted-foreground">
                    Add venue-specific closed dates in addition to organization holidays
                  </p>
                  {(settings.custom_closed_dates || []).map((date, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <span>{String(date)}</span>
                    </div>
                  ))}
                  <p className="text-sm text-muted-foreground italic">
                    No additional closed dates configured
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* GUARDRAILS TAB */}
        <TabsContent value="guardrails">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Guardrails & Approvals</CardTitle>
                <CardDescription>Venue-specific approval thresholds</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="inherit-guardrails">Inherit from Organization</Label>
                <Switch
                  id="inherit-guardrails"
                  checked={isFieldInherited('guardrails')}
                  onCheckedChange={(checked) => {
                    handleInheritToggle('guardrails', checked);
                  }}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isFieldInherited('guardrails') ? (
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">Using organization approval thresholds</p>
                  <Badge>Inherited from Org</Badge>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="max-po">Max PO Amount Without Approval ($)</Label>
                    <Input
                      id="max-po"
                      type="number"
                      min="0"
                      value={settings.max_po_without_approval || 500}
                      onChange={(e) => handleFieldChange('max_po_without_approval', parseInt(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max-waste">Max Waste Value Alert ($)</Label>
                    <Input
                      id="max-waste"
                      type="number"
                      min="0"
                      value={settings.max_waste_alert || 100}
                      onChange={(e) => handleFieldChange('max_waste_alert', parseInt(e.target.value))}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AUDIT TAB */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Audit Trail</CardTitle>
              <CardDescription>History of venue settings changes</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                All changes to venue settings are recorded with timestamps and actor information.
                Settings are versioned — each save creates a snapshot that can be compared or rolled back.
              </p>
              <div className="mt-4 p-4 rounded-lg bg-muted/30 text-center">
                <p className="text-sm text-muted-foreground">
                  Audit entries appear here after saving or publishing settings
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
      {/* Clone Venue Dialog */}
      {cloneSourceVenue && (
        <CloneVenueDialog
          open={cloneDialogOpen}
          onOpenChange={setCloneDialogOpen}
          sourceVenue={cloneSourceVenue}
        />
      )}

      {/* Save as Template Dialog */}
      {selectedVenue && (
        <SaveAsTemplateDialog
          open={templateDialogOpen}
          onOpenChange={setTemplateDialogOpen}
          venueId={selectedVenue}
          venueName={venues.find((v) => v.id === selectedVenue)?.name || ''}
          orgId={currentVenue?.org_id || venues[0]?.org_id || ''}
          userId={user?.id || ''}
        />
      )}
    </PageShell>
  );
}
