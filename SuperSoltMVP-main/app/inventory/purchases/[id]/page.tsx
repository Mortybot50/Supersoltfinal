"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";
import { ArrowLeft, Send, X, Package } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

interface PurchaseOrder {
  id: string;
  number: string;
  status: string;
  currency: string;
  expectedDate: string | null;
  notes: string | null;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  createdAt: string;
  sentAt: string | null;
  receivedAt: string | null;
  supplierName: string | null;
}

interface POLine {
  id: string;
  ingredientName: string | null;
  packLabel: string | null;
  baseUom: string;
  baseQtyPerPack: number;
  packsOrdered: string;
  packsReceived: string;
  packCostCents: number;
  lineTotalCents: number;
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-500",
  SENT: "bg-blue-500",
  PARTIAL: "bg-yellow-500",
  RECEIVED: "bg-green-500",
  CANCELLED: "bg-red-500",
};

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [receiveAmounts, setReceiveAmounts] = useState<Record<string, number>>({});

  const { data, isLoading } = useQuery<{ po: PurchaseOrder; lines: POLine[] }>({
    queryKey: ["/api/purchases", params.id],
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/purchases/${params.id}/send`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/purchases", params.id] });
      toast({ title: "Purchase order sent successfully" });
    },
    onError: () => {
      toast({
        title: "Error sending purchase order",
        variant: "destructive",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/purchases/${params.id}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/purchases", params.id] });
      toast({ title: "Purchase order cancelled" });
    },
    onError: () => {
      toast({
        title: "Error cancelling purchase order",
        variant: "destructive",
      });
    },
  });

  const receiveMutation = useMutation({
    mutationFn: async (lines: { lineId: string; packsReceived: number }[]) => {
      return apiRequest("POST", `/api/purchases/${params.id}/receive`, { lines });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/purchases", params.id] });
      setReceiveModalOpen(false);
      setReceiveAmounts({});
      toast({ title: "Items received successfully" });
    },
    onError: () => {
      toast({
        title: "Error receiving items",
        variant: "destructive",
      });
    },
  });

  const handleReceiveAll = () => {
    if (!data?.lines) return;
    const amounts: Record<string, number> = {};
    data.lines.forEach((line) => {
      const remaining = parseFloat(line.packsOrdered) - parseFloat(line.packsReceived);
      if (remaining > 0) {
        amounts[line.id] = remaining;
      }
    });
    setReceiveAmounts(amounts);
  };

  const handleSubmitReceive = () => {
    const lines = Object.entries(receiveAmounts)
      .filter(([, amount]) => amount > 0)
      .map(([lineId, amount]) => ({ lineId, packsReceived: amount }));

    if (lines.length === 0) {
      toast({ title: "Please enter quantities to receive", variant: "destructive" });
      return;
    }

    receiveMutation.mutate(lines);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto p-6">
        <p>Purchase order not found</p>
      </div>
    );
  }

  const { po, lines } = data;
  const canSend = po.status === "DRAFT";
  const canCancel = po.status === "DRAFT";
  const canReceive = po.status === "SENT" || po.status === "PARTIAL";

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/inventory/purchases">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{po.number}</h1>
            <p className="text-muted-foreground">{po.supplierName}</p>
          </div>
          <Badge className={statusColors[po.status]} data-testid="badge-status">
            {po.status}
          </Badge>
        </div>
        <div className="flex gap-2">
          {canSend && (
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending}
              data-testid="button-send"
            >
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          )}
          {canReceive && (
            <Button
              onClick={() => setReceiveModalOpen(true)}
              data-testid="button-receive"
            >
              <Package className="h-4 w-4 mr-2" />
              Receive
            </Button>
          )}
          {canCancel && (
            <Button
              variant="destructive"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              data-testid="button-cancel"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* PO Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Expected Date</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium">
              {po.expectedDate
                ? new Date(po.expectedDate).toLocaleDateString()
                : "Not set"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(po.totalCents / 100)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Created</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium">
              {new Date(po.createdAt).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lines */}
      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingredient</TableHead>
                  <TableHead>Pack</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Pack Cost</TableHead>
                  <TableHead className="text-right">Line Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="font-medium">
                      {line.ingredientName || "Unknown"}
                    </TableCell>
                    <TableCell>{line.packLabel || `${line.baseQtyPerPack}${line.baseUom}`}</TableCell>
                    <TableCell className="text-right">{parseFloat(line.packsOrdered).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{parseFloat(line.packsReceived).toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(line.packCostCents / 100)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(line.lineTotalCents / 100)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Totals */}
          <div className="mt-6 border-t pt-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-medium">
                {formatCurrency(po.subtotalCents / 100)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax:</span>
              <span className="font-medium">
                {formatCurrency(po.taxCents / 100)}
              </span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>Total:</span>
              <span>{formatCurrency(po.totalCents / 100)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Receive Modal */}
      <Dialog open={receiveModalOpen} onOpenChange={setReceiveModalOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Receive Items</DialogTitle>
            <DialogDescription>
              Enter the quantities received for each item
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Button
              variant="outline"
              onClick={handleReceiveAll}
              className="w-full"
              data-testid="button-receive-all"
            >
              Receive All Remaining
            </Button>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingredient</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">Previously Received</TableHead>
                  <TableHead className="text-right">Receive Now</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => {
                  const remaining = parseFloat(line.packsOrdered) - parseFloat(line.packsReceived);
                  return (
                    <TableRow key={line.id}>
                      <TableCell>{line.ingredientName}</TableCell>
                      <TableCell className="text-right">{parseFloat(line.packsOrdered).toFixed(2)}</TableCell>
                      <TableCell className="text-right">{parseFloat(line.packsReceived).toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={receiveAmounts[line.id] || ""}
                          onChange={(e) =>
                            setReceiveAmounts({
                              ...receiveAmounts,
                              [line.id]: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-24 text-right"
                          data-testid={`input-receive-${line.id}`}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReceiveModalOpen(false)}
              data-testid="button-cancel-receive"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitReceive}
              disabled={receiveMutation.isPending}
              data-testid="button-submit-receive"
            >
              Receive Items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
