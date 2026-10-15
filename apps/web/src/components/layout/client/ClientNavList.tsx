"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { CountBadge } from "@/components/ui/count-badge";
import { accessibleItemLabel, resolveActiveItem, type NavItem } from "@/lib/design/navigation";
import { NAV_ICONS } from "../nav-icons";
import { useVisibleClientNav } from "./use-visible-client-nav";

// Liste des entrées du portail client, dans la barre latérale — maquette de l'espace
// de la structure accompagnée (Excellence), qui range ses écrans dans une barre
// latérale plutôt que dans un en-tête à hamburger.
//
// TOUTES les entrées, à plat, sans section ni repli : le portail client en compte
// onze, elles tiennent dans la hauteur d'un écran de bureau (48 px × 11 = 528 px).
// C'est l'inverse de la barre du bas, qui n'en montre que quatre et range le reste
// dans « Plus » — les deux lisent la MÊME liste (buildClientNav), aucune entrée
// n'existe dans un seul des deux rendus. Ne jamais tronquer cette liste : une entrée
// rangée ici en « Plus » n'aurait plus de menu pour l'accueillir.
//
// Repliée : icône seule à l'écran, mais le libellé reste le nom accessible du lien
// (aria-label, pastille comprise) et s'affiche en infobulle au survol ET au focus
// clavier — jamais d'icône seule.
export function ClientNavList({ items, collapsed }: { items: readonly NavItem[]; collapsed: boolean }) {
  const pathname = usePathname();
  const visibleItems = useVisibleClientNav(items);
  const active = resolveActiveItem([{ id: "client", label: null, items: visibleItems }], pathname);

  return (
    <div className={cn("flex flex-1 flex-col px-3 py-1", collapsed ? "overflow-visible" : "overflow-y-auto")}>
      {/* Pas d'aria-label ici : le lecteur d'écran annonce déjà « Navigation du
          portail » en entrant dans le <nav> — deux libellés imbriqués se répètent. */}
      <ul className="flex flex-col gap-0.5">
        {visibleItems.map((item) => (
          <li key={item.id}>
            <NavEntry item={item} isActive={item.id === active?.id} collapsed={collapsed} />
          </li>
        ))}
      </ul>
    </div>
  );
}

// Entrée de navigation. La page courante se reconnaît à la carte (`bg-card`) et à la
// graisse — comme au cabinet : on ne colore jamais l'icône en accent, l'icône garde
// donc `ink2` dans les deux états.
//
// Hauteur 48 px et texte 18 px : la densité du portail client (§3 de DESIGN.md), une
// taille au-dessus du cabinet (44 px / 16 px). C'est ce qui fait tenir onze entrées
// dans une barre latérale sans la rendre compacte.
function NavEntry({ item, isActive, collapsed }: { item: NavItem; isActive: boolean; collapsed: boolean }) {
  const Icon = NAV_ICONS[item.icon];
  const hasCount = (item.count ?? 0) > 0;
  const label = accessibleItemLabel(item);

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        "group/item relative flex h-12 items-center gap-3 whitespace-nowrap rounded-lg px-2.5 text-lg text-ink transition-colors",
        collapsed ? "justify-center" : "justify-between",
        isActive ? "bg-card font-bold" : "hover:bg-line"
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center">
          <Icon className="h-[22px] w-[22px] text-ink2" aria-hidden="true" />
          {collapsed && (hasCount || item.attentionLabel) && (
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-accent-fill" aria-hidden="true" />
          )}
        </span>
        {!collapsed && <span className="truncate">{item.label}</span>}
      </span>
      {!collapsed && hasCount && (
        <>
          <CountBadge count={item.count ?? 0} />
          <span className="sr-only">, {item.countLabel}</span>
        </>
      )}
      {collapsed && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 rounded-md bg-ink-fill px-2.5 py-1 text-sm font-normal text-on-ink shadow-eoda-md group-hover/item:block group-focus-visible/item:block"
        >
          {label}
        </span>
      )}
    </Link>
  );
}
