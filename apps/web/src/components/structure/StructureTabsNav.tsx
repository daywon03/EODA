"use client";

import { usePathname } from "next/navigation";
import { TabsNav } from "@/components/ui/tabs-nav";
import { activeStructureTabId, structureHref, STRUCTURE_TABS } from "@/lib/design/structure-tabs";

// Onglets de la fiche structure. Seul composant client de la navigation : l'onglet
// actif se lit dans l'adresse courante, que le gabarit serveur ne connaît pas.
// La liste visible (par rôle) est décidée côté serveur et reçue en identifiants.
export function StructureTabsNav({ establishmentId, visibleTabIds }: { establishmentId: string; visibleTabIds: readonly string[] }) {
  const pathname = usePathname();
  const tabs = STRUCTURE_TABS.filter((tab) => visibleTabIds.includes(tab.id)).map((tab) => ({
    id: tab.id,
    label: tab.label,
    href: structureHref(establishmentId, tab.segment),
  }));
  return (
    <TabsNav
      label="Sections de la fiche"
      tabs={tabs}
      activeId={activeStructureTabId(pathname, establishmentId)}
      className="mt-4"
    />
  );
}
