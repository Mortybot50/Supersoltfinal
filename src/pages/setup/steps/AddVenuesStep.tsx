import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Plus, Trash2, MapPin } from "lucide-react";

const AU_TIMEZONES = [
  { value: "Australia/Melbourne", label: "Melbourne (AEST/AEDT)" },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
  { value: "Australia/Brisbane", label: "Brisbane (AEST)" },
  { value: "Australia/Adelaide", label: "Adelaide (ACST/ACDT)" },
  { value: "Australia/Darwin", label: "Darwin (ACST)" },
  { value: "Australia/Perth", label: "Perth (AWST)" },
  { value: "Australia/Hobart", label: "Hobart (AEST/AEDT)" },
] as const;

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

const venueSchema = z.object({
  name: z.string().min(1, "Venue name is required"),
  address: z.string().optional(),
  timezone: z.string().min(1, "Timezone is required"),
});

type VenueFormData = z.infer<typeof venueSchema>;

interface ExistingVenue {
  id: string;
  name: string;
  address: string | null;
  timezone: string | null;
}

interface Props {
  orgId: string;
  userId: string;
  onNext: () => void;
  onBack: () => void;
}

export default function AddVenuesStep({ orgId, userId, onNext, onBack }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [venues, setVenues] = useState<ExistingVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [tradingHours, setTradingHours] = useState<Record<string, { open: string; close: string }>>(
    Object.fromEntries(DAYS.map((d) => [d, { open: "09:00", close: "22:00" }]))
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<VenueFormData>({
    resolver: zodResolver(venueSchema),
    defaultValues: { name: "", address: "", timezone: "Australia/Melbourne" },
  });

  const selectedTimezone = watch("timezone");

  useEffect(() => {
    const loadVenues = async () => {
      const { data } = await supabase
        .from("venues")
        .select("*")
        .eq("org_id", orgId)
        .eq("is_active", true);

      if (data) {
        setVenues(
          data.map((v) => {
            const row = v as Record<string, unknown>;
            return {
              id: row.id as string,
              name: row.name as string,
              address: (row.address as string) ?? null,
              timezone: (row.timezone as string) ?? null,
            };
          })
        );
      }
      setLoading(false);
    };
    loadVenues();
  }, [orgId]);

  const onSubmit = async (formData: VenueFormData) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("venues")
        .insert({
          name: formData.name,
          org_id: orgId,
          address: formData.address ?? null,
          timezone: formData.timezone,
          trading_hours: tradingHours,
          created_by: userId,
        } as Record<string, unknown>)
        .select("*")
        .single();

      if (error) throw error;

      const row = data as Record<string, unknown>;
      setVenues((prev) => [
        ...prev,
        {
          id: row.id as string,
          name: row.name as string,
          address: (row.address as string) ?? null,
          timezone: (row.timezone as string) ?? null,
        },
      ]);

      reset({ name: "", address: "", timezone: "Australia/Melbourne" });
      setTradingHours(Object.fromEntries(DAYS.map((d) => [d, { open: "09:00", close: "22:00" }])));
      toast({ title: "Venue added" });
    } catch (err) {
      toast({
        title: "Error adding venue",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const removeVenue = async (venueId: string) => {
    const { error } = await supabase
      .from("venues")
      .update({ is_active: false })
      .eq("id", venueId);

    if (!error) {
      setVenues((prev) => prev.filter((v) => v.id !== venueId));
      toast({ title: "Venue removed" });
    }
  };

  if (loading) {
    return (
      <Card className="p-6 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold mb-4">Add Venues</h2>

      {venues.length > 0 && (
        <div className="space-y-2 mb-6">
          <Label className="text-sm font-medium">Your Venues</Label>
          {venues.map((venue) => (
            <div key={venue.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <div>
                  <span className="font-medium">{venue.name}</span>
                  {venue.address && (
                    <span className="text-sm text-muted-foreground ml-2">{venue.address}</span>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeVenue(venue.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="venueName">Venue Name *</Label>
          <Input id="venueName" placeholder="e.g. Main Street Store" {...register("name")} />
          {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
        </div>

        <div>
          <Label htmlFor="address">Address</Label>
          <Input id="address" placeholder="123 Main St, Melbourne VIC 3000" {...register("address")} />
        </div>

        <div>
          <Label>Timezone *</Label>
          <Select value={selectedTimezone} onValueChange={(val) => setValue("timezone", val)}>
            <SelectTrigger>
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

        <div>
          <Label className="text-sm font-medium">Trading Hours</Label>
          <div className="grid grid-cols-1 gap-2 mt-2">
            {DAYS.map((day) => (
              <div key={day} className="flex items-center gap-2">
                <span className="w-24 text-sm">{day}</span>
                <Input
                  type="time"
                  className="w-28"
                  value={tradingHours[day]?.open ?? "09:00"}
                  onChange={(e) =>
                    setTradingHours((prev) => ({
                      ...prev,
                      [day]: { ...prev[day], open: e.target.value },
                    }))
                  }
                />
                <span className="text-sm text-muted-foreground">to</span>
                <Input
                  type="time"
                  className="w-28"
                  value={tradingHours[day]?.close ?? "22:00"}
                  onChange={(e) =>
                    setTradingHours((prev) => ({
                      ...prev,
                      [day]: { ...prev[day], close: e.target.value },
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </div>

        <Button type="submit" variant="outline" disabled={saving} className="w-full">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Add Venue
        </Button>
      </form>

      <div className="flex justify-between pt-6">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={venues.length === 0}>
          Next
        </Button>
      </div>
    </Card>
  );
}
