"use client";

import { useState, useTransition } from "react";
import {
  toggleCatalogueFormuleActive,
  toggleCatalogueOptionActive,
} from "@/lib/actions/catalogue";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, EyeOff, Loader2, RotateCcw } from "lucide-react";

type Props = {
  kind: "formule" | "option";
  id: string;
  label: string;
  active: boolean;
};

// Retrait / remise en vente d'une ligne de catalogue. Un seul composant pour les
// deux modèles : la seule différence est l'action appelée (D1 — deux composants
// jumeaux, c'est un correctif appliqué une fois sur deux).
//
// « Retirer » ne supprime rien : les devis déjà émis continuent d'afficher la
// ligne grâce à leurs snapshots de libellé et de prix. Elle disparaît seulement
// des sélecteurs et devient invendable.
export function CatalogueActiveToggle({ kind, id, label, active }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (active) {
      const confirmed = window.confirm(
        `Retirer « ${label} » du catalogue ? Elle disparaîtra des nouveaux devis. Les devis existants qui la référencent restent inchangés.`
      );
      if (!confirmed) return;
    }

    setError(null);
    startTransition(async () => {
      const toggle = kind === "formule" ? toggleCatalogueFormuleActive : toggleCatalogueOptionActive;
      const result = await toggle(id, !active);
      if (result && "error" in result) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {!active && <Badge variant="not_applicable">Retirée du catalogue</Badge>}
        <Button
          type="button"
          size="sm"
          variant={active ? "outline" : "secondary"}
          onClick={handleClick}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          ) : active ? (
            <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          {active ? "Retirer de la vente" : "Remettre en vente"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="flex items-center gap-1 text-xs text-rouge-imp">
          <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
