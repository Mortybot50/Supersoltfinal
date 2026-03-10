"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/currency";
import { FileText, Filter } from "lucide-react";
import Link from "next/link";

interface PurchaseOrder {
  id: string;
  number: string;
  status: string;
  expectedDate: string | null;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  createdAt: string;
  sentAt: string | null;
  receivedAt: string | null;
  supplierId: string;
  supplierName: string | null;
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-500",
  SENT: "bg-blue-500",
  PARTIAL: "bg-yellow-500",
  RECEIVED: "bg-green-500",
  CANCELLED: "bg-red-500",
};

export default function PurchasesPage() {
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Build query params
  const params = new URLSearchParams();
  if (status && status !== "all") {
    params.set("status", status);
  }
  if (search) {
    params.set("search", search);
  }
  const queryString = params.toString();
  const endpoint = queryString ? `/api/purchases?${queryString}` : "/api/purchases";

  const { data, isLoading } = useQuery<{ pos: PurchaseOrder[] }>({
    queryKey: [endpoint],
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Purchase Orders</h1>
          <p className="text-muted-foreground">Manage supplier orders and receiving</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Search PO Number</label>
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-po"
            />
          </div>
          <div className="w-full sm:w-48">
            <label className="text-sm font-medium mb-2 block">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger data-testid="select-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="PARTIAL">Partial</SelectItem>
                <SelectItem value="RECEIVED">Received</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Purchase Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Purchase Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : !data?.pos || data.pos.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              No purchase orders found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expected Date</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.pos.map((po) => (
                    <TableRow key={po.id} data-testid={`row-po-${po.id}`}>
                      <TableCell className="font-medium">{po.number}</TableCell>
                      <TableCell>{po.supplierName || "Unknown"}</TableCell>
                      <TableCell>
                        <Badge
                          className={statusColors[po.status] || "bg-gray-500"}
                          data-testid={`badge-status-${po.id}`}
                        >
                          {po.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {po.expectedDate
                          ? new Date(po.expectedDate).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(po.totalCents / 100)}
                      </TableCell>
                      <TableCell>
                        {new Date(po.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Link href={`/inventory/purchases/${po.id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            data-testid={`button-view-${po.id}`}
                          >
                            View
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
