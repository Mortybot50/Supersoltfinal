/**
 * Labour Module Supabase Service
 * Handles all database operations for staff, roster, timesheets, and related features
 */

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Json, Tables } from "@/integrations/supabase/types";
import type {
  Staff,
  RosterShift,
  Timesheet,
  ShiftTemplate,
  StaffAvailability,
  ShiftSwapRequest,
  LaborBudget,
  RosterPattern,
  TemplateShiftDef,
} from "@/types";

/** Extract readable error message from Supabase/Postgres errors */
function dbError(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null) {
    const e = err as Record<string, unknown>;
    return (
      (e.message as string) ||
      (e.details as string) ||
      (e.hint as string) ||
      JSON.stringify(err)
    );
  }
  return String(err);
}

// ============================================
// STAFF OPERATIONS
// ============================================

export type DBStaff = Tables<"staff">;

export async function loadStaffFromDB(): Promise<Staff[]> {
  try {
    // Join staff with org_members and profiles to get full details
    const { data, error } = await supabase
      .from("staff")
      .select(
        `
        *,
        org_members!inner (
          id,
          role,
          is_active,
          profiles!inner (
            id,
            email,
            first_name,
            last_name,
            phone
          )
        )
      `,
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!data) return [];

    // Transform to Staff type
    return data.map((s) => ({
      id: s.id,
      organization_id: s.org_members?.org_id || "",
      venue_id: s.venue_id || "",
      name:
        `${s.org_members?.profiles?.first_name || ""} ${s.org_members?.profiles?.last_name || ""}`.trim() ||
        "Unknown",
      email: s.org_members?.profiles?.email || "",
      phone: s.org_members?.profiles?.phone,
      role:
        (s.org_members?.role as "manager" | "supervisor" | "crew") || "crew",
      employment_type:
        (s.employment_type?.replace("_", "-") as
          | "full-time"
          | "part-time"
          | "casual") || "casual",
      award_classification: s.award_classification,
      hourly_rate: Math.round(s.base_hourly_rate || 2500), // Already in cents in DB
      start_date: s.start_date ? new Date(s.start_date) : new Date(),
      status: s.org_members?.is_active ? "active" : "inactive",
      onboarding_status: s.onboarding_status as Staff["onboarding_status"],
      onboarding_progress: s.onboarding_status === "roster_ready" ? 100 : 0,
      date_of_birth: s.date_of_birth ? new Date(s.date_of_birth) : undefined,
      emergency_contact_name: s.emergency_contact_name,
      emergency_contact_phone: s.emergency_contact_phone,
      emergency_contact_relationship: s.emergency_contact_relationship,
      address_line1: s.address_line1,
      address_line2: s.address_line2,
      suburb: s.suburb,
      state: s.state,
      postcode: s.postcode,
      tfn_exemption: false,
      tfn_claimed_tax_free_threshold: false,
      tfn_has_help_debt: false,
      tfn_has_tsl_debt: false,
      tfn_tax_offset_claimed: false,
      super_use_employer_default: true,
    }));
  } catch (error) {
    console.error("Failed to load staff from DB:", dbError(error));
    toast.error("Failed to load staff. Please refresh.");
    return [];
  }
}

/**
 * Create a new staff member via the serverless API.
 * This creates the full chain: auth user → profile → org_member → staff → venue_access
 */
export async function createStaffInDB(
  staff: Staff,
): Promise<{ staff_id: string; org_member_id: string } | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      toast.error("Not authenticated");
      return null;
    }

    const nameParts = staff.name.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const res = await fetch("/api/staff/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        org_id: staff.organization_id,
        venue_id: staff.venue_id,
        first_name: firstName,
        last_name: lastName,
        email: staff.email || undefined,
        phone: staff.phone || undefined,
        role: staff.role || "crew",
        employment_type: (staff.employment_type || "casual").replace("-", "_"),
        base_hourly_rate: staff.hourly_rate ?? undefined, // Already in cents
        award_classification: staff.award_classification || undefined,
        position: staff.role || "crew",
        start_date:
          staff.start_date instanceof Date
            ? staff.start_date.toISOString().split("T")[0]
            : undefined,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      console.error("[createStaffInDB] API error:", data.error);
      toast.error(data.error || "Failed to create staff member");
      return null;
    }

    return { staff_id: data.staff_id, org_member_id: data.org_member_id };
  } catch (error) {
    console.error("[createStaffInDB] Error:", error);
    toast.error("Failed to create staff member");
    return null;
  }
}

export async function updateStaffInDB(
  staffId: string,
  updates: Partial<Staff>,
): Promise<boolean> {
  try {
    const staffUpdates: Record<string, unknown> = {};

    if (updates.hourly_rate !== undefined)
      staffUpdates.base_hourly_rate = updates.hourly_rate; // Already in cents
    if (updates.role) staffUpdates.position = updates.role;
    if (updates.employment_type)
      staffUpdates.employment_type = updates.employment_type.replace("-", "_");
    if (updates.award_classification !== undefined)
      staffUpdates.award_classification = updates.award_classification;
    if (updates.start_date) {
      staffUpdates.start_date =
        updates.start_date instanceof Date
          ? updates.start_date.toISOString().split("T")[0]
          : String(updates.start_date).split("T")[0];
    }
    if (updates.date_of_birth) {
      staffUpdates.date_of_birth =
        updates.date_of_birth instanceof Date
          ? updates.date_of_birth.toISOString().split("T")[0]
          : String(updates.date_of_birth).split("T")[0];
    }
    if (updates.emergency_contact_name !== undefined)
      staffUpdates.emergency_contact_name = updates.emergency_contact_name;
    if (updates.emergency_contact_phone !== undefined)
      staffUpdates.emergency_contact_phone = updates.emergency_contact_phone;
    if (updates.emergency_contact_relationship !== undefined)
      staffUpdates.emergency_contact_relationship =
        updates.emergency_contact_relationship;
    if (updates.address_line1 !== undefined)
      staffUpdates.address_line1 = updates.address_line1;
    if (updates.address_line2 !== undefined)
      staffUpdates.address_line2 = updates.address_line2;
    if (updates.suburb !== undefined) staffUpdates.suburb = updates.suburb;
    if (updates.state !== undefined) staffUpdates.state = updates.state;
    if (updates.postcode !== undefined)
      staffUpdates.postcode = updates.postcode;
    if (updates.onboarding_status)
      staffUpdates.onboarding_status = updates.onboarding_status;

    if (Object.keys(staffUpdates).length > 0) {
      const { error } = await supabase
        .from("staff")
        .update(staffUpdates)
        .eq("id", staffId);

      if (error) throw error;
    }

    // Update org_member role if changed
    if (updates.role) {
      const { data: staffRow } = await supabase
        .from("staff")
        .select("org_member_id")
        .eq("id", staffId)
        .single();

      if (staffRow?.org_member_id) {
        const { error: omError } = await supabase
          .from("org_members")
          .update({ role: updates.role })
          .eq("id", staffRow.org_member_id);

        if (omError) throw omError;
      }
    }

    return true;
  } catch (error) {
    console.error("Failed to update staff in DB:", dbError(error));
    toast.error("Failed to update staff member.");
    return false;
  }
}

export async function toggleStaffActiveInDB(
  staffId: string,
  active: boolean,
): Promise<boolean> {
  try {
    const { data: staffRow } = await supabase
      .from("staff")
      .select("org_member_id")
      .eq("id", staffId)
      .single();

    if (!staffRow?.org_member_id) {
      console.error("No org_member_id found for staff:", staffId);
      return false;
    }

    const { error } = await supabase
      .from("org_members")
      .update({ is_active: active })
      .eq("id", staffRow.org_member_id);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error(
      "Failed to toggle staff active status in DB:",
      dbError(error),
    );
    toast.error("Failed to update staff status.");
    return false;
  }
}

// ============================================
// ROSTER SHIFTS OPERATIONS
// ============================================

type DBRosterShift = Tables<"roster_shifts">;

export async function loadRosterShiftsFromDB(
  venueId?: string,
): Promise<RosterShift[]> {
  try {
    let query = supabase
      .from("roster_shifts")
      .select(
        `
        *,
        staff!inner (
          id,
          org_members!inner (
            profiles!inner (
              first_name,
              last_name
            )
          )
        )
      `,
      )
      .order("shift_date", { ascending: true });

    if (venueId) {
      query = query.eq("venue_id", venueId);
    }

    const { data, error } = await query;

    if (error) throw error;

    if (!data) return [];

    return data.map((s) => ({
      id: s.id,
      venue_id: s.venue_id,
      staff_id: s.staff_id,
      staff_name:
        `${s.staff?.org_members?.profiles?.first_name || ""} ${s.staff?.org_members?.profiles?.last_name || ""}`.trim(),
      date: new Date(s.shift_date),
      start_time: s.start_time,
      end_time: s.end_time,
      break_minutes: s.break_duration_mins || 0,
      role: s.position || "crew",
      notes: s.notes,
      status: (s.status as RosterShift["status"]) || "scheduled",
      is_open_shift: s.is_open_shift || false,
      total_hours: calculateHours(
        s.start_time,
        s.end_time,
        s.break_duration_mins || 0,
      ),
      base_cost: Math.round((s.base_cost || 0) * 100),
      penalty_cost: Math.round((s.penalty_cost || 0) * 100),
      total_cost: Math.round((s.estimated_cost || 0) * 100),
      penalty_type: (s.penalty_type as RosterShift["penalty_type"]) || "none",
      penalty_multiplier: s.penalty_rate || 1,
      template_id: s.template_id,
    }));
  } catch (error) {
    console.error("Failed to load roster shifts from DB:", dbError(error));
    toast.error("Failed to load roster shifts. Please refresh.");
    return [];
  }
}

/** Convert a date + time string (e.g. "09:00") to a full ISO timestamp for timestamptz columns */
function toTimestampTZ(date: Date | string, time: string): string {
  const d =
    date instanceof Date
      ? date.toISOString().split("T")[0]
      : String(date).split("T")[0];
  return `${d}T${time}:00`;
}

export async function addRosterShiftToDB(
  shift: RosterShift,
  orgId: string,
): Promise<RosterShift | null> {
  try {
    const shiftData: Partial<DBRosterShift> = {
      id: shift.id,
      org_id: orgId,
      venue_id: shift.venue_id,
      staff_id: shift.staff_id,
      shift_date:
        shift.date instanceof Date
          ? shift.date.toISOString().split("T")[0]
          : String(shift.date).split("T")[0],
      start_time: toTimestampTZ(shift.date, shift.start_time),
      end_time: toTimestampTZ(shift.date, shift.end_time),
      break_duration_mins: shift.break_minutes,
      position: shift.role,
      status: mapShiftStatus(shift.status),
      hourly_rate: shift.total_cost / 100 / shift.total_hours || 0,
      penalty_rate: shift.penalty_multiplier || 1,
      estimated_cost: shift.total_cost / 100,
      base_cost: (shift.base_cost || 0) / 100,
      penalty_cost: (shift.penalty_cost || 0) / 100,
      penalty_type: shift.penalty_type || "none",
      is_open_shift: shift.is_open_shift || false,
      template_id: shift.template_id,
      notes: shift.notes,
    };

    const { data, error } = await supabase
      .from("roster_shifts")
      .insert([shiftData])
      .select()
      .single();

    if (error) throw error;

    return shift;
  } catch (error) {
    console.error("Failed to add roster shift to DB:", dbError(error));
    toast.error("Failed to save roster shift.");
    return null;
  }
}

export async function updateRosterShiftInDB(
  id: string,
  updates: Partial<RosterShift>,
): Promise<boolean> {
  try {
    const updateData: Partial<DBRosterShift> = {};

    if (updates.date) {
      updateData.shift_date =
        updates.date instanceof Date
          ? updates.date.toISOString().split("T")[0]
          : String(updates.date).split("T")[0];
    }
    if (updates.start_time)
      updateData.start_time = updates.date
        ? toTimestampTZ(updates.date, updates.start_time)
        : updates.start_time;
    if (updates.end_time)
      updateData.end_time = updates.date
        ? toTimestampTZ(updates.date, updates.end_time)
        : updates.end_time;
    if (updates.break_minutes !== undefined)
      updateData.break_duration_mins = updates.break_minutes;
    if (updates.role) updateData.position = updates.role;
    if (updates.status) updateData.status = mapShiftStatus(updates.status);
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.total_cost !== undefined)
      updateData.estimated_cost = updates.total_cost / 100;
    if (updates.base_cost !== undefined)
      updateData.base_cost = updates.base_cost / 100;
    if (updates.penalty_cost !== undefined)
      updateData.penalty_cost = updates.penalty_cost / 100;
    if (updates.penalty_type) updateData.penalty_type = updates.penalty_type;
    if (updates.penalty_multiplier !== undefined)
      updateData.penalty_rate = updates.penalty_multiplier;
    if (updates.is_open_shift !== undefined)
      updateData.is_open_shift = updates.is_open_shift;
    if (updates.staff_id) updateData.staff_id = updates.staff_id;

    const { error } = await supabase
      .from("roster_shifts")
      .update(updateData)
      .eq("id", id);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error("Failed to update roster shift in DB:", dbError(error));
    toast.error("Failed to update roster shift.");
    return false;
  }
}

export async function deleteRosterShiftFromDB(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("roster_shifts")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error("Failed to delete roster shift from DB:", dbError(error));
    toast.error("Failed to delete roster shift.");
    return false;
  }
}

export async function publishRosterShifts(
  shiftIds: string[],
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("roster_shifts")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
      })
      .in("id", shiftIds);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error("Failed to publish roster shifts:", dbError(error));
    toast.error("Failed to publish roster shifts.");
    return false;
  }
}

// ============================================
// TIMESHEETS OPERATIONS
// ============================================

type DBTimesheet = Tables<"timesheets">;

export async function loadTimesheetsFromDB(
  venueId?: string,
  dateRange?: { start: Date; end: Date },
): Promise<Timesheet[]> {
  try {
    let query = supabase
      .from("timesheets")
      .select(
        `
        *,
        staff!inner (
          id,
          org_members!inner (
            profiles!inner (
              first_name,
              last_name
            )
          )
        )
      `,
      )
      .order("work_date", { ascending: false });

    if (venueId) {
      query = query.eq("venue_id", venueId);
    }

    if (dateRange) {
      query = query
        .gte("work_date", dateRange.start.toISOString().split("T")[0])
        .lte("work_date", dateRange.end.toISOString().split("T")[0]);
    }

    const { data, error } = await query;

    if (error) throw error;

    if (!data) return [];

    return data.map((t) => ({
      id: t.id,
      venue_id: t.venue_id,
      staff_id: t.staff_id,
      staff_name:
        `${t.staff?.org_members?.profiles?.first_name || ""} ${t.staff?.org_members?.profiles?.last_name || ""}`.trim(),
      date: new Date(t.work_date),
      clock_in: new Date(t.clock_in),
      clock_out: t.clock_out ? new Date(t.clock_out) : undefined,
      break_minutes: t.total_break_mins || 0,
      total_hours: t.total_hours || 0,
      gross_pay: Math.round((t.total_pay || 0) * 100),
      status: mapTimesheetStatus(t.status),
      notes: t.notes,
    }));
  } catch (error) {
    console.error("Failed to load timesheets from DB:", dbError(error));
    toast.error("Failed to load timesheets. Please refresh.");
    return [];
  }
}

export async function addTimesheetToDB(
  timesheet: Timesheet,
  orgId: string,
): Promise<Timesheet | null> {
  try {
    const timesheetData: Partial<DBTimesheet> = {
      id: timesheet.id,
      org_id: orgId,
      venue_id: timesheet.venue_id,
      staff_id: timesheet.staff_id,
      work_date:
        timesheet.date instanceof Date
          ? timesheet.date.toISOString().split("T")[0]
          : String(timesheet.date).split("T")[0],
      clock_in:
        timesheet.clock_in instanceof Date
          ? timesheet.clock_in.toISOString()
          : String(timesheet.clock_in),
      clock_out:
        timesheet.clock_out instanceof Date
          ? timesheet.clock_out.toISOString()
          : timesheet.clock_out
            ? String(timesheet.clock_out)
            : undefined,
      total_break_mins: timesheet.break_minutes,
      total_hours: timesheet.total_hours,
      status: mapTimesheetStatusToDB(timesheet.status),
      total_pay: timesheet.gross_pay / 100,
      notes: timesheet.notes,
      clock_in_method: "app",
      edited: false,
    };

    const { data, error } = await supabase
      .from("timesheets")
      .insert([timesheetData])
      .select()
      .single();

    if (error) throw error;

    return timesheet;
  } catch (error) {
    console.error("Failed to add timesheet to DB:", dbError(error));
    toast.error("Failed to save timesheet.");
    return null;
  }
}

export async function updateTimesheetInDB(
  id: string,
  updates: Partial<Timesheet>,
): Promise<boolean> {
  try {
    const updateData: Partial<DBTimesheet> = {};

    if (updates.clock_out) {
      updateData.clock_out =
        updates.clock_out instanceof Date
          ? updates.clock_out.toISOString()
          : String(updates.clock_out);
    }
    if (updates.break_minutes !== undefined)
      updateData.total_break_mins = updates.break_minutes;
    if (updates.total_hours !== undefined)
      updateData.total_hours = updates.total_hours;
    if (updates.status)
      updateData.status = mapTimesheetStatusToDB(updates.status);
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.gross_pay !== undefined)
      updateData.total_pay = updates.gross_pay / 100;

    const { error } = await supabase
      .from("timesheets")
      .update(updateData)
      .eq("id", id);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error("Failed to update timesheet in DB:", dbError(error));
    toast.error("Failed to update timesheet.");
    return false;
  }
}

export async function approveTimesheetInDB(
  id: string,
  approvedBy: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("timesheets")
      .update({
        status: "approved",
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error("Failed to approve timesheet in DB:", dbError(error));
    toast.error("Failed to approve timesheet.");
    return false;
  }
}

export async function rejectTimesheetInDB(
  id: string,
  reason?: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("timesheets")
      .update({
        status: "rejected",
        rejection_reason: reason,
      })
      .eq("id", id);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error("Failed to reject timesheet in DB:", dbError(error));
    toast.error("Failed to reject timesheet.");
    return false;
  }
}

// ============================================
// SHIFT TEMPLATES OPERATIONS
// ============================================

type DBShiftTemplate = Tables<"shift_templates">;

export async function loadShiftTemplatesFromDB(
  venueId?: string,
): Promise<ShiftTemplate[]> {
  try {
    let query = supabase
      .from("shift_templates")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (venueId) {
      query = query.eq("venue_id", venueId);
    }

    const { data, error } = await query;

    if (error) throw error;

    if (!data) return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- template_shifts is a new JSONB column not yet in auto-gen types
    return data.map((t: any) => ({
      id: t.id,
      organization_id: t.org_id,
      venue_id: t.venue_id,
      name: t.name,
      description: t.description,
      start_time: t.start_time,
      end_time: t.end_time,
      break_minutes: t.break_minutes || 0,
      role: t.position as "manager" | "supervisor" | "crew",
      days_of_week: t.days_of_week || [],
      template_shifts: (t.template_shifts as TemplateShiftDef[]) || [],
      usage_count: t.usage_count || 0,
      last_used_at: t.last_used_at ? new Date(t.last_used_at) : undefined,
      created_at: new Date(t.created_at),
      updated_at: new Date(t.updated_at),
    }));
  } catch (error) {
    console.error("Failed to load shift templates from DB:", dbError(error));
    toast.error("Failed to load shift templates. Please refresh.");
    return [];
  }
}

export async function addShiftTemplateToDB(
  template: ShiftTemplate,
): Promise<ShiftTemplate | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- template_shifts is a new JSONB column not yet in auto-gen types
    const templateData: any = {
      id: template.id,
      org_id: template.organization_id,
      venue_id: template.venue_id,
      name: template.name,
      description: template.description,
      start_time: template.start_time,
      end_time: template.end_time,
      break_minutes: template.break_minutes,
      position: template.role,
      days_of_week: template.days_of_week,
      template_shifts: template.template_shifts || [],
      usage_count: 0,
      is_active: true,
    };

    const { data, error } = await supabase
      .from("shift_templates")
      .insert([templateData])
      .select()
      .single();

    if (error) throw error;

    return template;
  } catch (error) {
    console.error("Failed to add shift template to DB:", dbError(error));
    toast.error("Failed to save shift template.");
    return null;
  }
}

export async function updateShiftTemplateInDB(
  id: string,
  updates: Partial<ShiftTemplate>,
): Promise<boolean> {
  try {
    const updateData: Partial<DBShiftTemplate> = {};

    if (updates.name) updateData.name = updates.name;
    if (updates.description !== undefined)
      updateData.description = updates.description;
    if (updates.start_time)
      updateData.start_time = updates.date
        ? toTimestampTZ(updates.date, updates.start_time)
        : updates.start_time;
    if (updates.end_time)
      updateData.end_time = updates.date
        ? toTimestampTZ(updates.date, updates.end_time)
        : updates.end_time;
    if (updates.break_minutes !== undefined)
      updateData.break_minutes = updates.break_minutes;
    if (updates.role) updateData.position = updates.role;
    if (updates.days_of_week) updateData.days_of_week = updates.days_of_week;

    const { error } = await supabase
      .from("shift_templates")
      .update(updateData)
      .eq("id", id);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error("Failed to update shift template in DB:", dbError(error));
    toast.error("Failed to update shift template.");
    return false;
  }
}

export async function deleteShiftTemplateFromDB(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("shift_templates")
      .update({ is_active: false })
      .eq("id", id);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error("Failed to delete shift template from DB:", dbError(error));
    toast.error("Failed to delete shift template.");
    return false;
  }
}

// ============================================
// ROSTER PATTERNS OPERATIONS
// ============================================

export async function loadRosterPatternsFromDB(
  venueId: string,
): Promise<RosterPattern[]> {
  try {
    const { data, error } = await supabase
      .from("roster_patterns")
      .select("*")
      .eq("venue_id", venueId)
      .eq("is_active", true)
      .order("name");

    if (error) throw error;
    if (!data) return [];

    return data.map((p) => ({
      id: p.id,
      organization_id: p.org_id,
      venue_id: p.venue_id,
      name: p.name,
      description: p.description ?? undefined,
      shifts: (Array.isArray(p.shifts) ? p.shifts : []) as TemplateShiftDef[],
      is_active: p.is_active,
      created_at: new Date(p.created_at),
      updated_at: new Date(p.updated_at),
    }));
  } catch (error) {
    console.error("Failed to load roster patterns from DB:", dbError(error));
    return [];
  }
}

export async function addRosterPatternToDB(
  pattern: Omit<RosterPattern, "id" | "created_at" | "updated_at">,
  orgId: string,
): Promise<RosterPattern | null> {
  try {
    const { data: row, error } = await supabase
      .from("roster_patterns")
      .insert([
        {
          org_id: orgId,
          venue_id: pattern.venue_id,
          name: pattern.name,
          description: pattern.description,
          shifts: pattern.shifts as unknown as Json,
          is_active: pattern.is_active ?? true,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return {
      id: row.id,
      organization_id: row.org_id,
      venue_id: row.venue_id,
      name: row.name,
      description: row.description ?? undefined,
      shifts: (Array.isArray(row.shifts)
        ? row.shifts
        : []) as TemplateShiftDef[],
      is_active: row.is_active,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  } catch (error) {
    console.error("Failed to add roster pattern to DB:", dbError(error));
    toast.error("Failed to save roster pattern.");
    return null;
  }
}

export async function updateRosterPatternInDB(
  id: string,
  updates: Partial<Pick<RosterPattern, "name" | "description" | "shifts">>,
): Promise<boolean> {
  try {
    const dbUpdates: {
      name?: string;
      description?: string | null;
      shifts?: Json;
    } = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined)
      dbUpdates.description = updates.description ?? null;
    if (updates.shifts !== undefined)
      dbUpdates.shifts = updates.shifts as unknown as Json;

    const { error } = await supabase
      .from("roster_patterns")
      .update(dbUpdates)
      .eq("id", id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Failed to update roster pattern in DB:", dbError(error));
    toast.error("Failed to update roster pattern.");
    return false;
  }
}

export async function deleteRosterPatternFromDB(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("roster_patterns")
      .update({ is_active: false })
      .eq("id", id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Failed to delete roster pattern from DB:", dbError(error));
    toast.error("Failed to delete roster pattern.");
    return false;
  }
}

// ============================================
// STAFF AVAILABILITY OPERATIONS
// ============================================

export async function loadStaffAvailabilityFromDB(
  staffId?: string,
): Promise<StaffAvailability[]> {
  try {
    let query = supabase
      .from("staff_availability")
      .select("*")
      .order("day_of_week");

    if (staffId) {
      query = query.eq("staff_id", staffId);
    }

    const { data, error } = await query;

    if (error) throw error;

    if (!data) return [];

    return data.map((a) => ({
      id: a.id,
      staff_id: a.staff_id,
      venue_id: "",
      type: a.is_available ? "available" : "unavailable",
      is_recurring: true, // DB schema is for recurring only
      day_of_week: a.day_of_week,
      start_time: a.start_time,
      end_time: a.end_time,
      created_at: new Date(a.created_at),
      updated_at: new Date(a.updated_at),
    }));
  } catch (error) {
    console.error("Failed to load staff availability from DB:", dbError(error));
    toast.error("Failed to load staff availability. Please refresh.");
    return [];
  }
}

// ============================================
// SHIFT SWAP REQUESTS OPERATIONS
// ============================================

export async function loadShiftSwapRequestsFromDB(
  venueId?: string,
): Promise<ShiftSwapRequest[]> {
  try {
    let query = supabase
      .from("shift_swap_requests")
      .select(
        `
        *,
        original_staff:staff!shift_swap_requests_original_staff_id_fkey (
          id,
          org_members!inner (
            profiles!inner (
              first_name,
              last_name
            )
          )
        ),
        target_staff:staff!shift_swap_requests_target_staff_id_fkey (
          id,
          org_members!inner (
            profiles!inner (
              first_name,
              last_name
            )
          )
        )
      `,
      )
      .order("requested_at", { ascending: false });

    if (venueId) {
      query = query.eq("venue_id", venueId);
    }

    const { data, error } = await query;

    if (error) throw error;

    if (!data) return [];

    return data.map((r) => ({
      id: r.id,
      venue_id: r.venue_id,
      original_shift_id: r.original_shift_id,
      original_staff_id: r.original_staff_id,
      original_staff_name:
        `${r.original_staff?.org_members?.profiles?.first_name || ""} ${r.original_staff?.org_members?.profiles?.last_name || ""}`.trim(),
      target_staff_id: r.target_staff_id,
      target_staff_name: r.target_staff
        ? `${r.target_staff?.org_members?.profiles?.first_name || ""} ${r.target_staff?.org_members?.profiles?.last_name || ""}`.trim()
        : undefined,
      status: r.status as ShiftSwapRequest["status"],
      requested_at: new Date(r.requested_at),
      responded_at: r.responded_at ? new Date(r.responded_at) : undefined,
      responded_by: r.responded_by,
      rejection_reason: r.rejection_reason,
      notes: r.notes,
    }));
  } catch (error) {
    console.warn("Failed to load shift swap requests from DB:", dbError(error));
    return [];
  }
}

export async function createShiftSwapRequestInDB(
  request: ShiftSwapRequest,
  orgId: string,
): Promise<ShiftSwapRequest | null> {
  try {
    const requestData = {
      id: request.id,
      org_id: orgId,
      venue_id: request.venue_id,
      original_shift_id: request.original_shift_id,
      original_staff_id: request.original_staff_id,
      target_staff_id: request.target_staff_id || null,
      status: "pending",
      requested_at: new Date().toISOString(),
      notes: request.notes,
    };

    const { data, error } = await supabase
      .from("shift_swap_requests")
      .insert([requestData])
      .select()
      .single();

    if (error) throw error;

    return request;
  } catch (error) {
    console.error("Failed to create shift swap request in DB:", dbError(error));
    toast.error("Failed to create shift swap request.");
    return null;
  }
}

export async function updateShiftSwapRequestInDB(
  id: string,
  updates: Partial<ShiftSwapRequest>,
): Promise<boolean> {
  try {
    const updateData: Record<string, unknown> = {};

    if (updates.status) updateData.status = updates.status;
    if (updates.responded_at) {
      updateData.responded_at =
        updates.responded_at instanceof Date
          ? updates.responded_at.toISOString()
          : updates.responded_at;
    }
    if (updates.responded_by) updateData.responded_by = updates.responded_by;
    if (updates.rejection_reason !== undefined)
      updateData.rejection_reason = updates.rejection_reason;

    const { error } = await supabase
      .from("shift_swap_requests")
      .update(updateData)
      .eq("id", id);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error("Failed to update shift swap request in DB:", dbError(error));
    toast.error("Failed to update shift swap request.");
    return false;
  }
}

// ============================================
// LABOR BUDGETS OPERATIONS
// ============================================

export async function loadLaborBudgetsFromDB(
  venueId?: string,
): Promise<LaborBudget[]> {
  try {
    let query = supabase
      .from("labor_budgets")
      .select("*")
      .order("period_start", { ascending: false });

    if (venueId) {
      query = query.eq("venue_id", venueId);
    }

    const { data, error } = await query;

    if (error) throw error;

    if (!data) return [];

    return data.map((b) => ({
      id: b.id,
      venue_id: b.venue_id,
      period_type: b.period_type as "weekly" | "monthly",
      period_start: new Date(b.period_start),
      period_end: new Date(b.period_end),
      budgeted_amount: b.budgeted_amount,
      actual_amount: b.actual_amount,
      revenue_target: b.revenue_target,
      warning_threshold_percent: b.warning_threshold_percent || 90,
      critical_threshold_percent: b.critical_threshold_percent || 100,
      notes: b.notes,
      created_at: new Date(b.created_at),
      updated_at: new Date(b.updated_at),
    }));
  } catch (error) {
    console.error("Failed to load labor budgets from DB:", dbError(error));
    toast.error("Failed to load labor budgets. Please refresh.");
    return [];
  }
}

export async function addLaborBudgetToDB(
  budget: LaborBudget,
  orgId: string,
): Promise<LaborBudget | null> {
  try {
    const budgetData = {
      id: budget.id,
      org_id: orgId,
      venue_id: budget.venue_id,
      period_type: budget.period_type,
      period_start:
        budget.period_start instanceof Date
          ? budget.period_start.toISOString().split("T")[0]
          : budget.period_start,
      period_end:
        budget.period_end instanceof Date
          ? budget.period_end.toISOString().split("T")[0]
          : budget.period_end,
      budgeted_amount: budget.budgeted_amount,
      actual_amount: budget.actual_amount || 0,
      revenue_target: budget.revenue_target,
      warning_threshold_percent: budget.warning_threshold_percent,
      critical_threshold_percent: budget.critical_threshold_percent,
      notes: budget.notes,
    };

    const { data, error } = await supabase
      .from("labor_budgets")
      .insert([budgetData])
      .select()
      .single();

    if (error) throw error;

    return budget;
  } catch (error) {
    console.error("Failed to add labor budget to DB:", dbError(error));
    toast.error("Failed to save labor budget.");
    return null;
  }
}

export async function updateLaborBudgetInDB(
  id: string,
  updates: Partial<LaborBudget>,
): Promise<boolean> {
  try {
    const updateData: Record<string, unknown> = {};

    if (updates.budgeted_amount !== undefined)
      updateData.budgeted_amount = updates.budgeted_amount;
    if (updates.actual_amount !== undefined)
      updateData.actual_amount = updates.actual_amount;
    if (updates.revenue_target !== undefined)
      updateData.revenue_target = updates.revenue_target;
    if (updates.warning_threshold_percent !== undefined)
      updateData.warning_threshold_percent = updates.warning_threshold_percent;
    if (updates.critical_threshold_percent !== undefined)
      updateData.critical_threshold_percent =
        updates.critical_threshold_percent;
    if (updates.notes !== undefined) updateData.notes = updates.notes;

    const { error } = await supabase
      .from("labor_budgets")
      .update(updateData)
      .eq("id", id);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error("Failed to update labor budget in DB:", dbError(error));
    toast.error("Failed to update labor budget.");
    return false;
  }
}

export async function deleteLaborBudgetFromDB(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("labor_budgets")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error("Failed to delete labor budget from DB:", dbError(error));
    toast.error("Failed to delete labor budget.");
    return false;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateHours(
  startTime: string,
  endTime: string,
  breakMinutes: number,
): number {
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);

  let totalMinutes = endHour * 60 + endMin - (startHour * 60 + startMin);
  if (totalMinutes < 0) totalMinutes += 24 * 60; // Handle overnight shifts

  return Math.max(0, (totalMinutes - breakMinutes) / 60);
}

function mapShiftStatus(status?: RosterShift["status"]): string {
  switch (status) {
    case "scheduled":
      return "draft";
    case "confirmed":
      return "confirmed";
    case "in-progress":
      return "confirmed";
    case "completed":
      return "completed";
    case "cancelled":
      return "cancelled";
    default:
      return "draft";
  }
}

function mapTimesheetStatus(dbStatus: string): Timesheet["status"] {
  switch (dbStatus) {
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    case "submitted":
    case "open":
    default:
      return "pending";
  }
}

function mapTimesheetStatusToDB(status: Timesheet["status"]): string {
  switch (status) {
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    case "pending":
    default:
      return "submitted";
  }
}
