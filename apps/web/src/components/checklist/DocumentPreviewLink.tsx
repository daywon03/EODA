"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { X, Eye, Loader2 } from "lucide-react";
import { getDocumentPreviewData, type DocumentPreviewData } from "@/lib/actions/document";

type Props = { documentVersionId: string };

export function DocumentPreviewLink({ documentVersionId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<DocumentPreviewData | null>(null);

  function handleOpen() {
    startTransition(async () => {
      const data = await getDocumentPreviewData(documentVersionId);
      if (data) setPreview(data);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={isPending}
        className="flex items-center gap-1 text-xs text-terre hover:underline disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        aria-label="Voir le document"
      >
        {isPending ? (
          <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" aria-hidden="true" />
        ) : (
          <Eye className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
        )}
        Voir
      </button>
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
