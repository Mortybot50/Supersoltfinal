import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, MapPin, Building2 } from "lucide-react";
import { fetchVenueTemplates, type VenueTemplate } from "@/lib/venueTemplates";

const AU_TIMEZONES = [
  { value: "Australia/Melbourne", label: "Melbourne (AEST/AEDT)" },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
  { value: "Australia/Brisbane", label: "Brisbane (AEST)" },
  { value: "Australia/Adelaide", label: "Adelaide (ACST/ACDT)" },
  { value: "Australia/Darwin", label: "Darwin (ACST)" },
  { value: "Australia/Perth", label: "Perth (AWST)" },
  { value: "Australia/Hobart", label: "Hobart (AEST/AEDT)" },
] as const;

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const venueSchema = z
  .object({
    name: z.string().min(1, "Venue name is required"),
    address: z.string().optional(),
    timezone: z.string().min(1, "Timezone is required"),
    // New organization fields
    createNewOrg: z.boolean().default(false),
    newOrgName: z.string().optional(),
    newOrgAbn: z.string().optional(),
    newOrgGst: z.boolean().default(false),
  })
  .refine(
    (data) => {
      // If creating new org, org name is required
      if (data.createNewOrg) {
        return !!data.newOrgName && data.newOrgName.length > 0;
      }
      return true;
    },
    {
      message: "Organization name is required when creating a new organization",
      path: ["newOrgName"],
    },
  );

type VenueFormData = z.infer<typeof venueSchema>;

interface ExistingVenue {
  id: string;
  name: string;
  address: string | null;
  timezone: string | null;
  org_name?: string;
}

interface Organization {
  id: string;
  name: string;
  abn?: string;
}

interface Props {
  orgId: string;
  userId: string;
  onNext: () => void;
  onBack: () => void;
}

export default function AddVenuesStep({
  orgId,
  userId,
  onNext,
  onBack,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [venues, setVenues] = useState<ExistingVenue[]>([]);
  const [userOrgs, setUserOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  // Trading hours removed from signup - can be added later in venue settings
  const [templates, setTemplates] = useState<VenueTemplate[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<VenueFormData>({
    resolver: zodResolver(venueSchema),
    defaultValues: {
      name: "",
      address: "",
      timezone: "Australia/Melbourne",
      createNewOrg: false,
      newOrgName: "",
      newOrgAbn: "",
      newOrgGst: false,
    },
  });

  const selectedTimezone = watch("timezone");
  const createNewOrg = watch("createNewOrg");

  useEffect(() => {
    const loadData = async () => {
      // Load user's organizations
      const { data: orgs } = await supabase
        .from("org_members")
        .select("org_id, organizations(id, name, settings)")
        .eq("user_id", userId);

      if (orgs) {
        const organizations = orgs.map((om) => {
          const org = (om as any).organizations;
          return {
            id: org.id,
            name: org.name,
            abn: org.settings?.abn,
          };
        });
        setUserOrgs(organizations);
      }

      // Load all venues for this user's organizations
      const orgIds = orgs?.map((om) => om.org_id) || [orgId];
      const { data: venueData } = await supabase
        .from("venues")
        .select("*, organizations(name)")
        .in("org_id", orgIds)
        .eq("is_active", true);

      if (venueData) {
        setVenues(
          venueData.map((v) => {
            const row = v as Record<string, unknown>;
            const org = row.organizations as { name: string };
            return {
              id: row.id as string,
              name: row.name as string,
              address: (row.address as string) ?? null,
              timezone: (row.timezone as string) ?? null,
              org_name: org?.name,
            };
          }),
        );
      }
      setLoading(false);
    };

    loadData();
    fetchVenueTemplates(orgId).then(setTemplates).catch(console.error);
  }, [orgId, userId]);

  const onSubmit = async (formData: VenueFormData) => {
    setSaving(true);
    try {
      let targetOrgId = orgId;

      // If creating new organization first
      if (formData.createNewOrg) {
        // Create the new organization
        const { data: newOrg, error: orgError } = await supabase
          .from("organizations")
          .insert({
            name: formData.newOrgName!,
            settings: {
              abn: formData.newOrgAbn || "",
              gst_registered: formData.newOrgGst,
            },
          })
          .select()
          .single();

        if (orgError) throw orgError;

        // Add user as owner of new organization
        const { error: memberError } = await supabase
          .from("org_members")
          .insert({
            org_id: newOrg.id,
            user_id: userId,
            role: "owner",
            is_active: true,
          });

        if (memberError) throw memberError;

        targetOrgId = newOrg.id;

        // Add to user's organizations list
        setUserOrgs((prev) => [
          ...prev,
          {
            id: newOrg.id,
            name: formData.newOrgName!,
            abn: formData.newOrgAbn,
          },
        ]);

        toast.success(`New organization "${formData.newOrgName}" created`);
      }

      // Create the venue
      const { data, error } = await supabase
        .from("venues")
        .insert({
          name: formData.name,
          org_id: targetOrgId,
          address: formData.address ?? null,
          timezone: formData.timezone,
          trading_hours: null, // Trading hours can be added later in venue settings
          created_by: userId,
        } as Record<string, unknown>)
        .select("*, organizations(name)")
        .single();

      if (error) throw error;

      const row = data as Record<string, unknown>;
      const org = row.organizations as { name: string };
      setVenues((prev) => [
        ...prev,
        {
          id: row.id as string,
          name: row.name as string,
          address: (row.address as string) ?? null,
          timezone: (row.timezone as string) ?? null,
          org_name: org?.name,
        },
      ]);

      reset({
        name: "",
        address: "",
        timezone: "Australia/Melbourne",
        createNewOrg: false,
        newOrgName: "",
        newOrgAbn: "",
        newOrgGst: false,
      });
      // Trading hours removed from signup flow
      toast.success("Venue added");
    } catch (err) {
      toast.error("Error adding venue", {
        description: err instanceof Error ? err.message : "Unknown error",
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
      toast.success("Venue removed");
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
            <div
              key={venue.id}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <div>
                  <span className="font-medium">{venue.name}</span>
                  {venue.org_name && (
                    <span className="text-xs text-muted-foreground ml-2">
                      ({venue.org_name})
                    </span>
                  )}
                  {venue.address && (
                    <span className="text-sm text-muted-foreground ml-2">
                      {venue.address}
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeVenue(venue.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Toggle for new organization */}
        <div className="flex items-center space-x-2 p-4 border rounded-lg bg-muted/20">
          <Checkbox
            id="createNewOrg"
            checked={createNewOrg}
            onCheckedChange={(checked) => setValue("createNewOrg", !!checked)}
          />
          <Label
            htmlFor="createNewOrg"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            Add this venue to a new organization (different ABN)
          </Label>
        </div>

        {/* New Organization Fields */}
        {createNewOrg && (
          <div className="space-y-4 p-4 border-2 border-primary/20 rounded-lg bg-primary/5">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-primary" />
              <Label className="text-base font-medium">
                New Organization Details
              </Label>
            </div>

            <div>
              <Label htmlFor="newOrgName">Organization Name *</Label>
              <Input
                id="newOrgName"
                placeholder="e.g. My Second Business Pty Ltd"
                {...register("newOrgName")}
              />
              {errors.newOrgName && (
                <p className="text-sm text-destructive mt-1">
                  {errors.newOrgName.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="newOrgAbn">ABN</Label>
              <Input
                id="newOrgAbn"
                placeholder="11-digit ABN"
                {...register("newOrgAbn")}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="newOrgGst"
                checked={watch("newOrgGst")}
                onCheckedChange={(checked) => setValue("newOrgGst", checked)}
              />
              <Label htmlFor="newOrgGst">GST Registered</Label>
            </div>
          </div>
        )}

        {/* Venue Details */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="venueName">Venue Name *</Label>
            <Input
              id="venueName"
              placeholder="e.g. Main Street Store"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-destructive mt-1">
                {errors.name.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              placeholder="123 Main St, Melbourne VIC 3000"
              {...register("address")}
            />
          </div>

          <div>
            <Label>Timezone *</Label>
            <Select
              value={selectedTimezone}
              onValueChange={(val) => setValue("timezone", val)}
            >
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


        </div>

        <Button
          type="submit"
          variant="outline"
          disabled={saving}
          className="w-full"
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          {createNewOrg ? "Add Venue & Create Organization" : "Add Venue"}
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
