"use client";

import { useState, useTransition } from "react";
import { Eye, Loader2, FileCode } from "lucide-react";
import {
  getDocumentPreviewData,
  getExtractedText,
  type DocumentPreviewData,
} from "@/lib/actions/document";
import { FilePreviewModal } from "@/components/shared/FilePreviewModal";
import { INLINE_ACTION_CLASS } from "@/components/ui/inline-action";

type Props = {
  documentVersionId: string;
  // Vérifier le texte extrait par rapport à l'original est un outil de travail du
  // cabinet (repérer une page scannée manquée, un tableau mal reconnu) — jamais
  // proposé côté client, cf. getExtractedText().
  canViewExtractedText?: boolean;
};

export function DocumentPreviewLink({ documentVersionId, canViewExtractedText = false }: Props) {
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<DocumentPreviewData | null>(null);

  function handleOpen() {
    startTransition(async () => {
      const data = await getDocumentPreviewData(documentVersionId);
      if (data) setPreview(data);
    });
  }

  function handleOpenExtracted() {
    startTransition(async () => {
      const data = await getExtractedText(documentVersionId);
      if (!data) return;
      if ("error" in data) {
        setPreview({ kind: "text", text: data.error, filename: "Texte extrait" });
        return;
      }
      setPreview({ kind: "text", text: data.text, filename: `Texte extrait — ${data.filename}` });
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={isPending}
        className={INLINE_ACTION_CLASS}
        aria-label="Voir le document"
      >
        {isPending ? (
          <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" aria-hidden="true" />
        ) : (
          <Eye className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
        )}
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
          <FileCode className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          Texte extrait
        </button>
      )}
      {preview && <FilePreviewModal preview={preview} onClose={() => setPreview(null)} />}
    </>
  );
}
