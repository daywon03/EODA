"use client";

import { useState, useTransition } from "react";
import { deleteDevis } from "@/lib/actions/devis";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, Trash2 } from "lucide-react";

// Ne s'affiche que sur un BROUILLON (la page décide), et l'action serveur le
// revérifie : un devis émis ne se supprime jamais, il s'annule.
export function DeleteDevisButton({ devisId, number }: { devisId: string; number: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const confirmed = window.confirm(
      `Supprimer définitivement le brouillon ${number} ? Son numéro n'ayant jamais été émis, aucune trace n'est conservée.`
    );
    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteDevis(devisId);
      if (result && "error" in result) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="destructive" size="sm" onClick={handleClick} disabled={isPending}>
        {isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
        )}
        Supprimer
      </Button>
      {error && (
        <p role="alert" className="flex items-center gap-1 text-xs text-rouge-imp">
          <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
