"use client";

import { useTransition } from "react";
import { getTemplateVersionDownloadUrl } from "@/lib/actions/template-library";
import { Download, Loader2 } from "lucide-react";

// Téléchargement d'une version. Même motif que côté documents clients : l'URL signée
// est demandée au clic et n'est jamais rendue dans la page — une URL de stockage
// présente dans le HTML resterait valable après la fermeture de la session.
export function TemplateDownloadLink({ versionId }: { versionId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const url = await getTemplateVersionDownloadUrl(versionId);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="flex items-center gap-1 text-xs text-terre hover:underline disabled:cursor-not-allowed disabled:opacity-50"
      aria-label="Télécharger cette version"
    >
      {isPending ? (
        <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin" aria-hidden="true" />
      ) : (
        <Download className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
      )}
      Télécharger
    </button>
  );
}
