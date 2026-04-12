/**
 * Leave Service — Supabase operations for leave_requests and staff_availability
 */

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────

export type LeaveType =
  | "annual"
  | "personal"
  | "unpaid"
  | "long_service"
  | "compassionate"
  | "other";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface LeaveRequest {
  id: string;
  staff_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: LeaveStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  created_by: string | null;
}

export interface LeaveBalance {
  leave_type: LeaveType;
  accrued_days: number;
  taken_days: number;
  remaining_days: number;
}

export interface StaffAvailabilityRecord {
  id: string;
  staff_id: string;
  day_of_week: number;
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
  approved_by: string | null;
  approved_at: string | null;
}

function dbError(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null) {
    const e = err as Record<string, unknown>;
    return (
      (e.message as string) || (e.details as string) || JSON.stringify(err)
    );
  }
  return String(err);
}

// ─── Leave Requests ───────────────────────────────────────────

export async function getLeaveRequests(
  venueId: string,
  filters?: { status?: LeaveStatus; staffId?: string },
): Promise<LeaveRequest[]> {
  try {
    const { data: staffData, error: staffError } = await supabase
      .from("staff")
      .select("id")
      .eq("venue_id", venueId);

    if (staffError) throw staffError;

    const staffIds = staffData?.map((s) => s.id) ?? [];
    if (staffIds.length === 0) return [];

    let query = supabase
      .from("leave_requests")
      .select("*")
      .in("staff_id", staffIds)
      .order("created_at", { ascending: false });

    if (filters?.status) query = query.eq("status", filters.status);
    if (filters?.staffId) query = query.eq("staff_id", filters.staffId);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as LeaveRequest[];
  } catch (error) {
    console.error("Failed to load leave requests:", dbError(error));
    toast.error("Failed to load leave requests");
    return [];
  }
}

export async function createLeaveRequest(request: {
  staff_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason?: string;
  created_by: string;
}): Promise<LeaveRequest | null> {
  try {
    const { data, error } = await supabase
      .from("leave_requests")
      .insert({
        staff_id: request.staff_id,
        leave_type: request.leave_type,
        start_date: request.start_date,
        end_date: request.end_date,
        reason: request.reason ?? null,
        status: "pending",
        created_by: request.created_by,
      })
      .select()
      .single();

    if (error) throw error;
    toast.success("Leave request submitted");
    return data as LeaveRequest;
  } catch (error) {
    console.error("Failed to create leave request:", dbError(error));
    toast.error("Failed to submit leave request");
    return null;
  }
}

export async function approveLeave(
  requestId: string,
  approvedBy: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("leave_requests")
      .update({
        status: "approved",
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (error) throw error;
    toast.success("Leave approved");
    return true;
  } catch (error) {
    console.error("Failed to approve leave:", dbError(error));
    toast.error("Failed to approve leave request");
    return false;
  }
}

export async function declineLeave(
  requestId: string,
  reason: string,
  declinedBy: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("leave_requests")
      .update({
        status: "rejected",
        rejection_reason: reason,
        approved_by: declinedBy,
        approved_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (error) throw error;
    toast.success("Leave declined");
    return true;
  } catch (error) {
    console.error("Failed to decline leave:", dbError(error));
    toast.error("Failed to decline leave request");
    return false;
  }
}

// ─── Leave Balances ───────────────────────────────────────────

/** Calculate AU-standard leave balances from employment start date and DB records */
export async function getLeaveBalances(
  staffId: string,
  employmentStartDate: Date,
): Promise<LeaveBalance[]> {
  try {
    const msPerDay = 1000 * 60 * 60 * 24;
    const msPerYear = msPerDay * 365;
    const yearsWorked =
      (Date.now() - employmentStartDate.getTime()) / msPerYear;

    // AU entitlements (FW Act): 4 weeks annual, 10 days personal per year
    const annualAccrued = Math.min(Math.round(yearsWorked * 20), 40); // cap at 2 years
    const personalAccrued = Math.min(Math.round(yearsWorked * 10), 20);

    const { data, error } = await supabase
      .from("leave_requests")
      .select("leave_type, start_date, end_date")
      .eq("staff_id", staffId)
      .eq("status", "approved");

    if (error) throw error;

    const taken: Record<string, number> = {
      annual: 0,
      personal: 0,
      unpaid: 0,
    };

    for (const req of data ?? []) {
      const days =
        Math.ceil(
          (new Date(req.end_date).getTime() -
            new Date(req.start_date).getTime()) /
            msPerDay,
        ) + 1;
      if (req.leave_type in taken) {
        taken[req.leave_type] += days;
      }
    }

    return [
      {
        leave_type: "annual",
        accrued_days: annualAccrued,
        taken_days: taken.annual,
        remaining_days: Math.max(0, annualAccrued - taken.annual),
      },
      {
        leave_type: "personal",
        accrued_days: personalAccrued,
        taken_days: taken.personal,
        remaining_days: Math.max(0, personalAccrued - taken.personal),
      },
      {
        leave_type: "unpaid",
        accrued_days: 0,
        taken_days: taken.unpaid,
        remaining_days: 0,
      },
    ];
  } catch (error) {
    console.error("Failed to get leave balances:", dbError(error));
    return [];
  }
}

// ─── Leave Impact ─────────────────────────────────────────────

export async function calculateLeaveImpact(
  requestId: string,
): Promise<{ shiftsAffected: number; hoursAffected: number }> {
  try {
    const { data: req, error: reqError } = await supabase
      .from("leave_requests")
      .select("staff_id, start_date, end_date")
      .eq("id", requestId)
      .single();

    if (reqError || !req) return { shiftsAffected: 0, hoursAffected: 0 };

    const { data: shifts, error: shiftError } = await supabase
      .from("roster_shifts")
      .select("id, total_hours")
      .eq("staff_id", req.staff_id)
      .gte("shift_date", req.start_date)
      .lte("shift_date", req.end_date)
      .neq("status", "cancelled");

    if (shiftError) throw shiftError;

    return {
      shiftsAffected: shifts?.length ?? 0,
      hoursAffected:
        shifts?.reduce((sum, s) => sum + (s.total_hours ?? 0), 0) ?? 0,
    };
  } catch (error) {
    console.error("Failed to calculate leave impact:", dbError(error));
    return { shiftsAffected: 0, hoursAffected: 0 };
  }
}

// ─── Staff Availability ───────────────────────────────────────

export async function getStaffAvailability(
  venueId: string,
): Promise<StaffAvailabilityRecord[]> {
  try {
    const { data: staffData, error: staffError } = await supabase
      .from("staff")
      .select("id")
      .eq("venue_id", venueId);

    if (staffError) throw staffError;

    const staffIds = staffData?.map((s) => s.id) ?? [];
    if (staffIds.length === 0) return [];

    const { data, error } = await supabase
      .from("staff_availability")
      .select("*")
      .in("staff_id", staffIds)
      .order("day_of_week");

    if (error) throw error;
    return (data ?? []) as StaffAvailabilityRecord[];
  } catch (error) {
    console.error("Failed to load staff availability:", dbError(error));
    toast.error("Failed to load availability");
    return [];
  }
}

export async function upsertStaffAvailability(record: {
  staff_id: string;
  day_of_week: number;
  is_available: boolean;
  start_time?: string | null;
  end_time?: string | null;
}): Promise<boolean> {
  try {
    const { error } = await supabase.from("staff_availability").upsert(
      {
        staff_id: record.staff_id,
        day_of_week: record.day_of_week,
        is_available: record.is_available,
        start_time: record.start_time ?? null,
        end_time: record.end_time ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "staff_id,day_of_week" },
    );

    if (error) throw error;
    toast.success("Availability updated");
    return true;
  } catch (error) {
    console.error("Failed to update availability:", dbError(error));
    toast.error("Failed to update availability");
    return false;
  }
}
