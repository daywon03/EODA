"use client";

import { useTransition } from "react";
import { getDocumentDownloadUrl } from "@/lib/actions/document";
import { Download, FileDown, Loader2 } from "lucide-react";
import { INLINE_ACTION_CLASS } from "@/components/ui/inline-action";

// `pdfUrl` — le PDF du document (ses pages, produites côté serveur, cf.
// document-pdf-service), `null` quand le format ne se convertit pas (`.doc`/`.xls`).
// Le composant ne le DÉCIDE pas : le lien est monté à un seul endroit par écran (D1),
// et l'appelant sait déjà, par `canRenderDocumentPages`, si le format se convertit.
//
// Deux raisons d'être un simple lien plutôt qu'un appel d'action comme le bouton
// d'origine : le PDF n'a pas d'adresse à obtenir (il est produit à la demande), et la
// route porte ses propres gardes et son propre journal d'audit — passer par une action
// ajouterait un aller-retour pour ouvrir une URL connue d'avance.
type Props = { documentVersionId: string; pdfUrl?: string | null };

export function DocumentDownloadLink({ documentVersionId, pdfUrl = null }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const url = await getDocumentDownloadUrl(documentVersionId);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={INLINE_ACTION_CLASS}
        aria-label="Télécharger le document"
      >
        {isPending ? (
          <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" aria-hidden="true" />
        ) : (
          <Download className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
        )}
        Télécharger
      </button>

      {pdfUrl && (
        <a
          href={pdfUrl}
          className={INLINE_ACTION_CLASS}
          // Le nom du fichier part en PDF : le dire, plutôt que de laisser croire
          // qu'on retélécharge le .docx.
          aria-label="Télécharger le document en PDF"
          title="Télécharger en PDF"
        >
          <FileDown className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          PDF
        </a>
      )}
    </>
  );
}
