import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/db"
import { ingredients, type NewIngredient } from "@/db/schema"
import { eq } from "drizzle-orm"
import { requireOrg, requireRole } from "@/lib/authz"
import { createIngredientSchema } from "@/lib/inventory-schemas"

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const orgId = cookieStore.get("orgId")?.value

    if (!orgId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 })
    }

    await requireOrg(orgId)

    const items = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.orgId, orgId))
      .orderBy(ingredients.name)

    return NextResponse.json(items)
  } catch (error: any) {
    console.error("Error fetching ingredients:", error)
    const status = error.statusCode || 500
    return NextResponse.json({ error: error.message || "Failed to fetch ingredients" }, { status })
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
    const validated = createIngredientSchema.parse(body)

    const newIngredient: NewIngredient = {
      orgId,
      name: validated.name,
      unit: validated.unit,
      costPerUnitCents: validated.costPerUnitCents,
      currentStockLevel: validated.currentStockLevel,
      isActive: validated.isActive,
    }

    const [created] = await db.insert(ingredients).values(newIngredient).returning()

    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    console.error("Error creating ingredient:", error)
    const status = error.statusCode || 500
    return NextResponse.json({ error: error.message || "Failed to create ingredient" }, { status })
  }
}
