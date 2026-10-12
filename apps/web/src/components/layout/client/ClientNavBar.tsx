"use client";

import { useId } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis } from "lucide-react";
import { cn } from "@/lib/utils";
import { splitClientNav } from "@/lib/design/client-navigation";
import type { NavItem } from "@/lib/design/navigation";
import { NAV_ICONS } from "../nav-icons";
import { useDisclosure } from "./use-disclosure";

type Variant = "top" | "bottom";

// Navigation principale du portail client — maquette « Portail Client v2 ».
// Deux rendus de la MÊME répartition (splitClientNav) : onglets dans l'en-tête à
// partir de 1024 px, barre fixe en bas en dessous (brief §7.3 : le pouce
// l'atteint). Un seul des deux est visible à la fois (`display: none` sur l'autre),
// donc un seul est lu. 4 entrées principales + « Plus » : l'en-tête tient sur une
// ligne, la barre du bas en 5 cases sans rien hors écran.
// Icône ET libellé partout ; cible ≥ 48 px côté client.
export function ClientNavBar({ items, variant }: { items: readonly NavItem[]; variant: Variant }) {
  const pathname = usePathname();
  const { primary, more, activeId, isMoreActive, moreAttention } = splitClientNav(items, pathname);
  const isTop = variant === "top";

  return (
    <nav
      aria-label="Navigation principale"
      className={cn(
        isTop
          ? "hidden min-w-0 lg:flex"
          : "fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
      )}
    >
      <ul className={cn("flex w-full", isTop ? "flex-nowrap gap-1" : "justify-around")}>
        {primary.map((item) => (
          <li key={item.id} className={isTop ? undefined : "min-w-0 flex-1"}>
            <Link
              href={item.href}
              aria-current={item.id === activeId ? "page" : undefined}
              className={entryClass(isTop, item.id === activeId)}
            >
              <EntryIcon item={item} isTop={isTop} />
              <span className={isTop ? undefined : "text-center leading-tight"}>{item.label}</span>
              {item.attentionLabel && <span className="sr-only">, {item.attentionLabel}</span>}
            </Link>
          </li>
        ))}
        {more.length > 0 && (
          <li className={isTop ? undefined : "min-w-0 flex-1"}>
            <MoreMenu
              items={more}
              activeId={activeId}
              isTop={isTop}
              isActive={isMoreActive}
              hasAttention={moreAttention}
            />
          </li>
        )}
      </ul>
    </nav>
  );
}

function entryClass(isTop: boolean, isActive: boolean): string {
  return cn(
    "relative flex w-full items-center text-ink transition-colors hover:bg-soft focus-visible:outline-offset-[-3px]",
    isTop
      ? "h-[52px] gap-2 whitespace-nowrap border-b-[3px] px-3 text-[17px]"
      : "min-h-16 flex-col justify-center gap-1 border-t-[3px] px-1 text-sm",
    isActive ? "border-accent-text font-bold" : "border-transparent"
  );
}

function EntryIcon({ item, isTop }: { item: Pick<NavItem, "icon" | "attentionLabel">; isTop: boolean }) {
  const Icon = NAV_ICONS[item.icon];
  return (
    <span className="relative">
      <Icon className={isTop ? "h-[22px] w-[22px]" : "h-6 w-6"} aria-hidden="true" />
      {item.attentionLabel && (
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-accent-fill" aria-hidden="true" />
      )}
    </span>
  );
}

type MoreMenuProps = {
  items: readonly NavItem[];
  activeId: string | null;
  isTop: boolean;
  isActive: boolean;
  hasAttention: boolean;
};

// « Plus » : les entrées secondaires (Tâches, Mes livrables, Mon suivi…). Sous le
// bouton dans l'en-tête, au-dessus de la barre en bas — jamais hors écran : le
// panneau s'ancre au bord droit.
function MoreMenu({ items, activeId, isTop, isActive, hasAttention }: MoreMenuProps) {
  const { isOpen, toggle, root, button } = useDisclosure();
  const panelId = useId();

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className={entryClass(isTop, isActive)}
      >
        <span className="relative">
          <Ellipsis className={isTop ? "h-[22px] w-[22px]" : "h-6 w-6"} aria-hidden="true" />
          {hasAttention && (
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-accent-fill" aria-hidden="true" />
          )}
        </span>
        <span className={isTop ? undefined : "text-center leading-tight"}>Plus</span>
        {isActive && <span className="sr-only">, contient la page actuelle</span>}
      </button>

      {isOpen && (
        <div
          id={panelId}
          className={cn(
            "absolute right-0 z-40 flex min-w-[240px] flex-col rounded-xl border border-line bg-card p-2 shadow-eoda-lg",
            isTop ? "top-full mt-2" : "bottom-full mb-2 mr-2"
          )}
        >
          <ul className="flex flex-col">
            {items.map((item) => {
              const Icon = NAV_ICONS[item.icon];
              const isCurrent = item.id === activeId;
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    aria-current={isCurrent ? "page" : undefined}
                    className={cn(
                      "flex h-12 w-full items-center gap-3 rounded-lg px-3.5 text-[17px] text-ink transition-colors hover:bg-paper",
                      isCurrent && "bg-soft font-bold"
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                    {item.label}
                    {item.attentionLabel && <span className="sr-only">, {item.attentionLabel}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
