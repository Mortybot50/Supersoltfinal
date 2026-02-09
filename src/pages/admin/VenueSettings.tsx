import React, { useState, useEffect } from "react";
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
import { toast } from "@/hooks/use-toast";
import { Save, UploadCloud, RotateCcw } from "lucide-react";
import type { VenueSettings as VenueSettingsType } from "@/lib/venueSettings";
import { getDefaultOrgSettings } from "@/lib/venueSettings";

export default function VenueSettings() {
  const [selectedVenue, setSelectedVenue] = useState("venue-1");
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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const orgSettings = getDefaultOrgSettings();

  useEffect(() => {
    loadVenueSettings();
  }, [selectedVenue]);

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
      toast({
        title: "Error",
        description: "Failed to load venue settings",
        variant: "destructive",
      });
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

      toast({
        title: "Settings Saved",
        description: "Settings saved (not published)",
      });
      setHasUnsavedChanges(false);
      setOriginalSettings(settings);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
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
        actor_user_id: 'current-user', // TODO: Get from auth
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

      toast({
        title: "Settings Published",
        description: `Settings published to ${selectedVenue}`,
      });
      setHasUnsavedChanges(false);
      await loadVenueSettings();
    } catch (error) {
      console.error('Error publishing settings:', error);
      toast({
        title: "Error",
        description: "Failed to publish settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSettings(originalSettings);
    setHasUnsavedChanges(false);
    toast({
      title: "Changes Discarded",
      description: "Reverted to last saved settings",
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Venue Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure venue-specific settings or inherit from organization defaults
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <Badge variant="outline" className="text-warning">
              Unsaved Changes
            </Badge>
          )}
          <Button
            variant="ghost"
            onClick={handleReset}
            disabled={!hasUnsavedChanges || isLoading}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button
            variant="secondary"
            onClick={handleSave}
            disabled={!hasUnsavedChanges || isLoading}
          >
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
          <Button
            onClick={handlePublish}
            disabled={isLoading}
          >
            <UploadCloud className="h-4 w-4 mr-2" />
            Publish to Venue
          </Button>
        </div>
      </div>

      {/* Venue Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Venue</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedVenue} onValueChange={setSelectedVenue}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="venue-1">Venue 1</SelectItem>
              <SelectItem value="venue-2">Venue 2</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="locale" className="space-y-6">
        <TabsList>
          <TabsTrigger value="locale">Locale & Display</TabsTrigger>
          <TabsTrigger value="menu">Menu & Pricing</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers & Ordering</TabsTrigger>
          <TabsTrigger value="workforce">Workforce</TabsTrigger>
          <TabsTrigger value="pos">POS & Printers</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="guardrails">Guardrails</TabsTrigger>
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
        <TabsContent value="suppliers">
          <Card>
            <CardHeader>
              <CardTitle>Suppliers & Ordering</CardTitle>
              <CardDescription>Coming soon</CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>

        <TabsContent value="workforce">
          <Card>
            <CardHeader>
              <CardTitle>Workforce Defaults</CardTitle>
              <CardDescription>Coming soon</CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>

        <TabsContent value="pos">
          <Card>
            <CardHeader>
              <CardTitle>POS & Printers</CardTitle>
              <CardDescription>Coming soon</CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>

        <TabsContent value="calendar">
          <Card>
            <CardHeader>
              <CardTitle>Holidays & Trading Calendar</CardTitle>
              <CardDescription>Coming soon</CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>

        <TabsContent value="guardrails">
          <Card>
            <CardHeader>
              <CardTitle>Guardrails & Approvals</CardTitle>
              <CardDescription>Coming soon</CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Audit Trail</CardTitle>
              <CardDescription>Coming soon</CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
