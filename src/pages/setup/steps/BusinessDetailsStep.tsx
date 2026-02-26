import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from 'sonner'
import { Loader2 } from "lucide-react";

const businessSchema = z.object({
  name: z.string().min(1, "Organisation name is required"),
  abn: z
    .string()
    .regex(/^\d{11}$/, "ABN must be exactly 11 digits")
    .or(z.literal("")),
  gst_registered: z.boolean(),
  contact_email: z.string().email("Invalid email").or(z.literal("")),
  contact_phone: z.string().or(z.literal("")),
});

type BusinessFormData = z.infer<typeof businessSchema>;

interface Props {
  orgId: string;
  onNext: () => void;
}

export default function BusinessDetailsStep({ orgId, onNext }: Props) {
;
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
      contact_email: "",
      contact_phone: "",
    },
  });

  const gstRegistered = watch("gst_registered");

  useEffect(() => {
    const loadOrg = async () => {
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
        setValue("gst_registered", (settings.gst_registered as boolean) ?? false);
        setValue("contact_email", (settings.contact_email as string) ?? "");
        setValue("contact_phone", (settings.contact_phone as string) ?? "");
      }
    };
    loadOrg();
  }, [orgId, setValue]);

  const onSubmit = async (formData: BusinessFormData) => {
    setSaving(true);
    try {
      // First get existing settings to merge
      const { data: existing } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", orgId)
        .single();

      const existingSettings = ((existing as Record<string, unknown>)?.settings as Record<string, unknown>) ?? {};

      const { error } = await supabase
        .from("organizations")
        .update({
          name: formData.name,
          settings: {
            ...existingSettings,
            abn: formData.abn,
            gst_registered: formData.gst_registered,
            contact_email: formData.contact_email,
            contact_phone: formData.contact_phone,
          },
        } as Record<string, unknown>)
        .eq("id", orgId);

      if (error) throw error;

      toast.success("Business details saved");
      onNext();
    } catch (err) {
      toast.success("Error saving", { description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive", });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold mb-4">Business Details</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="name">Organisation Name *</Label>
          <Input id="name" {...register("name")} />
          {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
        </div>

        <div>
          <Label htmlFor="abn">ABN</Label>
          <Input id="abn" placeholder="11-digit ABN" {...register("abn")} />
          {errors.abn && <p className="text-sm text-destructive mt-1">{errors.abn.message}</p>}
        </div>

        <div className="flex items-center gap-3">
          <Switch
            id="gst"
            checked={gstRegistered}
            onCheckedChange={(checked) => setValue("gst_registered", checked)}
          />
          <Label htmlFor="gst">GST Registered</Label>
        </div>

        <div>
          <Label htmlFor="contact_email">Contact Email</Label>
          <Input id="contact_email" type="email" {...register("contact_email")} />
          {errors.contact_email && <p className="text-sm text-destructive mt-1">{errors.contact_email.message}</p>}
        </div>

        <div>
          <Label htmlFor="contact_phone">Contact Phone</Label>
          <Input id="contact_phone" type="tel" {...register("contact_phone")} />
        </div>

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Next
          </Button>
        </div>
      </form>
    </Card>
  );
}
