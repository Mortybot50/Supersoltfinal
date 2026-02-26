import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Building2, CheckCircle, Loader2, MapPin, ShoppingCart, Users } from "lucide-react";

interface OrgDetails {
  name: string;
  abn: string;
  gst_registered: boolean;
  contact_email: string;
  contact_phone: string;
}

interface VenueSummary {
  id: string;
  name: string;
}

interface Props {
  orgId: string;
  onBack: () => void;
  onGoLive: () => void;
}

export default function ReviewStep({ orgId, onBack, onGoLive }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgDetails, setOrgDetails] = useState<OrgDetails | null>(null);
  const [venues, setVenues] = useState<VenueSummary[]>([]);
  const [posConnected, setPosConnected] = useState(false);
  const [inviteCount, setInviteCount] = useState(0);

  useEffect(() => {
    const loadSummary = async () => {
      const [orgRes, venueRes, posRes, inviteRes] = await Promise.all([
        supabase.from("organizations").select("*").eq("id", orgId).single(),
        supabase.from("venues").select("id, name").eq("org_id", orgId).eq("is_active", true),
        supabase.from("pos_connections").select("id").eq("org_id", orgId).eq("is_active", true).limit(1),
        supabase.from("staff_invites").select("id").eq("org_id", orgId).is("completed_at", null),
      ]);

      if (orgRes.data) {
        const orgData = orgRes.data as Record<string, unknown>;
        const settings = (orgData.settings as Record<string, unknown>) ?? {};
        setOrgDetails({
          name: (orgData.name as string) ?? "",
          abn: (settings.abn as string) ?? "",
          gst_registered: (settings.gst_registered as boolean) ?? false,
          contact_email: (settings.contact_email as string) ?? "",
          contact_phone: (settings.contact_phone as string) ?? "",
        });
      }

      setVenues(venueRes.data?.map((v) => ({ id: v.id, name: v.name })) ?? []);
      setPosConnected((posRes.data?.length ?? 0) > 0);
      setInviteCount(inviteRes.data?.length ?? 0);
      setLoading(false);
    };
    loadSummary();
  }, [orgId]);

  const handleGoLive = async () => {
    setSaving(true);
    try {
      // Get existing settings and merge
      const { data: existing } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", orgId)
        .single();

      const existingSettings = ((existing as Record<string, unknown>)?.settings as Record<string, unknown>) ?? {};

      const { error } = await supabase
        .from("organizations")
        .update({
          settings: {
            ...existingSettings,
            onboarding_completed: true,
            onboarding_completed_at: new Date().toISOString(),
          },
        } as Record<string, unknown>)
        .eq("id", orgId);

      if (error) throw error;

      toast({ title: "You're live! 🎉", description: "Welcome to SuperSolt" });
      onGoLive();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
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
      <h2 className="text-xl font-bold mb-6">Review & Go Live</h2>

      <div className="space-y-4">
        {/* Business Details */}
        <div className="p-4 border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-5 h-5 text-primary" />
            <h3 className="font-medium">Business Details</h3>
          </div>
          {orgDetails && (
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>{orgDetails.name}</strong></p>
              {orgDetails.abn && <p>ABN: {orgDetails.abn}</p>}
              <p>GST: {orgDetails.gst_registered ? "Registered" : "Not registered"}</p>
              {orgDetails.contact_email && <p>Email: {orgDetails.contact_email}</p>}
              {orgDetails.contact_phone && <p>Phone: {orgDetails.contact_phone}</p>}
            </div>
          )}
        </div>

        {/* Venues */}
        <div className="p-4 border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-5 h-5 text-primary" />
            <h3 className="font-medium">Venues ({venues.length})</h3>
          </div>
          <div className="text-sm text-muted-foreground">
            {venues.map((v) => (
              <p key={v.id}>{v.name}</p>
            ))}
          </div>
        </div>

        {/* POS */}
        <div className="p-4 border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            <h3 className="font-medium">POS Connection</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {posConnected ? (
              <span className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-green-600" /> Connected
              </span>
            ) : (
              "Not connected — you can set this up later"
            )}
          </p>
        </div>

        {/* Team */}
        <div className="p-4 border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-primary" />
            <h3 className="font-medium">Team Invites</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {inviteCount > 0 ? `${inviteCount} invite${inviteCount > 1 ? "s" : ""} sent` : "No invites sent yet"}
          </p>
        </div>
      </div>

      <div className="flex justify-between pt-6">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleGoLive} disabled={saving} size="lg">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          🚀 Go Live
        </Button>
      </div>
    </Card>
  );
}
