"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X } from "lucide-react";
import type { FilePreviewData } from "@/lib/services/file-preview-types";

// Un navigateur ne sait afficher nativement qu'un PDF — un .docx est toujours
// proposé au téléchargement par le système, quel que soit le Content-Disposition.
// Une image se sert elle-même (URL signée). Pour le reste (Word, Excel), l'aperçu
// rend le Markdown déjà extrait au dépôt (pdf2md/mammoth/exceljs, cf.
// text-extraction-service) — titres, tableaux et images inline, pas le texte brut :
// c'est ce qui manquait au retour du 15/09/2026 (« il affichait le texte brut
// extrait par l'IA, et non le document d'origine »). `remark-gfm` pour les
// tableaux Markdown (l'extraction xlsx en produit) ; pas de `rehype-raw`, donc le
// HTML éventuellement présent dans le Markdown reste du texte, jamais exécuté.
//
// Partagé entre les documents clients (DocumentPreviewLink) et la bibliothèque de
// modèles (TemplatePreviewLink) : même mécanique d'aperçu, deux sources de données
// différentes derrière (D1 — un seul endroit pour la modale elle-même).
export type { FilePreviewData };

export function FilePreviewModal({
  preview,
  onClose,
}: {
  preview: FilePreviewData;
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
        className="flex flex-col w-full max-w-4xl h-full max-h-[85vh] bg-surface rounded-xl overflow-hidden shadow-xl"
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
          {preview.kind === "image" && (
            <div className="flex h-full items-center justify-center bg-ivoire/40 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- URL signée temporaire, next/image exigerait une taille connue à l'avance. */}
              <img
                src={preview.url}
                alt={preview.filename}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          )}
          {preview.kind === "markdown" && (
            <div className="prose prose-sm max-w-none px-5 py-4 text-brun-ancre prose-headings:text-brun-ancre prose-a:text-terre prose-strong:text-brun-ancre prose-th:text-brun-ancre prose-td:align-top">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{preview.text}</ReactMarkdown>
            </div>
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
