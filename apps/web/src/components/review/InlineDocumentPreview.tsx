"use client";

import { useEffect, useState } from "react";
import { getDocumentPreviewData, type DocumentPreviewData } from "@/lib/actions/document";
import { FilePreviewBody } from "@/components/shared/FilePreviewModalLazy";

type State = { status: "loading" } | { status: "ready"; preview: DocumentPreviewData } | { status: "error" };

// Aperçu de l'ORIGINAL déposé, dans la colonne centrale de la file. Même action
// que le bouton « Voir » de la fiche (getDocumentPreviewData) : même garde, même
// journalisation de l'accès (DOCUMENT_PREVIEWED) — une fois par document ouvert,
// pas à chaque rafraîchissement de la page (le composant garde son état).
export function InlineDocumentPreview({ versionId }: { versionId: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    getDocumentPreviewData(versionId)
      .then((preview) => {
        if (!cancelled) setState(preview ? { status: "ready", preview } : { status: "error" });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [versionId]);

  return (
    <div
      className="flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-lg border border-line bg-card"
      aria-busy={state.status === "loading"}
    >
      {state.status === "loading" && (
        <p className="m-auto text-base text-ink2" role="status">
          Chargement de l&apos;aperçu…
        </p>
      )}
      {state.status === "error" && (
        <p className="m-auto max-w-prose px-5 text-center text-base text-ink2" role="status">
          L&apos;aperçu n&apos;a pas pu être chargé. Le document reste consultable depuis la fiche de la structure.
        </p>
      )}
      {state.status === "ready" && (
        <div className="min-h-[420px] flex-1 overflow-auto">
          <FilePreviewBody preview={state.preview} />
        </div>
      )}
    </div>
  );
}
