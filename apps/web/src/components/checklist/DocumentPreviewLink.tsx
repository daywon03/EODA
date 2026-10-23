"use client";

import { useState, useTransition } from "react";
import { Eye, Loader2, FileCode } from "lucide-react";
import { getExtractedText, type DocumentPreviewData } from "@/lib/actions/document";
import {
  FilePreviewModal,
  preloadFilePreviewModal,
} from "@/components/shared/FilePreviewModalLazy";
import { DocumentViewer } from "@/components/structure/DocumentViewer";
import { INLINE_ACTION_CLASS } from "@/components/ui/inline-action";

type Props = {
  documentVersionId: string;
  // Le nom décide du RENDU (Word dessiné avec sa mise en page, PDF natif, pages
  // serveur…), comme dans la visionneuse de la fiche — jamais de l'autorisation, que
  // les routes vérifient elles-mêmes.
  originalFilename: string;
  // Vérifier le texte extrait par rapport à l'original est un outil de travail du
  // cabinet (repérer une page scannée manquée, un tableau mal reconnu) — jamais
  // proposé côté client, cf. getExtractedText().
  canViewExtractedText?: boolean;
};

// « Voir » ouvre LA visionneuse (DocumentViewer), la même que la fiche cabinet et que
// « Mes documents » (23/10/2026) : « Mes livrables » montrait un aperçu reconstruit
// du Word quand le cabinet voyait sa mise en page — deux écrans, deux documents.
export function DocumentPreviewLink({ documentVersionId, originalFilename, canViewExtractedText = false }: Props) {
  const [isPending, startTransition] = useTransition();
  const [viewing, setViewing] = useState(false);
  const [extracted, setExtracted] = useState<DocumentPreviewData | null>(null);

  function handleOpenExtracted() {
    preloadFilePreviewModal();
    startTransition(async () => {
      const data = await getExtractedText(documentVersionId);
      if (!data) return;
      if ("error" in data) {
        setExtracted({ kind: "text", text: data.error, filename: "Texte extrait" });
        return;
      }
      setExtracted({ kind: "text", text: data.text, filename: `Texte extrait — ${data.filename}` });
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setViewing(true)}
        className={INLINE_ACTION_CLASS}
        aria-haspopup="dialog"
        aria-label={`Voir le document ${originalFilename}`}
      >
        <Eye className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
        Voir
      </button>
      {canViewExtractedText && (
        <button
          type="button"
          onClick={handleOpenExtracted}
          disabled={isPending}
          className={INLINE_ACTION_CLASS}
          aria-label="Voir le texte extrait transmis à l'IA"
          title="Ce que l'extraction a produit, à comparer avec l'original"
        >
          {isPending ? (
            <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" aria-hidden="true" />
          ) : (
            <FileCode className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          )}
          Texte extrait
        </button>
      )}
      {viewing && (
        <DocumentViewer
          title={originalFilename}
          versionId={documentVersionId}
          originalFilename={originalFilename}
          onClose={() => setViewing(false)}
          details={<p className="text-base text-ink">{originalFilename}</p>}
        />
      )}
      {extracted && <FilePreviewModal preview={extracted} onClose={() => setExtracted(null)} />}
    </>
  );
}
