import { useState } from 'react';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner'
import { createVenueTemplate } from '@/lib/venueTemplates';
import { supabase } from '@/integrations/supabase/client';

const templateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(100),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venueId: string;
  venueName: string;
  orgId: string;
  userId: string;
}

export default function SaveAsTemplateDialog({ open, onOpenChange, venueId, venueName, orgId, userId }: Props) {
  const [name, setName] = useState(venueName ? `${venueName} Template` : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    const result = templateSchema.safeParse({ name });
    if (!result.success) {
      setError(result.error.errors[0]?.message ?? 'Invalid');
      return;
    }
    setError('');
    setSaving(true);

    try {
      // Fetch venue data to build template
      const { data: venueData, error: fetchErr } = await supabase
        .from('venues')
        .select('*')
        .eq('id', venueId)
        .single();

      if (fetchErr) throw fetchErr;
      const v = venueData as Record<string, unknown>;

      await createVenueTemplate({
        orgId,
        name: name.trim(),
        templateData: {
          timezone: v.timezone as string | undefined,
          trading_hours: v.trading_hours as Record<string, { open: string; close: string }> | undefined,
          venue_type: v.venue_type as string | undefined,
        },
        createdBy: userId,
      });

      toast.success('Template saved', { description: `"${name}" can now be applied when creating new venues.` });
      onOpenChange(false);
      setName('');
    } catch (err) {
      console.error('Save template error:', err);
      toast.error('Error', { description: 'Failed to save template' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Save the current venue configuration as a reusable template for creating new venues.
          </p>
          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name *</Label>
            <Input
              id="template-name"
              placeholder='e.g. "CBD Café", "Shopping Centre Store"'
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
