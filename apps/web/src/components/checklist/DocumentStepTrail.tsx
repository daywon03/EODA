"use client";

import { useState, useTransition } from "react";
import { setDocumentValidated } from "@/lib/actions/document";
import { Button } from "@/components/ui/button";
import { AlertCircle, BadgeCheck, Check, Loader2, Mail, RotateCcw } from "lucide-react";
import {
  DOCUMENT_STEPS,
  DOCUMENT_STEP_LABELS,
  describeNextStep,
  isStepReached,
  type DocumentStep,
} from "@/lib/services/document-workflow-service";
import { cn } from "@/lib/utils";

// Ce qui est vraiment parti, en toutes lettres : un succès muet laisserait croire
// que le client est prévenu quand aucun compte ne lui est rattaché.
function describeNotification({ sent, total }: { sent: number; total: number }): string {
  if (total === 0) return "Aucun compte client rattaché : personne n'a été prévenu par e-mail.";
  if (sent === 0) return "L'e-mail au client n'est pas parti — prévenez-le par le fil d'échange.";
  const people = `${sent} personne${sent > 1 ? "s" : ""}`;
  return sent < total
    ? `Client prévenu par e-mail : ${people} sur ${total}.`
    : `Client prévenu par e-mail (${people}).`;
}

type Props = {
  establishmentId: string;
  documentTypeId: string;
  step: DocumentStep;
  // Une image reste indéfiniment à l'étape DEPOSE (aucune analyse possible) —
  // le message qui suit le fil d'étapes doit le dire, pas annoncer une analyse
  // qui ne viendra jamais (call du 15/09/2026).
  isImage?: boolean;
};

// Parcours du document côté CABINET : téléchargé → analysé → modifié → relu →
// validé. Le client, lui, ne voit que ce qui le concerne (manquant,
// déposé, conforme) — c'est la demande du 26/08, et les deux portails ne suivent pas
// la même chose.
//
// Les étapes franchies sont marquées d'une coche, pas seulement colorées : un fil
// d'avancement qui ne se lit qu'à la teinte ne se lit pas du tout pour une partie des
// gens.
export function DocumentStepTrail({ establishmentId, documentTypeId, step, isImage = false }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // « Attendu » n'est pas une étape franchie : tant que rien n'est déposé, ce fil
  // n'apprend rien et occupe de la place.
  if (step === "ATTENDU") return null;

  const steps = DOCUMENT_STEPS.filter((candidate) => candidate !== "ATTENDU");
  const isValidated = step === "VALIDE";

  function toggleValidation() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await setDocumentValidated(establishmentId, documentTypeId, !isValidated);
      if (result && "error" in result) setError(result.error);
      if (result && "notified" in result) setNotice(describeNotification(result.notified));
    });
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-gris-light bg-ivoire/40 p-3">
      {/* Une frise sans nom accessible s'annonce « liste, 5 éléments » : on entend
          les étapes sans savoir de quoi elles sont les étapes. */}
      <ol
        className="flex flex-wrap items-center gap-x-1.5 gap-y-1"
        aria-label="Parcours du document"
      >
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
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                  // Même recette que les badges de statut : bordure + fond, jamais
                  // un fond seul — sinon la frise retombe dans le même défaut
                  // "pastel" déjà corrigé sur les badges.
                  reached
                    ? "border border-vert-ok/40 bg-vert-ok/12 text-vert-ok"
                    : "border border-transparent text-gris-mid"
                )}
              >
                {reached && <Check className="w-3 h-3 text-vert-ok" aria-hidden="true" />}
                {DOCUMENT_STEP_LABELS[candidate]}
                <span className="sr-only">{reached ? " — étape franchie" : " — à venir"}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Ce qu'il reste à faire, en toutes lettres : le fil dit où on en est, cette
            phrase dit quoi faire. */}
        <p className="text-xs text-gris-mid">{describeNextStep(step, isImage)}</p>

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

      {notice && (
        <p role="status" className="flex items-center gap-1.5 text-xs text-gris-mid">
          <Mail className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
          {notice}
        </p>
      )}

      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-rouge-imp">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
