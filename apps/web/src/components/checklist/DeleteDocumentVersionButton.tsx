"use client";

import { useState, useTransition } from "react";
import { deleteDocumentVersion } from "@/lib/actions/document";
import { AlertCircle, Loader2, Trash2 } from "lucide-react";

type Props = { documentVersionId: string; filename: string };

// Suppression définitive d'une version déposée — réservée au cabinet (l'action
// serveur le vérifie ; ce bouton n'est pas rendu côté portail client). Confirmation
// obligatoire : le fichier est retiré du stockage, il n'y a pas de corbeille.
export function DeleteDocumentVersionButton({ documentVersionId, filename }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const confirmed = window.confirm(
      `Supprimer définitivement « ${filename} » ? Le fichier sera effacé du stockage. Cette action est irréversible.`
    );
    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteDocumentVersion(documentVersionId);
      if (result && "error" in result) setError(result.error);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-label={`Supprimer ${filename}`}
        className="inline-flex items-center gap-1 text-xs text-rouge-imp hover:underline cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge-imp rounded"
      >
        {isPending ? (
          <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
        ) : (
          <Trash2 className="w-3 h-3" aria-hidden="true" />
        )}
        Supprimer
      </button>
      {error && (
        <span role="alert" className="flex items-center gap-1 text-xs text-rouge-imp">
          <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          {error}
        </span>
      )}
    </>
  );
}
