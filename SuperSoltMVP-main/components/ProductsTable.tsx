"use client";

import { DataTable } from "@/components/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  value: number;
  percentOfSales: number;
  change: number;
}

const productColumns: ColumnDef<Product>[] = [
  {
    accessorKey: "name",
    header: "Product",
  },
  {
    accessorKey: "value",
    header: "Value",
    cell: ({ row }) => {
      const value = Number(row.getValue("value"));
      const formatted = new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: "AUD",
      }).format(value);
      return <div className="font-medium">{formatted}</div>;
    },
  },
  {
    accessorKey: "percentOfSales",
    header: "% of Sales",
    cell: ({ row }) => {
      const percent = Number(row.getValue("percentOfSales"));
      return <div>{percent.toFixed(1)}%</div>;
    },
  },
  {
    accessorKey: "change",
    header: "Change",
    cell: ({ row }) => {
      const change = Number(row.getValue("change"));
      const isPositive = change > 0;
      return (
        <div className="flex items-center gap-1">
          {isPositive ? (
            <TrendingUp className="h-3 w-3 text-emerald-500 dark:text-emerald-400" />
          ) : (
            <TrendingDown className="h-3 w-3 text-red-500 dark:text-red-400" />
          )}
          <span
            className={cn(
              "font-medium",
              isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            )}
          >
            {isPositive ? "+" : ""}
            {change.toFixed(1)}%
          </span>
        </div>
      );
    },
  },
];

export function ProductsTable({ products }: { products: Product[] }) {
  return <DataTable columns={productColumns} data={products ?? []} />;
}
