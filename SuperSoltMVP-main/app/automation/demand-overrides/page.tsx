"use client";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const createSchema = z.object({
  startsAt: z.string().min(1, "Start time is required"),
  endsAt: z.string().min(1, "End time is required"),
  multiplier: z.number().min(0.1).max(5),
  reason: z.string().optional(),
});

type CreateOverride = z.infer<typeof createSchema>;

type DemandOverride = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  multiplier: string;
  reason: string | null;
  createdAt: Date;
  createdBy: {
    name: string;
    email: string;
  } | null;
};

export default function DemandOverridesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();

  const { data: overrides = [], isLoading } = useQuery<DemandOverride[]>({
    queryKey: ["/api/demand-overrides"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateOverride) => {
      const res = await fetch("/api/demand-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create override");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demand-overrides"] });
      setIsModalOpen(false);
      toast({ title: "Override created", description: "Demand override has been added successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create override", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/demand-overrides/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete override");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demand-overrides"] });
      toast({ title: "Override deleted", description: "Demand override has been removed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete override", variant: "destructive" });
    },
  });

  const form = useForm<CreateOverride>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      startsAt: "",
      endsAt: "",
      multiplier: 1.0,
      reason: "",
    },
  });

  const onSubmit = (data: CreateOverride) => {
    createMutation.mutate(data);
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-demand-overrides">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Demand Overrides</h1>
          <p className="text-muted-foreground mt-1">
            Manually adjust forecast demand for special events, promotions, and known factors
          </p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          data-testid="button-add-override"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Override
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Overrides</CardTitle>
          <CardDescription>
            Multipliers applied to forecasts during specified time windows
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : overrides.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No demand overrides configured. Add one to adjust forecasts for specific periods.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Multiplier</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overrides.map((override) => (
                  <TableRow key={override.id} data-testid={`row-override-${override.id}`}>
                    <TableCell>{format(new Date(override.startsAt), "PPp")}</TableCell>
                    <TableCell>{format(new Date(override.endsAt), "PPp")}</TableCell>
                    <TableCell>
                      <span className="font-mono">{Number(override.multiplier).toFixed(2)}x</span>
                    </TableCell>
                    <TableCell>{override.reason || "-"}</TableCell>
                    <TableCell>{override.createdBy?.name || "Unknown"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(override.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${override.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent data-testid="modal-add-override">
          <DialogHeader>
            <DialogTitle>Add Demand Override</DialogTitle>
            <DialogDescription>
              Create a multiplier for a specific time window to adjust forecasts
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="startsAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        {...field}
                        data-testid="input-starts-at"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endsAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Time</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        {...field}
                        data-testid="input-ends-at"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="multiplier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Multiplier (0.1 - 5.0)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="5"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        data-testid="input-multiplier"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Local festival, Marketing campaign"
                        {...field}
                        data-testid="input-reason"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-submit"
                >
                  {createMutation.isPending ? "Creating..." : "Create Override"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
