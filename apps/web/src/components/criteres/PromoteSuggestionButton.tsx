"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { promoteCriterionSuggestion } from "@/lib/actions/criterion-matrix";
import { Button } from "@/components/ui/button";

// « Ajouter à la matrice » : une suggestion confirmée sur UN document devient un
// rattachement du TYPE, valable pour toutes les structures. Le serveur revérifie
// l'appartenance au cabinet et le statut (promotionError).
export function PromoteSuggestionButton({ suggestionId, label }: { suggestionId: string; label: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function promote() {
    const data = new FormData();
    data.set("suggestionId", suggestionId);
    setError(null);
    startTransition(async () => {
      const result = await promoteCriterionSuggestion(data);
      if (result) setError(result.error);
    });
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" size="sm" onClick={promote} disabled={isPending} aria-label={`Ajouter à la matrice : ${label}`}>
        {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Ajouter à la matrice
      </Button>
      {error && (
        <span role="alert" className="text-sm text-danger-text">
          {error}
        </span>
      )}
    </span>
  );
}
