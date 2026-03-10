import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { z } from "zod";
import { db } from "@/db";
import { ingredients, suppliers, ingredientSuppliers } from "@/db/schema";
import { getSessionUser, requireOrg, requireRole } from "@/lib/authz";
import { eq, and } from "drizzle-orm";

export const runtime = "nodejs";

// Unit normalization
const UNIT_CONVERSIONS: Record<string, { base: string; factor: number }> = {
  kg: { base: "g", factor: 1000 },
  l: { base: "ml", factor: 1000 },
  g: { base: "g", factor: 1 },
  ml: { base: "ml", factor: 1 },
  each: { base: "each", factor: 1 },
};

const IngredientRowSchema = z.object({
  ingredient_name: z.string().min(1),
  unit: z.enum(["g", "kg", "ml", "l", "each"]),
  purchase_pack_size: z.coerce.number().positive(),
  purchase_unit: z.enum(["g", "kg", "ml", "l", "each"]),
  supplier_name: z.string().min(1),
  supplier_sku: z.string().optional(),
  pack_cost_cents: z.coerce.number().int().nonnegative(),
  preferred: z.enum(["yes", "no", "true", "false", "1", "0"]).transform(v => 
    v === "yes" || v === "true" || v === "1"
  ).optional().default("no"),
});

type IngredientRow = z.infer<typeof IngredientRowSchema>;

interface ImportError {
  row: number;
  message: string;
}

function normalizeToBaseUnit(qty: number, unit: string): { qty: number; unit: string } {
  const conversion = UNIT_CONVERSIONS[unit.toLowerCase()];
  if (!conversion) {
    throw new Error(`Unknown unit: ${unit}`);
  }
  return {
    qty: qty * conversion.factor,
    unit: conversion.base,
  };
}

/**
 * POST /api/import/ingredients
 * Import ingredients and supplier relationships from CSV
 * CSV columns: ingredient_name, unit, purchase_pack_size, purchase_unit, supplier_name, supplier_sku, pack_cost_cents, preferred
 * Idempotent: upserts ingredients by (orgId, name) and supplier items by (orgId, ingredientId, supplierId, supplierSku)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();

    const orgId = req.cookies.get("activeOrgId")?.value;
    const venueId = req.cookies.get("activeVenueId")?.value;

    if (!orgId || !venueId) {
      return NextResponse.json({ error: "No active organization or venue selected" }, { status: 400 });
    }

    await requireOrg(orgId);
    await requireRole(orgId, ["owner", "manager"]);

    const text = await req.text();

    if (!text || text.length === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }

    if (text.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }

    const { data, errors: parseErrors } = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, "_"),
    });

    if (parseErrors.length > 0) {
      return NextResponse.json({ 
        error: "CSV parsing failed", 
        details: parseErrors.map(e => e.message) 
      }, { status: 400 });
    }

    // Validate rows
    const errors: ImportError[] = [];
    const validRows: IngredientRow[] = [];

    for (let i = 0; i < data.length; i++) {
      try {
        const row = IngredientRowSchema.parse(data[i]);
        validRows.push(row);
      } catch (e) {
        if (e instanceof z.ZodError) {
          errors.push({
            row: i + 2,
            message: e.errors.map(err => `${err.path.join(".")}: ${err.message}`).join(", "),
          });
        } else {
          errors.push({
            row: i + 2,
            message: e instanceof Error ? e.message : "Unknown error",
          });
        }
      }
    }

    // Process valid rows
    let ingredientsInserted = 0;
    let ingredientsUpdated = 0;
    let supplierItemsInserted = 0;
    let supplierItemsUpdated = 0;
    const chunkSize = 100;

    for (let i = 0; i < validRows.length; i += chunkSize) {
      const chunk = validRows.slice(i, i + chunkSize);

      await db.transaction(async (tx) => {
        for (const row of chunk) {
          try {
            // Normalize units
            const baseUnitConversion = normalizeToBaseUnit(1, row.unit);
            const packConversion = normalizeToBaseUnit(row.purchase_pack_size, row.purchase_unit);

            // Calculate cost per base unit
            const costPerUnitCents = Math.round(row.pack_cost_cents / packConversion.qty);

            // Upsert ingredient by (orgId, name)
            const existingIngredient = await tx
              .select({ id: ingredients.id })
              .from(ingredients)
              .where(
                and(
                  eq(ingredients.orgId, orgId),
                  eq(ingredients.name, row.ingredient_name)
                )
              )
              .limit(1)
              .execute();

            let ingredientId: string;

            if (existingIngredient.length > 0) {
              // Update existing ingredient
              await tx
                .update(ingredients)
                .set({
                  unit: baseUnitConversion.unit,
                  costPerUnitCents,
                  updatedAt: new Date(),
                })
                .where(eq(ingredients.id, existingIngredient[0].id))
                .execute();
              ingredientId = existingIngredient[0].id;
              ingredientsUpdated++;
            } else {
              // Insert new ingredient
              const [newIngredient] = await tx
                .insert(ingredients)
                .values({
                  orgId,
                  name: row.ingredient_name,
                  unit: baseUnitConversion.unit,
                  costPerUnitCents,
                  isActive: true,
                })
                .returning({ id: ingredients.id })
                .execute();
              ingredientId = newIngredient.id;
              ingredientsInserted++;
            }

            // Upsert supplier
            const existingSupplier = await tx
              .select({ id: suppliers.id })
              .from(suppliers)
              .where(
                and(
                  eq(suppliers.orgId, orgId),
                  eq(suppliers.name, row.supplier_name)
                )
              )
              .limit(1)
              .execute();

            let supplierId: string;

            if (existingSupplier.length > 0) {
              supplierId = existingSupplier[0].id;
            } else {
              const [newSupplier] = await tx
                .insert(suppliers)
                .values({
                  orgId,
                  name: row.supplier_name,
                })
                .returning({ id: suppliers.id })
                .execute();
              supplierId = newSupplier.id;
            }

            // Calculate unit price (cost per base unit) based on pack
            const unitPriceCents = Math.round(row.pack_cost_cents / packConversion.qty);

            // Upsert supplier item
            const existingSupplierItem = await tx
              .select({ id: ingredientSuppliers.id })
              .from(ingredientSuppliers)
              .where(
                and(
                  eq(ingredientSuppliers.orgId, orgId),
                  eq(ingredientSuppliers.ingredientId, ingredientId),
                  eq(ingredientSuppliers.supplierId, supplierId)
                )
              )
              .limit(1)
              .execute();

            if (existingSupplierItem.length > 0) {
              // Update existing supplier item
              await tx
                .update(ingredientSuppliers)
                .set({
                  packSize: packConversion.qty.toString(),
                  packUnit: packConversion.unit,
                  unitPriceCents,
                  isPreferred: row.preferred,
                  sku: row.supplier_sku,
                  updatedAt: new Date(),
                })
                .where(eq(ingredientSuppliers.id, existingSupplierItem[0].id))
                .execute();
              supplierItemsUpdated++;
            } else {
              // Insert new supplier item
              await tx
                .insert(ingredientSuppliers)
                .values({
                  orgId,
                  ingredientId,
                  supplierId,
                  sku: row.supplier_sku || `${row.supplier_name}-${row.ingredient_name}`,
                  packSize: packConversion.qty.toString(),
                  packUnit: packConversion.unit,
                  unitPriceCents,
                  isPreferred: row.preferred,
                })
                .execute();
              supplierItemsInserted++;
            }
          } catch (e) {
            // Skip individual row errors within transaction
            console.error(`Error processing row: ${e}`);
          }
        }
      });
    }

    return NextResponse.json({
      ingredients: {
        inserted: ingredientsInserted,
        updated: ingredientsUpdated,
      },
      supplierItems: {
        inserted: supplierItemsInserted,
        updated: supplierItemsUpdated,
      },
      total: validRows.length,
      errors,
    });
  } catch (error) {
    console.error("Error importing ingredients:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import ingredients" },
      { status: 500 }
    );
  }
}
