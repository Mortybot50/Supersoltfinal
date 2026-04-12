import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Building2, FileText, CheckCircle2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const businessSchema = z.object({
  name: z.string().min(1, "Organisation name is required"),
  abn: z
    .string()
    .regex(/^\d{11}$/, "ABN must be exactly 11 digits")
    .or(z.literal("")),
  gst_registered: z.boolean(),
});

type BusinessFormData = z.infer<typeof businessSchema>;

interface Props {
  orgId: string;
  onNext: () => void;
}

export default function BusinessDetailsStep({ orgId, onNext }: Props) {
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BusinessFormData>({
    resolver: zodResolver(businessSchema),
    defaultValues: {
      name: "",
      abn: "",
      gst_registered: false,
    },
  });

  const gstRegistered = watch("gst_registered");
  const nameValue = watch("name");
  const abnValue = watch("abn");

  useEffect(() => {
    const loadOrg = async () => {
      // Only load if we have an orgId (existing org)
      if (!orgId || orgId === "") return;

      const { data } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", orgId)
        .single();

      if (data) {
        const orgData = data as Record<string, unknown>;
        const settings = (orgData.settings as Record<string, unknown>) ?? {};
        setValue("name", (orgData.name as string) ?? "");
        setValue("abn", (settings.abn as string) ?? "");
        setValue(
          "gst_registered",
          (settings.gst_registered as boolean) ?? false,
        );
      }
    };
    loadOrg();
  }, [orgId, setValue]);

  const onSubmit = async (formData: BusinessFormData) => {
    setSaving(true);
    try {
      // Check if we're updating existing or creating new
      if (orgId && orgId !== "") {
        // Update existing organization
        const { data: existing } = await supabase
          .from("organizations")
          .select("*")
          .eq("id", orgId)
          .single();

        const existingSettings =
          ((existing as Record<string, unknown>)?.settings as Record<
            string,
            unknown
          >) ?? {};

        const { error } = await supabase
          .from("organizations")
          .update({
            name: formData.name,
            settings: {
              ...existingSettings,
              abn: formData.abn,
              gst_registered: formData.gst_registered,
            },
          } as Record<string, unknown>)
          .eq("id", orgId);

        if (error) throw error;
      } else {
        // Create new organization for new signups
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          throw new Error("No authenticated user found. Please login first.");
        }

        const userId = user.id;

        const { data: newOrg, error: createError } = await supabase
          .from("organizations")
          .insert({
            name: formData.name,
            settings: {
              abn: formData.abn,
              gst_registered: formData.gst_registered,
            },
          })
          .select()
          .single();

        if (createError) throw createError;

        // Also create the org_member record
        const { error: memberError } = await supabase
          .from("org_members")
          .insert({
            org_id: newOrg.id,
            user_id: userId,
            role: "owner",
            is_active: true,
          });

        if (memberError) throw memberError;

        // Reload the page to refresh auth context with the new org
        window.location.reload();
      }

      toast.success("Business details saved");
      onNext();
    } catch (err) {
      console.error("Business details error:", err);
      toast.error("Error saving", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 bg-primary/10 rounded-xl">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-2xl font-bold">Business Details</h2>
        </div>
        <p className="text-muted-foreground">
          Tell us about your organisation. This information helps us customize
          SuperSolt for your business needs.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Organization Name */}
        <div className="space-y-2">
          <Label 
            htmlFor="name" 
            className="text-base font-medium flex items-center gap-2"
          >
            Organisation Name
            <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Input
              id="name"
              {...register("name")}
              className={cn(
                "h-12 text-base px-4",
                errors.name && "border-destructive focus:ring-destructive"
              )}
              placeholder="e.g. Piccolo Panini Bar Pty Ltd"
            />
            {nameValue && !errors.name && (
              <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
            )}
          </div>
          {errors.name && (
            <p className="text-sm text-destructive mt-1 flex items-center gap-1">
              <span className="inline-block w-1 h-1 bg-destructive rounded-full" />
              {errors.name.message}
            </p>
          )}
        </div>

        {/* ABN Section */}
        <div className="space-y-2">
          <Label 
            htmlFor="abn" 
            className="text-base font-medium flex items-center gap-2"
          >
            <FileText className="w-4 h-4 text-muted-foreground" />
            Australian Business Number (ABN)
          </Label>
          <div className="relative">
            <Input
              id="abn"
              {...register("abn")}
              className={cn(
                "h-12 text-base px-4",
                errors.abn && "border-destructive focus:ring-destructive"
              )}
              placeholder="12345678901"
              maxLength={11}
            />
            {abnValue && abnValue.length === 11 && !errors.abn && (
              <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
            )}
          </div>
          {errors.abn && (
            <p className="text-sm text-destructive mt-1 flex items-center gap-1">
              <span className="inline-block w-1 h-1 bg-destructive rounded-full" />
              {errors.abn.message}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Enter your 11-digit ABN without spaces
          </p>
        </div>

        {/* GST Registration */}
        <div className="bg-muted/30 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="gst" className="text-base font-medium cursor-pointer">
                GST Registered
              </Label>
              <p className="text-sm text-muted-foreground">
                Turn this on if your business is registered for GST
              </p>
            </div>
            <Switch
              id="gst"
              checked={gstRegistered}
              onCheckedChange={(checked) => setValue("gst_registered", checked)}
              className="data-[state=checked]:bg-primary"
            />
          </div>
        </div>

        {/* Progress indicator */}
        <div className="pt-4 pb-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="w-4 h-4" />
            <span>Step 1 of 5 • Business Details</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end pt-6 border-t">
          <Button 
            type="submit" 
            disabled={saving}
            size="lg"
            className="min-w-[140px] h-12 text-base font-medium"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Next Step
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}