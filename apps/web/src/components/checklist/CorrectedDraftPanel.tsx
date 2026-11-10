"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, Pencil } from "lucide-react";

// Chargé au clic sur « Document corrigé » : geste rare, et le panneau embarque la
// bibliothèque de comparaison (budget de JavaScript de l'onglet Documents).
const DraftDrawer = dynamic(() => import("./CorrectedDraftDrawer").then((m) => m.DraftDrawer), {
  ssr: false,
  loading: () => (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-brun-ancre/30"
      role="dialog"
      aria-modal="true"
      aria-label="Document corrigé"
    >
      <div className="flex h-full w-full max-w-xl flex-col bg-surface shadow-xl">
        <p role="status" className="flex items-center gap-2 px-4 py-3 text-xs text-ink2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Chargement…
        </p>
      </div>
    </div>
  ),
});

// « Régénérer un document entier corrigé, brandé EODA, qu'ils pourront réutiliser
// ensuite » (Damon, 15/09/2026) — panneau latéral (« pop up à droite »), pas une
// page séparée : la version corrigée se lit et se retouche à côté de la
// checklist qui l'a déclenchée.
//
// Réservé au cabinet, comme AnalyzeDocumentButton : un brouillon non relu ne va
// jamais devant le client (même barrière que l'analyse elle-même).
export function CorrectedDraftPanel({ documentVersionId }: { documentVersionId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs text-accent-text hover:underline"
      >
        <Pencil className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
        Document corrigé
      </button>
      {/* Écran côte à côte (N8) : décision ajout par ajout, version N+1. */}
      <a
        href={`/dashboard/cabinet/conformite/${documentVersionId}`}
        className="inline-flex items-center gap-1 text-xs text-accent-text hover:underline"
      >
        Mettre en conformité côte à côte
      </a>

      {open && <DraftDrawer documentVersionId={documentVersionId} onClose={() => setOpen(false)} />}
    </>
  );
}
