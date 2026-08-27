"use client";

import { useState, useTransition } from "react";
import { setDocumentValidated } from "@/lib/actions/document";
import { Button } from "@/components/ui/button";
import { AlertCircle, BadgeCheck, Check, Loader2, RotateCcw } from "lucide-react";
import {
  DOCUMENT_STEPS,
  DOCUMENT_STEP_LABELS,
  describeNextStep,
  isStepReached,
  type DocumentStep,
} from "@/lib/services/document-workflow-service";
import { cn } from "@/lib/utils";

type Props = {
  establishmentId: string;
  documentTypeId: string;
  step: DocumentStep;
};

// Parcours du document côté CABINET : déposé → analysé → mis en conformité →
// restitué → validé. Le client, lui, ne voit que ce qui le concerne (manquant,
// déposé, conforme) — c'est la demande du 26/08, et les deux portails ne suivent pas
// la même chose.
//
// Les étapes franchies sont marquées d'une coche, pas seulement colorées : un fil
// d'avancement qui ne se lit qu'à la teinte ne se lit pas du tout pour une partie des
// gens.
export function DocumentStepTrail({ establishmentId, documentTypeId, step }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // « Attendu » n'est pas une étape franchie : tant que rien n'est déposé, ce fil
  // n'apprend rien et occupe de la place.
  if (step === "ATTENDU") return null;

  const steps = DOCUMENT_STEPS.filter((candidate) => candidate !== "ATTENDU");
  const isValidated = step === "VALIDE";

  function toggleValidation() {
    setError(null);
    startTransition(async () => {
      const result = await setDocumentValidated(establishmentId, documentTypeId, !isValidated);
      if (result && "error" in result) setError(result.error);
    });
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-gris-light bg-ivoire/40 p-3">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {steps.map((candidate, index) => {
          const reached = isStepReached(step, candidate);
          return (
            <li key={candidate} className="flex items-center gap-1.5">
              {index > 0 && (
                <span className="text-gris-light" aria-hidden="true">
                  ›
                </span>
              )}
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]",
                  reached ? "bg-vert-ok/15 text-brun-ancre" : "text-gris-mid"
                )}
              >
                {reached && <Check className="w-3 h-3 text-vert-ok" aria-hidden="true" />}
                {DOCUMENT_STEP_LABELS[candidate]}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Ce qu'il reste à faire, en toutes lettres : le fil dit où on en est, cette
            phrase dit quoi faire. */}
        <p className="text-xs text-gris-mid">{describeNextStep(step)}</p>

        <Button
          type="button"
          size="sm"
          variant={isValidated ? "ghost" : "outline"}
          disabled={isPending}
          onClick={toggleValidation}
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          ) : isValidated ? (
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <BadgeCheck className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          {isValidated ? "Retirer la validation" : "Valider le document"}
        </Button>
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-rouge-imp">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
