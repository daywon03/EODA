"use client";

import { useState, useTransition } from "react";
import { setAvenantSigned } from "@/lib/actions/mission";
import { Button } from "@/components/ui/button";
import { AlertCircle, Check, Loader2, RotateCcw } from "lucide-react";

type Props = {
  missionId: string;
  catalogueOptionId: string;
  label: string;
  signedOn: Date | null;
};

// « L'avenant est-il revenu signé ? » — le fait, posé à la main, parce qu'il se passe
// hors de la plateforme (un PDF, une signature, un e-mail de retour). Rien ne permet
// de le déduire, donc rien ne le devine.
//
// Réversible : une signature enregistrée par erreur verrouille le retrait de la
// prestation du périmètre, il faut pouvoir revenir en arrière. Les deux gestes sont
// journalisés.
export function AvenantSignatureToggle({
  missionId,
  catalogueOptionId,
  label,
  signedOn,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isSigned = signedOn !== null;

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await setAvenantSigned(missionId, catalogueOptionId, !isSigned);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="min-w-0 flex-1 text-sm text-brun-ancre">{label}</span>

      <Button
        type="button"
        size="sm"
        variant={isSigned ? "ghost" : "outline"}
        disabled={isPending}
        onClick={toggle}
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : isSigned ? (
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {isSigned ? "Retirer la signature" : "Avenant reçu signé"}
      </Button>

      {error && (
        <p role="alert" className="flex w-full items-center gap-1.5 text-xs text-rouge-imp">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
