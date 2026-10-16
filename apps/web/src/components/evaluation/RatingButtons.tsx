"use client";

import { useRef, useState, useTransition, type KeyboardEvent } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import type { Rating } from "@eoda/database";
import { rateElement } from "@/lib/actions/evaluation";
import { RATING_LABELS, RATING_TITLES } from "@/lib/services/scoring-service";
import { RATING_PALETTE, RATING_SCALE } from "@/lib/design/rating-palette";
import { nextTabIndex } from "@/lib/design/keyboard-navigation";
import { cn } from "@/lib/utils";

type Props = {
  sessionId: string;
  elementId: string;
  currentRating: Rating | null;
  allowsRi: boolean;
  isImperatif: boolean;
  // Identifiant de l'explication « NC impossible sur un impératif », rendue UNE fois
  // par critère (CriterionGroup) et reliée au bouton NC désactivé.
  ncNoteId?: string;
  // Nom du groupe pour le lecteur d'écran (« Cotation — <élément> »).
  groupLabel: string;
};

// Échelle HAS complète 1/2/3/4/★/NC/RI (context/02-referentiel-has.md §3) :
// - RI n'apparaît que si l'élément l'admet (chapitre 1) ;
// - NC est DÉSACTIVÉ sur un critère impératif, avec l'explication à côté — le serveur
//   le refuse de toute façon (isRatingAllowed), l'écran ne fait que le dire avant ;
// - couleurs `cot-*` seulement (rating-palette.ts), doublées de la coche ✓ : jamais
//   la couleur seule.
// Motif radiogroup : un seul bouton dans l'ordre de tabulation, les flèches DÉPLACENT
// le focus sans coter (chaque cotation est une écriture serveur), Espace / Entrée cote.
export function RatingButtons({
  sessionId,
  elementId,
  currentRating,
  allowsRi,
  isImperatif,
  ncNoteId,
  groupLabel,
}: Props) {
  const [rating, setRating] = useState<Rating | null>(currentRating);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const options = RATING_SCALE.filter((r) => r !== "RI" || allowsRi);
  const isDisabled = (value: Rating) => value === "NC" && isImperatif && rating !== "NC";
  const focusIndex = Math.max(0, options.findIndex((o) => o === rating));

  function rate(value: Rating) {
    setMessage(null);
    startTransition(async () => {
      const result = await rateElement(sessionId, elementId, value, null);
      if ("error" in result) {
        setMessage(result.error);
        return;
      }
      setRating(value);
      if (result.warning) setMessage(result.warning);
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const key = event.key === "ArrowDown" ? "ArrowRight" : event.key === "ArrowUp" ? "ArrowLeft" : event.key;
    const next = nextTabIndex(index, key, options.length);
    if (next === null) return;
    event.preventDefault();
    refs.current[next]?.focus();
  }

  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label={groupLabel} aria-busy={isPending} className="flex flex-wrap items-center gap-2">
        {options.map((value, index) => {
          const checked = rating === value;
          return (
            <button
              key={value}
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={`${RATING_LABELS[value]} — ${RATING_TITLES[value]}`}
              title={RATING_TITLES[value]}
              aria-describedby={value === "NC" && isImperatif ? ncNoteId : undefined}
              tabIndex={index === focusIndex ? 0 : -1}
              disabled={isPending || isDisabled(value)}
              onClick={() => rate(value)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={cn(
                "inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg border-2 px-2.5 text-base font-bold tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                checked ? RATING_PALETTE[value].selectedClass : "border-line bg-card text-ink hover:border-muted"
              )}
            >
              {checked ? (
                <span aria-hidden="true">✓</span>
              ) : (
                <span aria-hidden="true" className={cn("h-2.5 w-2.5 rounded-full", RATING_PALETTE[value].dotClass)} />
              )}
              {RATING_LABELS[value]}
            </button>
          );
        })}
        {isPending && <Loader2 className="h-4 w-4 animate-spin text-ink2" aria-hidden="true" />}
      </div>
      {message && (
        <p role="alert" className="flex max-w-2xl items-start gap-1.5 text-sm text-danger-text">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {message}
        </p>
      )}
    </div>
  );
}
