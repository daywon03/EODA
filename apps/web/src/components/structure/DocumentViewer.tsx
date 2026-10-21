"use client";

import type { ReactNode } from "react";
import { DialogFrame } from "@/components/ui/dialog-frame";
import { DocumentPreviewPane } from "./DocumentPreviewPane";

// LA VISIONNEUSE D'UN DOCUMENT (21/10/2026) : un clic sur un document ouvre ses pages
// tout de suite, avec à côté son détail et ses gestes (valider, réanalyser, déposer…).
// Elle remplace le panneau latéral qui obligeait à cliquer une seconde fois sur « Voir »
// pour voir la pièce.
//
// Deux colonnes sur grand écran — l'aperçu prend la place, le détail garde une largeur
// lisible et ne défile qu'en vertical ; empilées sur petit écran, l'aperçu d'abord.
export function DocumentViewer({
  title,
  versionId,
  originalFilename,
  onClose,
  details,
}: {
  title: string;
  versionId: string | null;
  originalFilename: string | null;
  onClose: () => void;
  details: ReactNode;
}) {
  return (
    <DialogFrame variant="viewer" title={title} onClose={onClose}>
      <div className="flex h-full min-h-0 flex-col lg:flex-row">
        <section aria-label="Aperçu du document" className="h-[55dvh] min-h-0 min-w-0 flex-shrink-0 lg:h-auto lg:flex-1">
          <DocumentPreviewPane versionId={versionId} originalFilename={originalFilename} title={title} />
        </section>
        <aside
          aria-label="Détail du document"
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden break-words border-t border-line px-5 py-4 lg:w-[440px] lg:flex-none lg:border-l lg:border-t-0"
        >
          {details}
        </aside>
      </div>
    </DialogFrame>
  );
}
