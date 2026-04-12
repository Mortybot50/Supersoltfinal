import { supabase } from "@/integrations/supabase/client";

export interface VenueTemplateData {
  timezone?: string;
  trading_hours?: Record<string, { open: string; close: string }>;
  venue_type?: string;
}

export interface VenueTemplate {
  id: string;
  org_id: string;
  name: string;
  template_data: VenueTemplateData;
  created_at: string;
  created_by: string | null;
}

export async function fetchVenueTemplates(
  orgId: string,
): Promise<VenueTemplate[]> {
  const { data, error } = await supabase
    .from("venue_templates" as "venues")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as VenueTemplate[];
}

export async function createVenueTemplate(params: {
  orgId: string;
  name: string;
  templateData: VenueTemplateData;
  createdBy: string;
}): Promise<VenueTemplate> {
  const { data, error } = await supabase
    .from("venue_templates" as "venues")
    .insert({
      org_id: params.orgId,
      name: params.name,
      template_data: params.templateData,
      created_by: params.createdBy,
    } as Record<string, unknown>)
    .select("*")
    .single();

  if (error) throw error;
  return data as unknown as VenueTemplate;
}

export async function deleteVenueTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from("venue_templates" as "venues")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
