"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { resolveActiveItem, type NavItem } from "@/lib/design/navigation";
import { NAV_ICONS } from "../nav-icons";

type Variant = "top" | "bottom";

// Navigation principale du portail client — maquette « Portail Client v2 ».
// Deux rendus de la MÊME liste : onglets dans l'en-tête sur écran large, barre fixe
// en bas sur mobile (brief §7.3 : le pouce l'atteint). Un seul des deux est visible
// à la fois (`display: none` sur l'autre), donc un seul est lu.
// Icône ET libellé partout ; cible ≥ 48 px côté client.
export function ClientNavBar({ items, variant }: { items: readonly NavItem[]; variant: Variant }) {
  const pathname = usePathname();
  const activeId = resolveActiveItem([{ id: "client", label: null, items }], pathname)?.id ?? null;
  const isTop = variant === "top";

  return (
    <nav
      aria-label="Navigation principale"
      className={cn(
        isTop
          ? "hidden min-w-0 flex-1 md:flex"
          : "fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
      )}
    >
      <ul className={cn("flex w-full", isTop ? "flex-wrap gap-1" : "justify-around")}>
        {items.map((item) => {
          const Icon = NAV_ICONS[item.icon];
          const isActive = item.id === activeId;
          return (
            <li key={item.id} className={isTop ? undefined : "flex-1"}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex items-center text-ink transition-colors hover:bg-soft",
                  isTop
                    ? "h-[52px] gap-2 whitespace-nowrap border-b-[3px] px-3.5 text-[17px]"
                    : "min-h-16 flex-col justify-center gap-1 border-t-[3px] px-1 text-sm",
                  isActive ? "border-accent-text font-bold" : "border-transparent"
                )}
              >
                <span className="relative">
                  <Icon className={isTop ? "h-[22px] w-[22px]" : "h-6 w-6"} aria-hidden="true" />
                  {item.attentionLabel && (
                    <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-accent-fill" aria-hidden="true" />
                  )}
                </span>
                <span className={isTop ? undefined : "text-center leading-tight"}>{item.label}</span>
                {item.attentionLabel && <span className="sr-only">, {item.attentionLabel}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
