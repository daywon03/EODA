"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { FilePreviewData } from "@/lib/services/file-preview-types";

// Le CONTENU d'un aperçu de fichier, sans son cadre : rendu dans la modale « Voir »
// (FilePreviewModal) et dans la colonne centrale de la file « À relire ». Un seul
// rendu pour les deux (D1) — un PDF, une image, le Markdown extrait d'un Word.
// `remark-gfm` pour les tableaux ; pas de `rehype-raw`, donc le HTML éventuellement
// présent dans le Markdown reste du texte, jamais exécuté.
export function FilePreviewBody({ preview }: { preview: FilePreviewData }) {
  switch (preview.kind) {
    case "pdf":
      return <iframe src={preview.url} title={preview.filename} className="h-full w-full border-0" />;
    case "image":
      return (
        <div className="flex h-full items-center justify-center bg-soft p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- URL signée temporaire, next/image exigerait une taille connue à l'avance. */}
          <img src={preview.url} alt={preview.filename} className="max-h-full max-w-full object-contain" />
        </div>
      );
    case "markdown":
      return (
        <div className="prose prose-sm max-w-none px-5 py-4 text-ink prose-headings:text-ink prose-a:text-accent-text prose-strong:text-ink prose-th:text-ink prose-td:align-top">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{preview.text}</ReactMarkdown>
        </div>
      );
    case "text":
      return (
        <pre className="whitespace-pre-wrap break-words px-5 py-4 font-sans text-sm text-ink">{preview.text}</pre>
      );
    case "unavailable":
      return (
        <p className="px-5 py-4 text-sm text-ink2">
          Aucun aperçu disponible pour ce document — utilisez le téléchargement.
        </p>
      );
  }
}
