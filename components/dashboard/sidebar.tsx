"use client";

import { ROUTES } from "@/lib/constants";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: ROUTES.dashboard, label: "Overview" },
  { href: ROUTES.products, label: "My Products" },
  { href: ROUTES.alerts, label: "Alerts" },
  { href: ROUTES.addProduct, label: "Add Product" },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Dashboard navigation"
      className="w-56 shrink-0 border-r border-foreground/10 bg-background px-3 py-6"
    >
      <p className="mb-6 px-3 text-sm font-semibold uppercase tracking-wider text-foreground/50">
        Price Tracker
      </p>
      <ul role="list" className="space-y-1">
        {navItems.map(({ href, label }) => {
          const isActive = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-foreground text-background"
                    : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground",
                ].join(" ")}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
