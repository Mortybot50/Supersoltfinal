import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/db"
import { suppliers, type NewSupplier } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { requireOrg, requireRole } from "@/lib/authz"
import { createSupplierSchema } from "@/lib/inventory-schemas"

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const orgId = cookieStore.get("orgId")?.value

    if (!orgId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 })
    }

    await requireOrg(orgId)

    const results = await db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.orgId, orgId), eq(suppliers.isActive, true)))
      .orderBy(suppliers.name)

    return NextResponse.json(results)
  } catch (error: any) {
    console.error("Error fetching suppliers:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: error.status || 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const orgId = cookieStore.get("orgId")?.value

    if (!orgId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 })
    }

    await requireRole(orgId, ["owner", "manager"])

    const body = await request.json()
    const validated = createSupplierSchema.parse(body)

    const newSupplier: NewSupplier = {
      orgId,
      name: validated.name,
      contactEmail: validated.contactEmail || null,
      phone: validated.phone || null,
      notes: validated.notes || null,
      isActive: validated.isActive,
    }

    const [created] = await db.insert(suppliers).values(newSupplier).returning()

    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    console.error("Error creating supplier:", error)
    if (error.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: error.status || 500 })
  }
}
