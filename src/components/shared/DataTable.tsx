import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────

export interface DataTableColumn<T> {
  key: keyof T | string;
  header: string;
  /** Optional render function. Receives the row value and full row. */
  render?: (value: unknown, row: T) => React.ReactNode;
  /** Align content: default left, use "right" for numbers/currency */
  align?: "left" | "right" | "center";
  /** Extra classes for header cell */
  headerClassName?: string;
  /** Extra classes for data cell */
  cellClassName?: string;
  /** Min width override */
  minWidth?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  /** Key to use for row identity (defaults to "id") */
  rowKey?: keyof T;
  /** Called when a row is clicked */
  onRowClick?: (row: T) => void;
  /** Show when data is empty */
  emptyState?: React.ReactNode;
  /** Show loading skeleton */
  loading?: boolean;
  /** Number of skeleton rows when loading */
  skeletonRows?: number;
  className?: string;
}

// ─── Helpers ─────────────────────────────────────────────────

function getCellValue<T>(row: T, key: keyof T | string): unknown {
  return (row as Record<string, unknown>)[key as string];
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div
            className="h-4 rounded-md shimmer"
            style={{ width: `${60 + (i % 3) * 20}%` }}
          />
        </td>
      ))}
    </tr>
  );
}

// ─── DataTable ────────────────────────────────────────────────

export function DataTable<T>({
  columns,
  data,
  rowKey = "id" as keyof T,
  onRowClick,
  emptyState,
  loading = false,
  skeletonRows = 5,
  className,
}: DataTableProps<T>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden",
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {/* Sticky header */}
          <thead className="sticky top-0 z-10 bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-sm border-b border-border/60">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key as string}
                  className={cn(
                    "px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap",
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                        ? "text-center"
                        : "text-left",
                    col.headerClassName,
                  )}
                  style={col.minWidth ? { minWidth: col.minWidth } : undefined}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-border/40">
            {/* Loading state */}
            {loading &&
              Array.from({ length: skeletonRows }).map((_, i) => (
                <SkeletonRow key={i} cols={columns.length} />
              ))}

            {/* Data rows */}
            {!loading &&
              data.map((row, rowIndex) => {
                const key =
                  (getCellValue(row, rowKey as string) as string | number) ??
                  rowIndex;
                return (
                  <tr
                    key={key}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "transition-colors duration-100",
                      onRowClick
                        ? "cursor-pointer hover:bg-muted/50"
                        : "hover:bg-muted/30",
                    )}
                  >
                    {columns.map((col) => {
                      const raw = getCellValue(row, col.key as string);
                      return (
                        <td
                          key={col.key as string}
                          className={cn(
                            "px-4 py-3",
                            col.align === "right"
                              ? "text-right tabular-nums font-medium"
                              : col.align === "center"
                                ? "text-center"
                                : "text-left",
                            col.cellClassName,
                          )}
                        >
                          {col.render
                            ? col.render(raw, row)
                            : (raw as React.ReactNode)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

            {/* Empty state */}
            {!loading && data.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  {emptyState || "No data to display."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
