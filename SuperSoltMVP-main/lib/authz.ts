import { db } from "@/db"
import { memberships, auditLogs, venues, type NewAuditLog } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { auth } from "@/auth"
import { cookies } from "next/headers"

// Type for session user
export type SessionUser = {
  id: string
  email: string
}

// Type for allowed roles
export type Role = "owner" | "manager" | "supervisor" | "crew"

// Type for active context
export type ActiveContext = {
  orgId: string
  venueId: string
  userId: string
}

/**
 * Get the current session user from NextAuth
 * @throws Error with status 401 if user is not authenticated
 */
export async function getSessionUser(): Promise<SessionUser> {
  const session = await auth()

  if (!session?.user) {
    const error = new Error("Unauthorized: No active session")
    ;(error as any).statusCode = 401
    throw error
  }

  return {
    id: session.user.id,
    email: session.user.email || "",
  }
}

/**
 * Require that the current user has a membership in the specified organisation
 * @throws Error if user is not a member
 * @returns The user's membership role
 */
export async function requireOrg(orgId: string): Promise<{ role: Role }> {
  const user = await getSessionUser()

  const [membership] = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, user.id),
        eq(memberships.orgId, orgId)
      )
    )
    .limit(1)

  if (!membership) {
    throw new Error("Unauthorized: User is not a member of this organisation")
  }

  return { role: membership.role }
}

/**
 * Require that the current user has one of the specified roles in the organisation
 * @throws Error with status 403 if user doesn't have required role
 */
export async function requireRole(
  orgId: string,
  allowedRoles: Role[]
): Promise<void> {
  const { role } = await requireOrg(orgId)

  if (!allowedRoles.includes(role)) {
    const error = new Error(
      `Forbidden: User role '${role}' is not authorized. Required: ${allowedRoles.join(", ")}`
    )
    ;(error as any).statusCode = 403
    throw error
  }
}

/**
 * Get active organisation and venue from HTTP-only cookies
 * @throws Error with status 400 if cookies are missing or invalid
 * @returns Active context with orgId, venueId, and userId
 */
export async function getActiveContext(): Promise<ActiveContext> {
  const user = await getSessionUser()
  const cookieStore = await cookies()
  
  const orgId = cookieStore.get("activeOrgId")?.value
  const venueId = cookieStore.get("activeVenueId")?.value

  if (!orgId || !venueId) {
    const error = new Error("No active venue selected. Please select a venue from the venue switcher.")
    ;(error as any).statusCode = 400
    throw error
  }

  // Verify user has access to this org
  const [membership] = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, user.id),
        eq(memberships.orgId, orgId)
      )
    )
    .limit(1)

  if (!membership) {
    const error = new Error("Unauthorized: No access to the selected organisation")
    ;(error as any).statusCode = 403
    throw error
  }

  // Verify venue belongs to org
  const [venue] = await db
    .select()
    .from(venues)
    .where(
      and(
        eq(venues.id, venueId),
        eq(venues.orgId, orgId)
      )
    )
    .limit(1)

  if (!venue) {
    const error = new Error("Invalid venue selection")
    ;(error as any).statusCode = 403
    throw error
  }

  return {
    orgId,
    venueId,
    userId: user.id,
  }
}

/**
 * Create an audit log entry for an action
 * @param action - Description of the action performed
 * @param before - State before the action (optional)
 * @param after - State after the action (optional)
 * @param orgId - Organisation ID where the action occurred
 * @param request - Optional request object to extract IP and user agent
 * @returns The created audit log entry
 */
export async function withAudit(
  action: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  orgId: string,
  request?: {
    headers?: {
      get(name: string): string | null
    }
  }
): Promise<void> {
  const user = await getSessionUser()

  const auditEntry: NewAuditLog = {
    orgId,
    actorUserId: user.id,
    action,
    before: before || undefined,
    after: after || undefined,
    ip: request?.headers?.get("x-forwarded-for") || request?.headers?.get("x-real-ip") || undefined,
    userAgent: request?.headers?.get("user-agent") || undefined,
  }

  await db.insert(auditLogs).values(auditEntry)
}
