import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner'
import { Loader2, Mail, Trash2, UserPlus } from "lucide-react";

const inviteSchema = z.object({
  email: z.string().email("Valid email required"),
  role: z.enum(["owner", "manager", "staff"]),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface PendingInvite {
  id: string;
  sent_to_email: string;
  role: string;
  sent_at: string;
}

interface Props {
  orgId: string;
  onNext: () => void;
  onBack: () => void;
}

export default function InviteTeamStep({ orgId, onNext, onBack }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role: "staff" },
  });

  const selectedRole = watch("role");

  useEffect(() => {
    const loadInvites = async () => {
      const { data } = await supabase
        .from("staff_invites")
        .select("id, sent_to_email, role, sent_at")
        .eq("org_id", orgId)
        .is("completed_at", null)
        .order("sent_at", { ascending: false });

      if (data) {
        setInvites(data);
      }
      setLoading(false);
    };
    loadInvites();
  }, [orgId]);

  const onSubmit = async (formData: InviteFormData) => {
    setSaving(true);
    try {
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from("staff_invites")
        .insert({
          org_id: orgId,
          role: formData.role,
          token,
          sent_to_email: formData.email,
          expires_at: expiresAt,
          invited_by: user?.id ?? null,
        })
        .select("id, sent_to_email, role, sent_at")
        .single();

      if (error) throw error;

      if (data) {
        setInvites((prev) => [data, ...prev]);
      }

      reset({ email: "", role: "staff" });
      toast.success('Invite sent', { description: `Invited ${formData.email} as ${formData.role}` });
    } catch (err) {
      toast.error("Error sending invite", { description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive", });
    } finally {
      setSaving(false);
    }
  };

  const removeInvite = async (inviteId: string) => {
    const { error } = await supabase.from("staff_invites").delete().eq("id", inviteId);
    if (!error) {
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      toast.success("Invite removed");
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
      <h2 className="text-xl font-bold mb-4">Invite Team</h2>

      {invites.length > 0 && (
        <div className="space-y-2 mb-6">
          <Label className="text-sm font-medium">Pending Invites</Label>
          {invites.map((invite) => (
            <div key={invite.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <div>
                  <span className="font-medium">{invite.sent_to_email}</span>
                  <span className="text-sm text-muted-foreground ml-2 capitalize">{invite.role}</span>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeInvite(invite.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="email">Email Address *</Label>
          <Input id="email" type="email" placeholder="team@example.com" {...register("email")} />
          {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <Label>Role *</Label>
          <Select value={selectedRole} onValueChange={(val) => setValue("role", val as InviteFormData["role"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="owner">Owner</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" variant="outline" disabled={saving} className="w-full">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
          Send Invite
        </Button>
      </form>

      <div className="flex justify-between pt-6">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>
          {invites.length > 0 ? "Next" : "Skip for now"}
        </Button>
      </div>
    </Card>
  );
}
