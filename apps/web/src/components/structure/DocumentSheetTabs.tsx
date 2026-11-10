"use client";

import { useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { TAB_COUNT_CLASS, TAB_LIST_CLASS, tabClassName } from "@/components/ui/tab-styles";
import { nextTabIndex } from "@/lib/design/keyboard-navigation";
import { SHEET_TABS, type SheetTab } from "@/lib/services/document-sheet-tabs-service";

// ─────────────────────────────────────────────────────────────────────────────
// PANNEAU D'UN DOCUMENT EN TROIS ONGLETS (retours de Sandrine, 09/11/2026 : « je me
// perds dans le panneau de droite »). Motif WAI-ARIA « Tabs » : un seul onglet dans
// l'ordre de tabulation, flèches / Début / Fin pour changer.
//
// Les onglets sont de VRAIS LIENS (`?onglet=`) : sans JavaScript, le serveur rend
// l'onglet demandé. Avec JavaScript, le clic change d'onglet sur place et réécrit
// l'adresse (replaceState) sans relancer le rendu serveur — `data-workspace-ignore`
// empêche DocumentWorkspace d'y voir l'ouverture d'un document.
//
// Chargement paresseux gardé : un onglet n'est monté qu'à sa première ouverture (ses
// panneaux `dynamic()` ne se téléchargent qu'alors), puis reste monté — un brouillon
// de commentaire ne se perd pas en passant d'un onglet à l'autre.
// ─────────────────────────────────────────────────────────────────────────────

export function DocumentSheetTabs({
  initialTab,
  hrefs,
  header,
  missingNotice,
  analysisCount,
  panels,
}: {
  initialTab: SheetTab;
  hrefs: Record<SheetTab, string>;
  header: ReactNode;
  // Phrase sous la pastille quand l'analyse a relevé des manques (null sinon).
  missingNotice: string | null;
  // Compteur de l'onglet Analyse (éléments manquants) ; absent = pas de compteur.
  analysisCount?: number;
  panels: Record<SheetTab, ReactNode>;
}) {
  const [active, setActive] = useState<SheetTab>(initialTab);
  const [visited, setVisited] = useState<ReadonlySet<SheetTab>>(() => new Set([initialTab]));
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const activeIndex = Math.max(0, SHEET_TABS.findIndex((tab) => tab.id === active));

  function select(tab: SheetTab) {
    setActive(tab);
    setVisited((current) => (current.has(tab) ? current : new Set([...current, tab])));
    window.history.replaceState(window.history.state, "", hrefs[tab]);
  }

  function handleClick(event: MouseEvent<HTMLAnchorElement>, tab: SheetTab) {
    // Ctrl/Cmd-clic, clic du milieu : nouvel onglet du navigateur, on le laisse faire.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    select(tab);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const next = nextTabIndex(activeIndex, event.key, SHEET_TABS.length);
    const target = next === null ? undefined : SHEET_TABS[next];
    if (next === null || !target) return;
    event.preventDefault();
    select(target.id);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        {header}
        {missingNotice && (
          <p className="flex items-start gap-1.5 text-ink">
            <AlertCircle className="mt-1 h-4 w-4 flex-shrink-0 text-danger-text" aria-hidden="true" />
            <span>
              {missingNotice} :{" "}
              <a
                href={hrefs.analyse}
                data-workspace-ignore=""
                onClick={(event) => handleClick(event, "analyse")}
                className="font-bold text-accent-text underline underline-offset-4"
              >
                voir l&apos;onglet Analyse
              </a>
            </span>
          </p>
        )}
      </div>

      <div role="tablist" aria-label="Rubriques du document" onKeyDown={handleKeyDown} className={TAB_LIST_CLASS}>
        {SHEET_TABS.map((tab, index) => {
          const isSelected = tab.id === active;
          return (
            <a
              key={tab.id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              href={hrefs[tab.id]}
              data-workspace-ignore=""
              role="tab"
              id={`document-sheet-tab-${tab.id}`}
              aria-selected={isSelected}
              aria-controls={`document-sheet-panel-${tab.id}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={(event) => handleClick(event, tab.id)}
              className={tabClassName(isSelected)}
            >
              {tab.label}
              {tab.id === "analyse" && analysisCount !== undefined && analysisCount > 0 && (
                <span className={TAB_COUNT_CLASS}>
                  <span className="sr-only">, éléments manquants : </span>
                  {analysisCount}
                </span>
              )}
            </a>
          );
        })}
      </div>

      {SHEET_TABS.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`document-sheet-panel-${tab.id}`}
          aria-labelledby={`document-sheet-tab-${tab.id}`}
          hidden={tab.id !== active}
          className="space-y-4"
        >
          {visited.has(tab.id) ? panels[tab.id] : null}
        </div>
      ))}
    </div>
  );
}
