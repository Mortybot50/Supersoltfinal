import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
const cloneSchema = z.object({
  name: z.string().min(1, "Venue name is required").max(100),
  address: z.string().min(1, "Address is required"),
});

interface SourceVenue {
  id: string;
  name: string;
  org_id: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceVenue: SourceVenue;
}

export default function CloneVenueDialog({
  open,
  onOpenChange,
  sourceVenue,
}: Props) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleClone = async () => {
    const result = cloneSchema.safeParse({ name, address });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach((e) => {
        errs[e.path[0] as string] = e.message;
      });
      setErrors(errs);
      return;
    }
    setErrors({});
    setSaving(true);

    try {
      // Fetch source venue full data
      const { data: srcData, error: srcErr } = await supabase
        .from("venues")
        .select("*")
        .eq("id", sourceVenue.id)
        .single();

      if (srcErr) throw srcErr;
      const src = srcData as Record<string, unknown>;

      // Create cloned venue — copy trading_hours, timezone, venue_type
      const { error: insertErr } = await supabase.from("venues").insert({
        org_id: sourceVenue.org_id,
        name: name.trim(),
        is_active: true,
        address: address.trim(),
        timezone: src.timezone ?? null,
        trading_hours: src.trading_hours ?? null,
        venue_type: src.venue_type ?? null,
      } as Record<string, unknown>);

      if (insertErr) throw insertErr;

      toast.success("Venue cloned", {
        description: `${name} created from ${sourceVenue.name}. Refresh to see it.`,
      });
      onOpenChange(false);
      setName("");
      setAddress("");
      window.location.reload();
    } catch (err) {
      console.error("Clone venue error:", err);
      toast.error("Error", { description: "Failed to clone venue" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clone Venue: {sourceVenue.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Copies trading hours, timezone, and venue type. Does NOT copy staff,
            rosters, or transactions.
          </p>
          <div className="space-y-2">
            <Label htmlFor="clone-name">New Venue Name *</Label>
            <Input
              id="clone-name"
              placeholder="e.g. Southbank Store"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="clone-address">Address *</Label>
            <Input
              id="clone-address"
              placeholder="456 Southbank Blvd, Southbank VIC 3006"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            {errors.address && (
              <p className="text-sm text-destructive">{errors.address}</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleClone} disabled={saving}>
            {saving ? "Cloning..." : "Clone Venue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
