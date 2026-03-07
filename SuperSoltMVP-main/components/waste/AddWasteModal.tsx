"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { track } from "@/lib/analytics";

interface AddWasteModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Ingredient {
  id: string;
  name: string;
  unit: string;
}

export function AddWasteModal({ open, onClose, onSuccess }: AddWasteModalProps) {
  const { toast } = useToast();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [ingredientId, setIngredientId] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState<"g" | "kg" | "ml" | "l" | "each">("g");
  const [reason, setReason] = useState<"prep" | "spoilage" | "overportion" | "transfer" | "theft" | "other">("spoilage");
  const [note, setNote] = useState("");

  // Fetch ingredients
  const { data: ingredientsData, isLoading: isLoadingIngredients } = useQuery<Ingredient[]>({
    queryKey: ["/api/ingredients"],
  });

  const createMutation = useMutation({
    mutationFn: async (payload: {
      date: string;
      ingredientId: string;
      qty: number;
      unit: string;
      reason: string;
      note?: string;
    }) => {
      const response = await fetch("/api/waste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create waste event");
      }
      return response.json();
    },
    onSuccess: (data) => {
      track("waste_logged", {
        ingredientId,
        qty: parseFloat(qty),
        unit,
        reason,
      });
      toast({
        title: "Waste logged",
        description: data.costCents !== null 
          ? `Recorded waste with estimated cost of A$${(data.costCents / 100).toFixed(2)}`
          : "Waste event has been recorded",
      });
      resetForm();
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to log waste",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setDate(format(new Date(), "yyyy-MM-dd"));
    setIngredientId("");
    setQty("");
    setUnit("g");
    setReason("spoilage");
    setNote("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!date || !ingredientId || !qty || !unit || !reason) {
      toast({
        title: "Validation error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const qtyNum = parseFloat(qty);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      toast({
        title: "Validation error",
        description: "Quantity must be a positive number",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      date,
      ingredientId,
      qty: qtyNum,
      unit,
      reason,
      note: note || undefined,
    });
  };

  const ingredients = ingredientsData ?? [];

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Waste Event</DialogTitle>
          <DialogDescription>
            Record a new waste event to track inventory loss and costs
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="date">Date *</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={format(new Date(), "yyyy-MM-dd")}
              data-testid="input-date"
            />
          </div>

          <div>
            <Label htmlFor="ingredient">Ingredient *</Label>
            <Select value={ingredientId} onValueChange={setIngredientId} disabled={isLoadingIngredients}>
              <SelectTrigger id="ingredient" data-testid="select-ingredient">
                <SelectValue placeholder={isLoadingIngredients ? "Loading..." : "Select ingredient..."} />
              </SelectTrigger>
              <SelectContent>
                {ingredients.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    No ingredients available
                  </div>
                ) : (
                  ingredients.map((ing) => (
                    <SelectItem key={ing.id} value={ing.id}>
                      {ing.name} ({ing.unit})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="qty">Quantity *</Label>
              <Input
                id="qty"
                type="number"
                min="0"
                step="0.01"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="0.00"
                data-testid="input-quantity"
              />
            </div>
            <div>
              <Label htmlFor="unit">Unit *</Label>
              <Select value={unit} onValueChange={(v: any) => setUnit(v)}>
                <SelectTrigger id="unit" data-testid="select-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="g">g</SelectItem>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="ml">ml</SelectItem>
                  <SelectItem value="l">l</SelectItem>
                  <SelectItem value="each">each</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="reason">Reason *</Label>
            <Select value={reason} onValueChange={(v: any) => setReason(v)}>
              <SelectTrigger id="reason" data-testid="select-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prep">Prep Loss</SelectItem>
                <SelectItem value="spoilage">Spoilage</SelectItem>
                <SelectItem value="overportion">Overportion</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
                <SelectItem value="theft">Theft</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="note">Note (Optional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Additional notes..."
              rows={3}
              data-testid="input-note"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={createMutation.isPending}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              data-testid="button-submit"
            >
              {createMutation.isPending ? "Saving..." : "Log Waste"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
