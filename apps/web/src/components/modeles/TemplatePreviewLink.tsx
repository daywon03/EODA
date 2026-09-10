"use client";

import { useState, useTransition } from "react";
import { Eye, FileCode, Loader2 } from "lucide-react";
import {
  getTemplateVersionPreviewData,
  getTemplateVersionExtractedText,
} from "@/lib/actions/template-library";
import type { FilePreviewData } from "@/lib/services/file-preview-types";
import { FilePreviewModal } from "@/components/shared/FilePreviewModal";
import { INLINE_ACTION_CLASS } from "@/components/ui/inline-action";

// « Pouvoir le voir directement sur l'app, au lieu de devoir le télécharger »
// (Damon, 10/09/2026). Deux boutons, comme côté documents clients
// (DocumentPreviewLink) et pour la même raison : « Voir » montre le PDF natif
// quand c'est un PDF (fidèle à l'original) ; « Texte extrait » montre TOUJOURS le
// Markdown — c'est lui qui a été chunké et embeddé dans la base de connaissances
// pour un document de RÉFÉRENCE, donc ce qu'il faut pouvoir vérifier même quand
// l'original est un PDF.
export function TemplatePreviewLink({ versionId }: { versionId: string }) {
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<FilePreviewData | null>(null);

  function handleOpen() {
    startTransition(async () => {
      const data = await getTemplateVersionPreviewData(versionId);
      if (data) setPreview(data);
    });
  }

  function handleOpenExtracted() {
    startTransition(async () => {
      const data = await getTemplateVersionExtractedText(versionId);
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
        aria-label="Voir ce fichier"
      >
        {isPending ? (
          <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin" aria-hidden="true" />
        ) : (
          <Eye className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
        )}
        Voir
      </button>
      <button
        type="button"
        onClick={handleOpenExtracted}
        disabled={isPending}
        className={INLINE_ACTION_CLASS}
        aria-label="Voir le texte extrait (Markdown)"
        title="Ce que l'extraction a produit — utilisé pour la base de connaissances si c'est un document de référence"
      >
        <FileCode className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
        Texte extrait
      </button>
      {preview && <FilePreviewModal preview={preview} onClose={() => setPreview(null)} />}
    </>
  );
}
