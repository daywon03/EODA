"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { FilePreviewData } from "@/lib/services/file-preview-types";

// Les deux aperçus « pages » — `pdf` (le fichier déposé) et `document` (ses pages
// produites côté serveur, cf. document-pdf-service) — sont le même objet à l'écran :
// un PDF confié au lecteur du navigateur. C'est lui qui donne les vignettes, « 1 / 6 »,
// le zoom et la rotation, sans une ligne de visualiseur à écrire ni un octet de bundle.
//
// L'attente est visible : le premier aperçu d'un document coûte un lancement de
// Chromium (~1 s), et un cadre blanc muet ferait croire à une panne. `role="status"`
// pour que l'attente soit annoncée, pas seulement affichée.
function PdfFrame({ url, filename }: { url: string; filename: string }) {
  const [ready, setReady] = useState(false);

  return (
    <div className="relative h-full w-full">
      {!ready && (
        <p role="status" className="absolute inset-x-0 top-0 px-5 py-3 text-sm text-ink2">
          Préparation de l&apos;aperçu…
        </p>
      )}
      <iframe
        src={url}
        title={filename}
        onLoad={() => setReady(true)}
        className="h-full w-full border-0"
      />
    </div>
  );
}

// Le CONTENU d'un aperçu de fichier, sans son cadre : rendu dans la modale « Voir »
// (FilePreviewModal) et dans la colonne centrale de la file « À relire ». Un seul
// rendu pour les deux (D1) — des pages PDF, une image, le Markdown extrait d'un Word.
// `remark-gfm` pour les tableaux ; pas de `rehype-raw`, donc le HTML éventuellement
// présent dans le Markdown reste du texte, jamais exécuté.
export function FilePreviewBody({ preview }: { preview: FilePreviewData }) {
  switch (preview.kind) {
    case "pdf":
    case "document":
      return <PdfFrame url={preview.url} filename={preview.filename} />;
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
