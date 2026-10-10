"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { TAB_COUNT_CLASS, TAB_LIST_CLASS, tabClassName } from "./tab-styles";
import { nextTabIndex } from "@/lib/design/keyboard-navigation";

export type TabItem = {
  id: string;
  label: string;
  // Nombre d'éléments derrière l'onglet (« À relire 4 »). Absent = pas de compteur.
  count?: number;
};

type Props = {
  // Nom de la liste d'onglets, lu par le lecteur d'écran (« Filtrer les documents »).
  label: string;
  tabs: readonly TabItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  // Contenu du panneau de l'onglet sélectionné. Si absent, les onglets pilotent un
  // contenu rendu ailleurs (`aria-controls` est alors omis).
  children?: ReactNode;
  className?: string;
};

// Motif WAI-ARIA « Tabs » à activation automatique : un seul onglet dans l'ordre de
// tabulation (tabindex 0), les flèches déplacent la sélection, Début / Fin vont aux
// extrémités (logique : lib/design/keyboard-navigation.ts).
export function TabsWithCount({ label, tabs, selectedId, onSelect, children, className }: Props) {
  const baseId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = Math.max(0, tabs.findIndex((t) => t.id === selectedId));
  const hasPanel = children !== undefined;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const next = nextTabIndex(selectedIndex, event.key, tabs.length);
    const target = next === null ? undefined : tabs[next];
    if (next === null || !target) return;
    event.preventDefault();
    onSelect(target.id);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={handleKeyDown}
        className={TAB_LIST_CLASS}
      >
        {tabs.map((tab, index) => {
          const isSelected = index === selectedIndex;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={isSelected}
              aria-controls={hasPanel ? `${baseId}-panel` : undefined}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => onSelect(tab.id)}
              className={tabClassName(isSelected)}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={TAB_COUNT_CLASS}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {hasPanel && (
        <div
          role="tabpanel"
          id={`${baseId}-panel`}
          aria-labelledby={`${baseId}-tab-${tabs[selectedIndex]?.id ?? ""}`}
          className="pt-4"
        >
          {children}
        </div>
      )}
    </div>
  );
}
