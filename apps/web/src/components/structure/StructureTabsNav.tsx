"use client";

import { useId } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { TabsNav } from "@/components/ui/tabs-nav";
import { useDisclosure } from "@/components/ui/use-disclosure";
import { cn } from "@/lib/utils";
import { activeStructureTabId, splitStructureTabs, structureHref, STRUCTURE_TABS } from "@/lib/design/structure-tabs";

// Onglets de la fiche structure. Seul composant client de la navigation : l'onglet
// actif se lit dans l'adresse courante, que le gabarit serveur ne connaît pas.
// La liste visible (par rôle) est décidée côté serveur et reçue en identifiants.
//
// 11/11/2026 (option 3 de la maquette) : les six onglets du quotidien sont visibles,
// les autres dans « Plus » — onze onglets coupés aux bords ne se voyaient pas.
// L'onglet ouvert reste toujours dans la barre (splitStructureTabs).
export function StructureTabsNav({ establishmentId, visibleTabIds }: { establishmentId: string; visibleTabIds: readonly string[] }) {
  const pathname = usePathname();
  const activeId = activeStructureTabId(pathname, establishmentId);
  const tabs = STRUCTURE_TABS.filter((tab) => visibleTabIds.includes(tab.id)).map((tab) => ({
    id: tab.id,
    label: tab.label,
    href: structureHref(establishmentId, tab.segment),
  }));
  const { primary, more } = splitStructureTabs(tabs, activeId);

  return (
    <div className="mt-4 flex items-end border-b border-line">
      <TabsNav label="Sections de la fiche" tabs={primary} activeId={activeId} className="min-w-0 shadow-none" />
      {more.length > 0 && <MoreTabs tabs={more} />}
    </div>
  );
}

// Hors de la barre qui défile : un menu à l'intérieur d'une zone `overflow` serait rogné.
function MoreTabs({ tabs }: { tabs: readonly { id: string; label: string; href: string }[] }) {
  const { open, setOpen, rootRef, triggerRef } = useDisclosure();
  const panelId = useId();
  return (
    <div ref={rootRef} className="relative flex-shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-t-lg border-b-[3px] border-transparent px-3 text-base text-ink2 hover:text-ink focus-visible:outline-offset-[-3px]",
          open && "bg-soft text-ink"
        )}
      >
        Plus
        <span className="min-w-6 rounded-full bg-soft px-2 text-center text-sm font-bold tabular-nums text-ink">
          <span className="sr-only">, </span>
          {tabs.length}
          <span className="sr-only"> sections</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && (
        <ul
          id={panelId}
          className="absolute right-0 top-full z-30 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-line bg-card p-1.5 shadow-eoda-md sm:left-0 sm:right-auto"
        >
          {tabs.map((tab) => (
            <li key={tab.id}>
              <Link
                href={tab.href}
                scroll={false}
                onClick={() => setOpen(false)}
                className="flex min-h-11 w-full items-center rounded-md px-3 text-base text-ink hover:bg-soft"
              >
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
