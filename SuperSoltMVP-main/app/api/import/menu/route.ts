import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { z } from "zod";
import { db } from "@/db";
import { menuItems, ingredients, recipes } from "@/db/schema";
import { getSessionUser, requireOrg, requireRole } from "@/lib/authz";
import { eq, and } from "drizzle-orm";

export const runtime = "nodejs";

const MenuRowSchema = z.object({
  type: z.enum(["menu", "recipe"]),
  menu_item_name: z.string().min(1),
  price_cents: z.coerce.number().int().nonnegative().optional(),
  active: z.enum(["yes", "no", "true", "false", "1", "0"]).transform(v => 
    v === "yes" || v === "true" || v === "1"
  ).optional().default("yes"),
  ingredient_name: z.string().optional(),
  qty: z.coerce.number().positive().optional(),
  unit: z.string().optional(),
});

type MenuRow = z.infer<typeof MenuRowSchema>;

interface ImportError {
  row: number;
  message: string;
}

/**
 * POST /api/import/menu
 * Import menu items and recipes from CSV
 * CSV columns: type, menu_item_name, price_cents, active, ingredient_name, qty, unit
 * Supports nested recipes (ingredient_name can reference another menu_item_name)
 * Idempotent: upserts menu items by (orgId, name) and recipes by (menuItemId, ingredientId)
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
    const validRows: MenuRow[] = [];

    for (let i = 0; i < data.length; i++) {
      try {
        const row = MenuRowSchema.parse(data[i]);
        
        // Validate that menu rows have price_cents
        if (row.type === "menu" && row.price_cents === undefined) {
          errors.push({
            row: i + 2,
            message: "Menu items must have price_cents",
          });
          continue;
        }

        // Validate that recipe rows have ingredient_name, qty, unit
        if (row.type === "recipe" && (!row.ingredient_name || !row.qty || !row.unit)) {
          errors.push({
            row: i + 2,
            message: "Recipe rows must have ingredient_name, qty, and unit",
          });
          continue;
        }

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

    // Group rows by menu item
    const menuGroups = new Map<string, { menu: MenuRow; recipes: MenuRow[] }>();
    
    for (const row of validRows) {
      if (row.type === "menu") {
        if (!menuGroups.has(row.menu_item_name)) {
          menuGroups.set(row.menu_item_name, { menu: row, recipes: [] });
        } else {
          menuGroups.get(row.menu_item_name)!.menu = row;
        }
      } else if (row.type === "recipe") {
        if (!menuGroups.has(row.menu_item_name)) {
          menuGroups.set(row.menu_item_name, { 
            menu: { 
              type: "menu", 
              menu_item_name: row.menu_item_name, 
              price_cents: 0, 
              active: true 
            }, 
            recipes: [] 
          });
        }
        menuGroups.get(row.menu_item_name)!.recipes.push(row);
      }
    }

    let menuItemsInserted = 0;
    let menuItemsUpdated = 0;
    let recipesInserted = 0;
    let recipesUpdated = 0;

    // Fetch all ingredients and menu items once for lookups
    const ingredientsMap = new Map<string, string>();
    const orgIngredients = await db
      .select({ id: ingredients.id, name: ingredients.name })
      .from(ingredients)
      .where(eq(ingredients.orgId, orgId))
      .execute();

    orgIngredients.forEach(ing => {
      ingredientsMap.set(ing.name.toLowerCase().trim(), ing.id);
    });

    const menuItemsMap = new Map<string, string>();
    const orgMenuItems = await db
      .select({ id: menuItems.id, name: menuItems.name })
      .from(menuItems)
      .where(eq(menuItems.orgId, orgId))
      .execute();

    orgMenuItems.forEach(item => {
      menuItemsMap.set(item.name.toLowerCase().trim(), item.id);
    });

    // Process menu items first
    for (const [menuItemName, group] of menuGroups) {
      await db.transaction(async (tx) => {
        try {
          // Upsert menu item
          const existing = await tx
            .select({ id: menuItems.id })
            .from(menuItems)
            .where(
              and(
                eq(menuItems.orgId, orgId),
                eq(menuItems.name, menuItemName)
              )
            )
            .limit(1)
            .execute();

          let menuItemId: string;

          if (existing.length > 0) {
            // Update existing menu item
            if (group.menu.price_cents !== undefined) {
              await tx
                .update(menuItems)
                .set({
                  priceCents: group.menu.price_cents,
                  isActive: group.menu.active,
                })
                .where(eq(menuItems.id, existing[0].id))
                .execute();
            }
            menuItemId = existing[0].id;
            menuItemsUpdated++;
          } else {
            // Insert new menu item
            const [newItem] = await tx
              .insert(menuItems)
              .values({
                orgId,
                name: menuItemName,
                priceCents: group.menu.price_cents || 0,
                isActive: group.menu.active,
              })
              .returning({ id: menuItems.id })
              .execute();
            menuItemId = newItem.id;
            menuItemsInserted++;
            
            // Update local map
            menuItemsMap.set(menuItemName.toLowerCase().trim(), menuItemId);
          }

          // Delete existing recipes for this menu item (we'll re-insert)
          await tx
            .delete(recipes)
            .where(eq(recipes.menuItemId, menuItemId))
            .execute();

          // Insert recipes
          for (const recipeRow of group.recipes) {
            if (!recipeRow.ingredient_name || !recipeRow.qty || !recipeRow.unit) continue;

            // Check if ingredient is actually another menu item (nested recipe)
            const isNestedRecipe = menuItemsMap.has(recipeRow.ingredient_name.toLowerCase().trim());
            
            let targetId: string | undefined;

            if (isNestedRecipe) {
              // Sub-menu item (nested recipe)
              targetId = menuItemsMap.get(recipeRow.ingredient_name.toLowerCase().trim());
              
              if (targetId) {
                await tx
                  .insert(recipes)
                  .values({
                    menuItemId,
                    subMenuItemId: targetId,
                    ingredientId: null,
                    quantity: recipeRow.qty,
                    unit: recipeRow.unit,
                  })
                  .execute();
                recipesInserted++;
              }
            } else {
              // Regular ingredient
              targetId = ingredientsMap.get(recipeRow.ingredient_name.toLowerCase().trim());
              
              if (targetId) {
                await tx
                  .insert(recipes)
                  .values({
                    menuItemId,
                    ingredientId: targetId,
                    subMenuItemId: null,
                    quantity: recipeRow.qty,
                    unit: recipeRow.unit,
                  })
                  .execute();
                recipesInserted++;
              } else {
                errors.push({
                  row: 0, // Can't track row number here
                  message: `Ingredient not found: "${recipeRow.ingredient_name}" for menu item "${menuItemName}"`,
                });
              }
            }
          }
        } catch (e) {
          console.error(`Error processing menu item ${menuItemName}:`, e);
        }
      });
    }

    return NextResponse.json({
      menuItems: {
        inserted: menuItemsInserted,
        updated: menuItemsUpdated,
      },
      recipes: {
        inserted: recipesInserted,
        updated: recipesUpdated,
      },
      total: validRows.length,
      errors,
    });
  } catch (error) {
    console.error("Error importing menu:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import menu" },
      { status: 500 }
    );
  }
}
