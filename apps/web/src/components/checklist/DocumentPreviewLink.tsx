"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { X, Eye, Loader2, FileCode } from "lucide-react";
import {
  getDocumentPreviewData,
  getExtractedText,
  type DocumentPreviewData,
} from "@/lib/actions/document";
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
      {preview && <DocumentPreviewModal preview={preview} onClose={() => setPreview(null)} />}
    </>
  );
}

function DocumentPreviewModal({
  preview,
  onClose,
}: {
  preview: DocumentPreviewData;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Aperçu — ${preview.filename}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-brun-ancre/60 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="flex flex-col w-full max-w-4xl h-full max-h-[85vh] bg-white rounded-xl overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gris-light flex-shrink-0">
          <p className="text-sm font-semibold text-brun-ancre truncate">{preview.filename}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer l'aperçu"
            className="p-1 text-gris-mid hover:text-brun-ancre rounded-md cursor-pointer flex-shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          {preview.kind === "pdf" && (
            <iframe src={preview.url} title={preview.filename} className="w-full h-full border-0" />
          )}
          {preview.kind === "text" && (
            <pre className="whitespace-pre-wrap break-words px-5 py-4 text-sm text-brun-ancre font-sans">
              {preview.text}
            </pre>
          )}
          {preview.kind === "unavailable" && (
            <p className="px-5 py-4 text-sm text-gris-mid">
              Aucun aperçu disponible pour ce document — utilisez le téléchargement.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
