"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

// En-tête COLLANT et réductible de la fiche structure (maquette v2, vue
// « structure »). Déplié : nom, pastilles, action principale, « Plus d'actions ».
// Réduit : une ligne — on garde l'action principale sous la main en faisant défiler
// un long tableau. Le contenu est rendu par le serveur et passé en propriétés ; ce
// composant ne porte que l'état plié / déplié.
export function StructureHeaderFrame({
  name,
  chips,
  compactLine,
  actions,
  tabs,
}: {
  name: string;
  chips: ReactNode;
  compactLine: ReactNode;
  actions: ReactNode;
  tabs: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const toggle = (
    <button
      type="button"
      onClick={() => setCollapsed((c) => !c)}
      aria-expanded={!collapsed}
      className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-lg border border-ink bg-card px-3 text-base text-ink hover:bg-soft"
    >
      {collapsed ? "Déplier" : "Réduire"}
      {collapsed ? (
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      ) : (
        <ChevronUp className="h-4 w-4" aria-hidden="true" />
      )}
      <span className="sr-only"> l&apos;en-tête</span>
    </button>
  );

  return (
    <div className="sticky top-16 z-20 -mx-4 border-b border-line bg-paper px-4 pt-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      {collapsed ? (
        <div className="flex min-h-12 flex-wrap items-center gap-3">
          <p className="text-lg font-bold text-ink">{name}</p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink2">{compactLine}</div>
          <span className="flex-1" />
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            {toggle}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <h1 className="text-2xl font-bold leading-tight text-ink sm:text-3xl">{name}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm">{chips}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            {toggle}
          </div>
        </div>
      )}
      {tabs}
    </div>
  );
}
