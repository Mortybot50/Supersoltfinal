import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
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
import { 
  Loader2, 
  Plus, 
  Trash2, 
  MapPin, 
  Building2, 
  ArrowRight, 
  ArrowLeft,
  CheckCircle2,
  Clock 
} from "lucide-react";
import { cn } from "@/lib/utils";
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
  const venueName = watch("name");
  const venueAddress = watch("address");

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
      <div className="p-8 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 lg:p-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 bg-primary/10 rounded-xl">
            <MapPin className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-2xl font-bold">Add Your Venues</h2>
        </div>
        <p className="text-muted-foreground">
          Add one or more locations where your business operates. You can always
          add more venues later.
        </p>
      </div>

      {/* Existing Venues */}
      {venues.length > 0 && (
        <div className="space-y-3 mb-8">
          <Label className="text-base font-medium">Your Venues</Label>
          <div className="grid gap-3">
            {venues.map((venue) => (
              <div
                key={venue.id}
                className="group flex items-center justify-between p-4 border rounded-xl hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/5 rounded-lg mt-0.5">
                    <MapPin className="w-4 h-4 text-primary/70" />
                  </div>
                  <div>
                    <p className="font-medium">{venue.name}</p>
                    {venue.org_name && (
                      <p className="text-xs text-muted-foreground">
                        {venue.org_name}
                      </p>
                    )}
                    {venue.address && (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {venue.address}
                      </p>
                    )}
                    {venue.timezone && (
                      <div className="flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {AU_TIMEZONES.find((tz) => tz.value === venue.timezone)?.label || venue.timezone}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeVenue(venue.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {venues.length} {venues.length === 1 ? "venue" : "venues"} added
          </p>
        </div>
      )}

      {/* Add Venue Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Toggle for new organization */}
        {userOrgs.length > 0 && (
          <div className="p-4 border rounded-xl bg-muted/20">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="createNewOrg"
                checked={createNewOrg}
                onCheckedChange={(checked) => setValue("createNewOrg", !!checked)}
                className="mt-0.5"
              />
              <div>
                <Label
                  htmlFor="createNewOrg"
                  className="text-sm font-medium cursor-pointer"
                >
                  Add to a new organization
                </Label>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Use this if the venue operates under a different ABN
                </p>
              </div>
            </div>
          </div>
        )}

        {/* New Organization Fields */}
        {createNewOrg && (
          <div className="space-y-4 p-6 border-2 border-primary/20 rounded-xl bg-primary/5">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-5 h-5 text-primary" />
              <Label className="text-base font-medium">
                New Organization Details
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newOrgName">
                Organization Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="newOrgName"
                placeholder="e.g. My Second Business Pty Ltd"
                {...register("newOrgName")}
                className="h-11"
              />
              {errors.newOrgName && (
                <p className="text-sm text-destructive mt-1">
                  {errors.newOrgName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="newOrgAbn">ABN</Label>
              <Input
                id="newOrgAbn"
                placeholder="11-digit ABN"
                {...register("newOrgAbn")}
                className="h-11"
              />
            </div>

            <div className="flex items-center space-x-3">
              <Switch
                id="newOrgGst"
                checked={watch("newOrgGst")}
                onCheckedChange={(checked) => setValue("newOrgGst", checked)}
              />
              <Label htmlFor="newOrgGst" className="cursor-pointer">
                GST Registered
              </Label>
            </div>
          </div>
        )}

        {/* Venue Details */}
        <div className="space-y-6 bg-muted/5 rounded-xl p-6">
          <h3 className="font-medium text-lg">New Venue Details</h3>
          
          <div className="space-y-2">
            <Label htmlFor="venueName" className="text-base">
              Venue Name <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="venueName"
                placeholder="e.g. Main Street Store"
                {...register("name")}
                className={cn(
                  "h-12 text-base",
                  errors.name && "border-destructive"
                )}
              />
              {venueName && !errors.name && (
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
              )}
            </div>
            {errors.name && (
              <p className="text-sm text-destructive mt-1">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="address" className="text-base">
              Address
            </Label>
            <div className="relative">
              <Input
                id="address"
                placeholder="123 Main St, Melbourne VIC 3000"
                {...register("address")}
                className="h-12 text-base"
              />
              {venueAddress && (
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-base">
              Timezone <span className="text-destructive">*</span>
            </Label>
            <Select
              value={selectedTimezone}
              onValueChange={(val) => setValue("timezone", val)}
            >
              <SelectTrigger className="h-12 text-base">
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

          <Button
            type="submit"
            variant="outline"
            disabled={saving}
            className="w-full h-12"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding Venue...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                {createNewOrg ? "Add Venue & Create Organization" : "Add Venue"}
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Progress indicator */}
      <div className="pt-6 pb-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="w-4 h-4" />
          <span>Step 2 of 5 • Add Venues</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between pt-6 border-t">
        <Button 
          variant="ghost" 
          onClick={onBack}
          size="lg"
          className="h-12"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button 
          onClick={onNext} 
          disabled={venues.length === 0}
          size="lg"
          className="min-w-[140px] h-12 text-base font-medium"
        >
          Next Step
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}