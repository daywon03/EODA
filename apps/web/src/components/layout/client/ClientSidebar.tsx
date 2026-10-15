"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/design/navigation";
import { CLIENT_ROOT } from "@/lib/design/client-navigation";
import {
  CLIENT_SIDEBAR_KEY,
  readSidebarState,
  writeSidebarState,
  type SidebarState,
} from "@/lib/design/sidebar-preference";
import { EodaMark } from "../EodaLogo";
import { ClientNavList } from "./ClientNavList";

const browserStorage = () => window.localStorage;

// Barre latérale du portail client (écrans larges) — maquette de l'espace de la
// structure accompagnée (Excellence) : la même barre que le cabinet, 264 px dépliée /
// 76 px repliée, collante, fond `soft`, repli mémorisé par poste.
//
// Ce que la maquette met en tête de cette barre : la marque EODA, le nom de la
// structure et son palier (« Excellence · avec EODA »). Le palier vient d'un FAIT de
// la mission (`Mission.supportMode` + `Mission.formule`, via `describeModeTag`) : sans
// mission, l'appelant passe `modeLabel={null}` et rien n'est écrit — un palier deviné
// annoncerait un niveau de relecture qui n'a pas été acheté (même règle que le
// bandeau de mode).
//
// Deux largeurs, deux affichages, un seul jeu d'entrées : la liste complète
// (ClientNavList). Sous `lg`, la barre disparaît au profit de la barre du bas, qui
// reste — le pouce l'atteint (DESIGN.md §4.2). Aucun tiroir : le bas couvre déjà
// toutes les entrées (4 + « Plus »).
export function ClientSidebar({
  items,
  structureName,
  structureLogo,
  modeLabel,
}: {
  items: readonly NavItem[];
  structureName: string;
  structureLogo: string | null;
  modeLabel: string | null;
}) {
  // Dépliée au premier rendu (serveur), puis la préférence du poste au montage.
  const [state, setState] = useState<SidebarState>("expanded");
  useEffect(() => {
    setState(readSidebarState(browserStorage, CLIENT_SIDEBAR_KEY));
  }, []);

  const collapsed = state === "collapsed";
  const toggleLabel = collapsed ? "Agrandir le menu" : "Réduire le menu";

  function toggle() {
    const next: SidebarState = collapsed ? "expanded" : "collapsed";
    setState(next);
    writeSidebarState(browserStorage, next, CLIENT_SIDEBAR_KEY);
  }

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "sticky top-0 hidden h-screen flex-shrink-0 flex-col border-r border-line bg-soft transition-[width] duration-200 motion-reduce:transition-none lg:flex",
        collapsed ? "w-[76px]" : "w-[264px]"
      )}
    >
      <div className={cn("flex items-center pb-4 pt-5", collapsed ? "justify-center px-2" : "px-5")}>
        <Link
          href={CLIENT_ROOT}
          className="flex min-w-0 items-center gap-2.5 rounded-lg"
          aria-label={`${structureName} — retour à l'accueil`}
        >
          <EodaMark size={36} className="flex-shrink-0" />
          {!collapsed && (
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-bold leading-tight text-ink">{structureName}</span>
              {modeLabel && <span className="truncate text-sm leading-tight text-ink2">{modeLabel}</span>}
            </span>
          )}
        </Link>
      </div>

      {/* Le logo de la structure vit ici quand elle en a déposé un — sur le fond
          `soft` de la barre, et à côté de celui d'EODA comme sur ses documents.
          Repliée, la place manque : il disparaît (le nom reste lu par l'aria-label). */}
      {!collapsed && structureLogo && (
        // eslint-disable-next-line @next/next/no-img-element -- data URI déposée par le cabinet, sans optimisation possible
        <img src={structureLogo} alt="" className="mx-5 mb-4 h-10 max-w-[120px] object-contain" />
      )}

      <nav aria-label="Navigation du portail" className="flex min-h-0 flex-1 flex-col">
        <ClientNavList items={items} collapsed={collapsed} />
      </nav>

      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? toggleLabel : undefined}
        aria-expanded={!collapsed}
        title={toggleLabel}
        className="mx-3 mb-3 flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-line bg-card text-base text-ink transition-colors hover:border-accent-text"
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
    </aside>
  );
}
