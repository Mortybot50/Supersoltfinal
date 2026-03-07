"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, NavItem } from "@/app/nav.config";
import { useState, useMemo, useEffect } from "react";
import { ChevronDown } from "lucide-react";

function isActive(pathname: string, href?: string) {
  return !!href && pathname.startsWith(href);
}

export function Sidebar({ badges }: { badges?: Record<string, number> }) {
  const pathname = usePathname();

  // Open the group that matches the current route by default (else Inventory)
  const defaultOpen = useMemo(() => {
    const match = NAV.find(
      g => g.children?.some(c => isActive(pathname, c.href))
    );
    return match?.label ?? "Inventory";
  }, [pathname]);

  const [open, setOpen] = useState<string | null>(defaultOpen);

  // Sync open state with pathname changes
  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen]);

  return (
    <aside className="w-64 shrink-0 border-r border-black/5 bg-[var(--surface)] px-2 py-4">
      <div className="mb-3 px-2 text-xs font-semibold tracking-wide text-[var(--muted)]">
        SuperSolt
      </div>

      {NAV.map((item) => {
        // Standalone link (Dashboard)
        if (!item.children) {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.label}
              href={item.href!}
              className={[
                "group flex items-center gap-2 rounded-md px-2 py-2 text-sm transition",
                active
                  ? "bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]/25 shadow-[0_0_0_3px_rgba(104,227,101,0.15)]"
                  : "hover:bg-black/5"
              ].join(" ")}
            >
              {item.icon && <item.icon className="h-4 w-4 opacity-80" />}
              <span>{item.label}</span>
            </Link>
          );
        }

        const opened = open === item.label;

        return (
          <div key={item.label} className="mb-1">
            <button
              onClick={() => setOpen(opened ? null : item.label)}
              className="group flex w-full items-center justify-between rounded-md px-2 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)] hover:text-[var(--text)]"
            >
              <div className="flex items-center gap-2">
                {item.icon && <item.icon className="h-4 w-4 opacity-80" />}
                {item.label}
              </div>
              <ChevronDown className={["h-4 w-4 transition-transform", opened ? "rotate-180" : ""].join(" ")} />
            </button>

            {opened && (
              <div className="space-y-1">
                {item.children!.map((c: NavItem) => {
                  const active = isActive(pathname, c.href);
                  return (
                    <Link
                      key={c.label}
                      href={c.href!}
                      className={[
                        "flex items-center justify-between rounded-md px-8 py-2 text-sm transition",
                        active
                          ? "bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]/25 shadow-[0_0_0_3px_rgba(104,227,101,0.15)]"
                          : "hover:bg-black/5"
                      ].join(" ")}
                    >
                      <span className={c.primary ? "font-medium" : ""}>
                        {c.label}{c.soon ? " · soon" : ""}
                      </span>
                      {c.badgeKey && badges?.[c.badgeKey] ? (
                        <span className="ml-2 rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-xs font-medium text-[var(--accent-fg)]">
                          {badges[c.badgeKey]}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}
