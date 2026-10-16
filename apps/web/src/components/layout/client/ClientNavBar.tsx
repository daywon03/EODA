"use client";

import { useId } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis } from "lucide-react";
import { cn } from "@/lib/utils";
import { splitClientNav } from "@/lib/design/client-navigation";
import type { NavItem } from "@/lib/design/navigation";
import { CountBadge } from "@/components/ui/count-badge";
import { NAV_ICONS } from "../nav-icons";
import { useDisclosure } from "./use-disclosure";
import { useVisibleClientNav } from "./use-visible-client-nav";

// Navigation du portail client sur PETIT écran — barre fixe en bas (brief §7.3 : le
// pouce l'atteint, là où une barre latérale ne serait atteignable qu'à deux mains).
//
// Depuis le 15/10/2026, les écrans larges ne passent plus par ici : ils ont la barre
// latérale (ClientSidebar), comme le cabinet et comme la maquette de l'espace
// accompagné. CETTE barre est le seul rendu sous `lg`, et c'est le seul endroit où
// toutes les entrées ne tiennent pas : 4 entrées principales + « Plus », la
// répartition venant de splitClientNav. Une entrée ajoutée sans être déclarée
// principale part dans « Plus » — aucune ne disparaît, aucune n'est dupliquée.
//
// Les deux rendus lisent la MÊME liste (buildClientNav, via ClientShell) : une entrée
// de plus ne s'ajoute jamais à un seul des deux.
// Icône ET libellé partout ; cible de 64 px, largement au-dessus des 48 px exigés.
export function ClientNavBar({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();
  const visibleItems = useVisibleClientNav(items);
  const { primary, more, activeId, isMoreActive, moreAttention, moreCount } = splitClientNav(
    visibleItems,
    pathname
  );

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="flex w-full justify-around">
        {primary.map((item) => (
          <li key={item.id} className="min-w-0 flex-1">
            <Link
              href={item.href}
              aria-current={item.id === activeId ? "page" : undefined}
              className={entryClass(item.id === activeId)}
            >
              <EntryIcon item={item} />
              <span className="flex items-center gap-1.5">
                <span className="text-center leading-tight">{item.label}</span>
                <EntryCount item={item} />
              </span>
              {item.attentionLabel && <span className="sr-only">, {item.attentionLabel}</span>}
            </Link>
          </li>
        ))}
        {more.length > 0 && (
          <li className="min-w-0 flex-1">
            <MoreMenu
              items={more}
              activeId={activeId}
              isActive={isMoreActive}
              hasAttention={moreAttention}
              count={moreCount}
            />
          </li>
        )}
      </ul>
    </nav>
  );
}

function entryClass(isActive: boolean): string {
  return cn(
    "relative flex min-h-16 w-full flex-col items-center justify-center gap-1 border-t-[3px] px-1 text-sm text-ink transition-colors hover:bg-soft focus-visible:outline-offset-[-3px]",
    isActive ? "border-accent-text font-bold" : "border-transparent"
  );
}

function EntryIcon({ item }: { item: Pick<NavItem, "icon" | "attentionLabel"> }) {
  const Icon = NAV_ICONS[item.icon];
  return (
    <span className="relative">
      <Icon className="h-6 w-6" aria-hidden="true" />
      {item.attentionLabel && (
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-accent-fill" aria-hidden="true" />
      )}
    </span>
  );
}

// Le nombre est décoratif (CountBadge), la phrase qui le porte est lue : « Mes
// livrables, 3 nouveaux documents ». Le libellé de ce qu'on compte vit dans
// client-navigation (`countLabel`), pas ici.
function EntryCount({ item, className }: { item: Pick<NavItem, "count" | "countLabel">; className?: string }) {
  const count = item.count ?? 0;
  if (count <= 0) return null;
  return (
    <>
      <CountBadge count={count} className={className} />
      <span className="sr-only">, {item.countLabel}</span>
    </>
  );
}

type MoreMenuProps = {
  items: readonly NavItem[];
  activeId: string | null;
  isActive: boolean;
  hasAttention: boolean;
  count: number;
};

// « Plus » : les entrées secondaires (Tâches, Mes livrables, Mon suivi…). Le panneau
// s'ouvre AU-DESSUS de la barre, ancré à droite : jamais hors écran.
//
// Le bouton porte la somme des compteurs qu'il RENFERME : « Mes livrables » est dans
// ce menu, et une pastille qu'on ne voit pas ne prévient personne.
function MoreMenu({ items, activeId, isActive, hasAttention, count }: MoreMenuProps) {
  const { isOpen, toggle, root, button } = useDisclosure();
  const panelId = useId();
  const countLabel = items
    .filter((item) => (item.count ?? 0) > 0)
    .map((item) => item.countLabel)
    .filter(Boolean)
    .join(", ");

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className={entryClass(isActive)}
      >
        <span className="relative">
          <Ellipsis className="h-6 w-6" aria-hidden="true" />
          {hasAttention && (
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-accent-fill" aria-hidden="true" />
          )}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-center leading-tight">Plus</span>
          {count > 0 && <CountBadge count={count} />}
        </span>
        {isActive && <span className="sr-only">, contient la page actuelle</span>}
        {/* Le bouton est FERMÉ : le nombre n'y dit rien de lui-même, c'est le libellé
            de ce qu'on compte — porté par l'entrée — qui est lu. */}
        {count > 0 && <span className="sr-only">, {countLabel}</span>}
      </button>

      {isOpen && (
        <div
          id={panelId}
          className="absolute bottom-full right-0 z-40 mb-2 mr-2 flex min-w-[240px] flex-col rounded-xl border border-line bg-card p-2 shadow-eoda-lg"
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
                    <EntryCount item={item} className="ml-auto" />
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
