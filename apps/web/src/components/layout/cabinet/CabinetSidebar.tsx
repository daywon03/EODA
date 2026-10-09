"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavSection } from "@/lib/design/navigation";
import { readSidebarState, writeSidebarState, type SidebarState } from "@/lib/design/sidebar-preference";
import { EodaMark } from "../EodaLogo";
import { CabinetNavList } from "./CabinetNavList";

const browserStorage = () => window.localStorage;

// Barre latérale du portail cabinet (écrans larges) — maquette « Portail Cabinet
// v2 » : 264 px dépliée, 76 px repliée, collante, fond `soft`. Seul composant client
// de la coquille avec le tiroir mobile et le fil d'Ariane : il lui faut l'adresse
// courante et la préférence de repli du poste.
//
// `profile` est rendu par le serveur (nom, rôle, déconnexion) et reçu en
// emplacement ; il se replie par CSS (`group-data-[collapsed=true]/sidebar`).
export function CabinetSidebar({ sections, profile }: { sections: readonly NavSection[]; profile: ReactNode }) {
  // Dépliée au premier rendu (serveur), puis la préférence du poste au montage.
  const [state, setState] = useState<SidebarState>("expanded");
  useEffect(() => {
    setState(readSidebarState(browserStorage));
  }, []);

  const collapsed = state === "collapsed";
  const toggleLabel = collapsed ? "Agrandir le menu" : "Réduire le menu";

  function toggle() {
    const next: SidebarState = collapsed ? "expanded" : "collapsed";
    setState(next);
    writeSidebarState(browserStorage, next);
  }

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "group/sidebar sticky top-0 hidden h-screen flex-shrink-0 flex-col border-r border-line bg-soft transition-[width] duration-200 motion-reduce:transition-none lg:flex",
        collapsed ? "w-[76px]" : "w-[264px]"
      )}
    >
      <div className={cn("flex items-center pb-4 pt-5", collapsed ? "justify-center px-2" : "px-5")}>
        <Link
          href="/dashboard/cabinet"
          className="flex items-center gap-2.5 rounded-lg"
          aria-label="EODA conseil — revenir aux structures"
        >
          <EodaMark size={36} className="flex-shrink-0" />
          {!collapsed && (
            <span className="whitespace-nowrap text-xl font-bold tracking-wide text-ink">
              EODA <span className="font-normal text-accent-text">conseil</span>
            </span>
          )}
        </Link>
      </div>

      <nav aria-label="Navigation du cabinet" className="flex min-h-0 flex-1 flex-col">
        <CabinetNavList sections={sections} collapsed={collapsed} />
      </nav>

      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? toggleLabel : undefined}
        aria-expanded={!collapsed}
        title={toggleLabel}
        className="mx-3 mb-2.5 flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-line bg-card text-base text-ink transition-colors hover:border-accent-text"
      >
        {collapsed ? (
          <ChevronsRight className="h-5 w-5" aria-hidden="true" />
        ) : (
          <>
            <ChevronsLeft className="h-5 w-5" aria-hidden="true" />
            {toggleLabel}
          </>
        )}
      </button>

      {profile}
    </aside>
  );
}
