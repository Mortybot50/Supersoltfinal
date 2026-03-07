import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/db"
import { ingredientSuppliers, ingredients, suppliers, type NewIngredientSupplier } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { requireOrg, requireRole } from "@/lib/authz"
import { createIngredientSupplierSchema } from "@/lib/inventory-schemas"

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const orgId = cookieStore.get("orgId")?.value

    if (!orgId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 })
    }

    await requireOrg(orgId)

    const { searchParams } = new URL(request.url)
    const ingredientId = searchParams.get("ingredientId")

    const whereConditions = [eq(ingredientSuppliers.orgId, orgId)]
    if (ingredientId) {
      whereConditions.push(eq(ingredientSuppliers.ingredientId, ingredientId))
    }

    const results = await db
      .select({
        id: ingredientSuppliers.id,
        orgId: ingredientSuppliers.orgId,
        ingredientId: ingredientSuppliers.ingredientId,
        supplierId: ingredientSuppliers.supplierId,
        packSize: ingredientSuppliers.packSize,
        packUnit: ingredientSuppliers.packUnit,
        unitPriceCents: ingredientSuppliers.unitPriceCents,
        leadTimeDays: ingredientSuppliers.leadTimeDays,
        sku: ingredientSuppliers.sku,
        isPreferred: ingredientSuppliers.isPreferred,
        createdAt: ingredientSuppliers.createdAt,
        supplierName: suppliers.name,
        ingredientName: ingredients.name,
      })
      .from(ingredientSuppliers)
      .leftJoin(suppliers, eq(ingredientSuppliers.supplierId, suppliers.id))
      .leftJoin(ingredients, eq(ingredientSuppliers.ingredientId, ingredients.id))
      .where(and(...whereConditions))
      .orderBy(ingredientSuppliers.isPreferred, suppliers.name)

    return NextResponse.json(results)
  } catch (error: any) {
    console.error("Error fetching ingredient suppliers:", error)
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
    const validated = createIngredientSupplierSchema.parse(body)

    // Verify ingredient and supplier belong to org
    const [ingredient] = await db
      .select()
      .from(ingredients)
      .where(and(eq(ingredients.id, validated.ingredientId), eq(ingredients.orgId, orgId)))
      .limit(1)

    if (!ingredient) {
      return NextResponse.json({ error: "Ingredient not found" }, { status: 404 })
    }

    const [supplier] = await db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.id, validated.supplierId), eq(suppliers.orgId, orgId)))
      .limit(1)

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 })
    }

    const newIngredientSupplier: NewIngredientSupplier = {
      orgId,
      ingredientId: validated.ingredientId,
      supplierId: validated.supplierId,
      packSize: validated.packSize?.toString() || null,
      packUnit: validated.packUnit || null,
      unitPriceCents: validated.unitPriceCents,
      leadTimeDays: validated.leadTimeDays,
      sku: validated.sku || null,
      isPreferred: validated.isPreferred,
    }

    const [created] = await db.insert(ingredientSuppliers).values(newIngredientSupplier).returning()

    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    console.error("Error creating ingredient supplier:", error)
    if (error.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    if (error.code === "23505") { // Unique constraint violation
      return NextResponse.json({ error: "This supplier is already linked to this ingredient" }, { status: 409 })
    }
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: error.status || 500 })
  }
}
