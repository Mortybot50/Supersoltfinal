import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useDataStore } from "@/lib/store/dataStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageShell, PageToolbar } from "@/components/shared";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CatalogMapping {
  square_item_id: string;
  square_item_name: string;
  recipe_id: string | null;
  status: "mapped" | "unmapped" | "inactive";
}

interface ModifierMapping {
  square_modifier_id: string;
  square_modifier_name: string;
  ingredient_id: string | null;
  adjustment: string; // e.g. "+30g"
  adjustment_type: "add" | "remove" | "replace";
}

interface WasteFactor {
  id?: string;
  ingredient_id: string;
  waste_percent: number;
  waste_type: "trim" | "spillage" | "evaporation" | "overportioning";
  notes: string;
}

interface CatalogMappingsResponse {
  catalog: CatalogMapping[];
  modifiers: ModifierMapping[];
  waste_factors: WasteFactor[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusBadge(status: CatalogMapping["status"]) {
  switch (status) {
    case "mapped":
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          Mapped
        </Badge>
      );
    case "unmapped":
      return (
        <Badge className="bg-amber-100 text-amber-800 border-amber-200">
          Unmapped
        </Badge>
      );
    case "inactive":
      return <Badge variant="secondary">Inactive</Badge>;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function POSMapping() {
  const { currentVenueId, organization } = useAuth();
  const { recipes, ingredients } = useDataStore();
  const queryClient = useQueryClient();

  // Local edit state overlays on top of server data
  const [catalogEdits, setCatalogEdits] = useState<
    Record<string, string | null>
  >({});
  const [modifierEdits, setModifierEdits] = useState<
    Record<string, Partial<ModifierMapping>>
  >({});
  const [wasteEdits, setWasteEdits] = useState<
    Record<string, Partial<WasteFactor>>
  >({});
  const [newWaste, setNewWaste] = useState<Partial<WasteFactor>>({
    waste_percent: 0,
    waste_type: "trim",
    notes: "",
  });

  const orgId = organization?.id;

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data, isLoading, isError } = useQuery<CatalogMappingsResponse>({
    queryKey: ["catalog-mappings", orgId, currentVenueId],
    queryFn: async () => {
      const res = await fetch(
        `/api/inventory?action=get-catalog-mappings&org_id=${orgId}&venue_id=${currentVenueId}`,
      );
      if (!res.ok) throw new Error("Failed to fetch catalog mappings");
      return res.json();
    },
    enabled: !!orgId && !!currentVenueId,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/inventory?action=sync-catalog`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId, venue_id: currentVenueId }),
      });
      if (!res.ok) throw new Error("Sync failed");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Square catalog synced successfully");
      queryClient.invalidateQueries({
        queryKey: ["catalog-mappings", orgId, currentVenueId],
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveMappingMutation = useMutation({
    mutationFn: async (payload: {
      type: "catalog" | "modifier" | "waste";
      data: unknown;
    }) => {
      const res = await fetch(`/api/inventory?action=save-mapping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgId,
          venue_id: currentVenueId,
          ...payload,
        }),
      });
      if (!res.ok) throw new Error("Failed to save mapping");
      return res.json();
    },
    onSuccess: (_, vars) => {
      toast.success(
        vars.type === "catalog"
          ? "Recipe mapping saved"
          : vars.type === "modifier"
            ? "Modifier mapping saved"
            : "Waste factor saved",
      );
      queryClient.invalidateQueries({
        queryKey: ["catalog-mappings", orgId, currentVenueId],
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Derived data ──────────────────────────────────────────────────────────────

  const catalog: CatalogMapping[] = data?.catalog ?? [];
  const modifiers: ModifierMapping[] = data?.modifiers ?? [];
  const wasteFactors: WasteFactor[] = data?.waste_factors ?? [];

  // Merge local edits over server data for catalog
  const mergedCatalog = catalog.map((item) => ({
    ...item,
    recipe_id:
      item.square_item_id in catalogEdits
        ? catalogEdits[item.square_item_id]
        : item.recipe_id,
  }));

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <PageShell
      toolbar={
        <PageToolbar
          title="POS Mapping"
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sync from Square
            </Button>
          }
        />
      }
    >
      <div className="p-6 space-y-4">
        {isError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            Failed to load catalog mappings. Check your Square connection.
          </div>
        )}

        <Tabs defaultValue="catalog">
          <TabsList>
            <TabsTrigger value="catalog">Catalog Mappings</TabsTrigger>
            <TabsTrigger value="modifiers">Modifier Mappings</TabsTrigger>
            <TabsTrigger value="waste">Waste Factors</TabsTrigger>
          </TabsList>

          {/* ── Catalog Mappings ─────────────────────────────────────────────── */}
          <TabsContent value="catalog" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Square Catalog Items
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {mergedCatalog.filter((c) => c.recipe_id).length}/
                    {mergedCatalog.length} mapped
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Square Item</TableHead>
                        <TableHead>Recipe</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-24">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mergedCatalog.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="text-center text-muted-foreground py-8"
                          >
                            No catalog items found. Sync from Square to import.
                          </TableCell>
                        </TableRow>
                      ) : (
                        mergedCatalog.map((item) => (
                          <TableRow key={item.square_item_id}>
                            <TableCell className="font-medium">
                              {item.square_item_name}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={item.recipe_id ?? "__none__"}
                                onValueChange={(val) =>
                                  setCatalogEdits((prev) => ({
                                    ...prev,
                                    [item.square_item_id]:
                                      val === "__none__" ? null : val,
                                  }))
                                }
                              >
                                <SelectTrigger className="w-56 h-8 text-sm">
                                  <SelectValue placeholder="Select recipe…" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">
                                    <span className="text-muted-foreground">
                                      — No mapping —
                                    </span>
                                  </SelectItem>
                                  {recipes.map((r) => (
                                    <SelectItem key={r.id} value={r.id}>
                                      {r.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>{statusBadge(item.status)}</TableCell>
                            <TableCell>
                              {item.square_item_id in catalogEdits && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  disabled={saveMappingMutation.isPending}
                                  onClick={() => {
                                    saveMappingMutation.mutate({
                                      type: "catalog",
                                      data: {
                                        square_item_id: item.square_item_id,
                                        recipe_id:
                                          catalogEdits[item.square_item_id],
                                      },
                                    });
                                    setCatalogEdits((prev) => {
                                      const next = { ...prev };
                                      delete next[item.square_item_id];
                                      return next;
                                    });
                                  }}
                                >
                                  Save
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Modifier Mappings ────────────────────────────────────────────── */}
          <TabsContent value="modifiers" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Square Modifier Mappings
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Modifier Name</TableHead>
                        <TableHead>Ingredient</TableHead>
                        <TableHead>Adjustment</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="w-24">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {modifiers.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="text-center text-muted-foreground py-8"
                          >
                            No modifiers found. Sync from Square to import.
                          </TableCell>
                        </TableRow>
                      ) : (
                        modifiers.map((mod) => {
                          const edit =
                            modifierEdits[mod.square_modifier_id] ?? {};
                          const current = { ...mod, ...edit };
                          const isDirty =
                            mod.square_modifier_id in modifierEdits;

                          return (
                            <TableRow key={mod.square_modifier_id}>
                              <TableCell className="font-medium">
                                {mod.square_modifier_name}
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={current.ingredient_id ?? "__none__"}
                                  onValueChange={(val) =>
                                    setModifierEdits((prev) => ({
                                      ...prev,
                                      [mod.square_modifier_id]: {
                                        ...prev[mod.square_modifier_id],
                                        ingredient_id:
                                          val === "__none__" ? null : val,
                                      },
                                    }))
                                  }
                                >
                                  <SelectTrigger className="w-44 h-8 text-sm">
                                    <SelectValue placeholder="Select ingredient…" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">
                                      <span className="text-muted-foreground">
                                        — None —
                                      </span>
                                    </SelectItem>
                                    {ingredients.map((ing) => (
                                      <SelectItem key={ing.id} value={ing.id}>
                                        {ing.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input
                                  className="w-24 h-8 text-sm"
                                  placeholder="+30g"
                                  value={current.adjustment ?? ""}
                                  onChange={(e) =>
                                    setModifierEdits((prev) => ({
                                      ...prev,
                                      [mod.square_modifier_id]: {
                                        ...prev[mod.square_modifier_id],
                                        adjustment: e.target.value,
                                      },
                                    }))
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={current.adjustment_type}
                                  onValueChange={(
                                    val: ModifierMapping["adjustment_type"],
                                  ) =>
                                    setModifierEdits((prev) => ({
                                      ...prev,
                                      [mod.square_modifier_id]: {
                                        ...prev[mod.square_modifier_id],
                                        adjustment_type: val,
                                      },
                                    }))
                                  }
                                >
                                  <SelectTrigger className="w-28 h-8 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="add">Add</SelectItem>
                                    <SelectItem value="remove">
                                      Remove
                                    </SelectItem>
                                    <SelectItem value="replace">
                                      Replace
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                {isDirty && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    disabled={saveMappingMutation.isPending}
                                    onClick={() => {
                                      saveMappingMutation.mutate({
                                        type: "modifier",
                                        data: { ...mod, ...edit },
                                      });
                                      setModifierEdits((prev) => {
                                        const next = { ...prev };
                                        delete next[mod.square_modifier_id];
                                        return next;
                                      });
                                    }}
                                  >
                                    Save
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Waste Factors ────────────────────────────────────────────────── */}
          <TabsContent value="waste" className="mt-4">
            <div className="space-y-4">
              {/* Existing waste factors */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Per-Ingredient Waste Factors
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ingredient</TableHead>
                        <TableHead>Waste %</TableHead>
                        <TableHead>Waste Type</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Effective Depletion</TableHead>
                        <TableHead className="w-24">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {wasteFactors.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center text-muted-foreground py-8"
                          >
                            No waste factors configured. Add one below.
                          </TableCell>
                        </TableRow>
                      ) : (
                        wasteFactors.map((wf) => {
                          const edit = wasteEdits[wf.ingredient_id] ?? {};
                          const current = { ...wf, ...edit };
                          const isDirty = wf.ingredient_id in wasteEdits;
                          const ingName =
                            ingredients.find(
                              (i) => i.id === current.ingredient_id,
                            )?.name ?? current.ingredient_id;
                          const effectiveQty = Math.round(
                            1000 * (1 - current.waste_percent / 100),
                          );

                          return (
                            <TableRow key={wf.ingredient_id}>
                              <TableCell className="font-medium">
                                {ingName}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    className="w-20 h-8 text-sm"
                                    value={current.waste_percent}
                                    onChange={(e) =>
                                      setWasteEdits((prev) => ({
                                        ...prev,
                                        [wf.ingredient_id]: {
                                          ...prev[wf.ingredient_id],
                                          waste_percent: Number(e.target.value),
                                        },
                                      }))
                                    }
                                  />
                                  <span className="text-sm text-muted-foreground">
                                    %
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={current.waste_type}
                                  onValueChange={(
                                    val: WasteFactor["waste_type"],
                                  ) =>
                                    setWasteEdits((prev) => ({
                                      ...prev,
                                      [wf.ingredient_id]: {
                                        ...prev[wf.ingredient_id],
                                        waste_type: val,
                                      },
                                    }))
                                  }
                                >
                                  <SelectTrigger className="w-36 h-8 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="trim">Trim</SelectItem>
                                    <SelectItem value="spillage">
                                      Spillage
                                    </SelectItem>
                                    <SelectItem value="evaporation">
                                      Evaporation
                                    </SelectItem>
                                    <SelectItem value="overportioning">
                                      Overportioning
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input
                                  className="w-40 h-8 text-sm"
                                  placeholder="Optional notes…"
                                  value={current.notes}
                                  onChange={(e) =>
                                    setWasteEdits((prev) => ({
                                      ...prev,
                                      [wf.ingredient_id]: {
                                        ...prev[wf.ingredient_id],
                                        notes: e.target.value,
                                      },
                                    }))
                                  }
                                />
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                1000g →{" "}
                                <span className="text-foreground font-medium">
                                  {effectiveQty}g
                                </span>{" "}
                                after {current.waste_percent}%{" "}
                                {current.waste_type} waste
                              </TableCell>
                              <TableCell>
                                {isDirty && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    disabled={saveMappingMutation.isPending}
                                    onClick={() => {
                                      saveMappingMutation.mutate({
                                        type: "waste",
                                        data: { ...wf, ...edit },
                                      });
                                      setWasteEdits((prev) => {
                                        const next = { ...prev };
                                        delete next[wf.ingredient_id];
                                        return next;
                                      });
                                    }}
                                  >
                                    Save
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Add new waste factor */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    Add Waste Factor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Ingredient
                      </label>
                      <Select
                        value={newWaste.ingredient_id ?? "__none__"}
                        onValueChange={(val) =>
                          setNewWaste((prev) => ({
                            ...prev,
                            ingredient_id: val === "__none__" ? undefined : val,
                          }))
                        }
                      >
                        <SelectTrigger className="w-52 h-8 text-sm">
                          <SelectValue placeholder="Select ingredient…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">
                            <span className="text-muted-foreground">
                              — Select —
                            </span>
                          </SelectItem>
                          {ingredients.map((ing) => (
                            <SelectItem key={ing.id} value={ing.id}>
                              {ing.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Waste %
                      </label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          className="w-20 h-8 text-sm"
                          value={newWaste.waste_percent ?? 0}
                          onChange={(e) =>
                            setNewWaste((prev) => ({
                              ...prev,
                              waste_percent: Number(e.target.value),
                            }))
                          }
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Type
                      </label>
                      <Select
                        value={newWaste.waste_type ?? "trim"}
                        onValueChange={(val: WasteFactor["waste_type"]) =>
                          setNewWaste((prev) => ({ ...prev, waste_type: val }))
                        }
                      >
                        <SelectTrigger className="w-36 h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="trim">Trim</SelectItem>
                          <SelectItem value="spillage">Spillage</SelectItem>
                          <SelectItem value="evaporation">
                            Evaporation
                          </SelectItem>
                          <SelectItem value="overportioning">
                            Overportioning
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Notes
                      </label>
                      <Input
                        className="w-48 h-8 text-sm"
                        placeholder="Optional…"
                        value={newWaste.notes ?? ""}
                        onChange={(e) =>
                          setNewWaste((prev) => ({
                            ...prev,
                            notes: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <Button
                      size="sm"
                      className="h-8"
                      disabled={
                        !newWaste.ingredient_id || saveMappingMutation.isPending
                      }
                      onClick={() => {
                        saveMappingMutation.mutate(
                          { type: "waste", data: newWaste },
                          {
                            onSuccess: () =>
                              setNewWaste({
                                waste_percent: 0,
                                waste_type: "trim",
                                notes: "",
                              }),
                          },
                        );
                      }}
                    >
                      Add Factor
                    </Button>
                  </div>
                  {newWaste.ingredient_id &&
                    (newWaste.waste_percent ?? 0) > 0 && (
                      <p className="mt-3 text-sm text-muted-foreground">
                        Preview: 1000g →{" "}
                        <span className="text-foreground font-medium">
                          {Math.round(
                            1000 * (1 - (newWaste.waste_percent ?? 0) / 100),
                          )}
                          g
                        </span>{" "}
                        after {newWaste.waste_percent}% {newWaste.waste_type}{" "}
                        waste
                      </p>
                    )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
}
