"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { PracticeAnswerValue } from "@eoda/database";
import { PRACTICE_ANSWER_LABELS, PRACTICE_ANSWER_VALUES, MAX_PRACTICE_TEXT_LENGTH } from "@/lib/services/practice-service";
import { cn } from "@/lib/utils";

// Une question sur les pratiques (N7) : « Est-ce que c'est en place ? » + texte libre.
// Pas de dictée : aucun fournisseur de reconnaissance vocale n'est choisi.
export function PracticeQuestionForm({
  criterionId,
  initialAnswer,
  initialText,
  previousHref,
  nextHref,
  isLast,
  disabled,
  save,
  lastLabel = "Enregistrer et revenir au diagnostic",
}: {
  // Action serveur d'enregistrement, fournie par la page : celle de la structure
  // (savePracticeAnswer) ou celle d'une structure inscrite seule
  // (saveProspectPracticeAnswer). Même formulaire, deux gardes (D1).
  save: (input: { criterionId: unknown; answer: unknown; text: unknown }) => Promise<{ error: string } | null>;
  lastLabel?: string;
  criterionId: string;
  initialAnswer: PracticeAnswerValue | null;
  initialText: string;
  previousHref: string;
  nextHref: string;
  isLast: boolean;
  disabled: boolean;
}) {
  const router = useRouter();
  const [answer, setAnswer] = useState<PracticeAnswerValue | null>(initialAnswer);
  const [text, setText] = useState(initialText);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const textId = useId();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await save({ criterionId, answer, text });
      if (result) setError(result.error);
      else router.push(nextHref);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3" disabled={disabled}>
        <legend className="mb-3 text-xl font-bold">
          Est-ce que c&apos;est en place ?
        </legend>
        {/* Boutons bascule (aria-pressed) : un seul choix actif, chacun atteignable au
            clavier par Tab, sans la navigation aux flèches qu'un vrai radiogroup exige. */}
        <div className="flex flex-wrap gap-3">
          {PRACTICE_ANSWER_VALUES.map((value) => {
            const selected = answer === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => setAnswer(value)}
                className={cn(
                  "min-h-14 rounded-[10px] border-2 px-5 text-lg font-bold",
                  selected ? "border-ink bg-ink-fill text-on-ink" : "border-line bg-card text-ink hover:bg-soft"
                )}
              >
                <span aria-hidden="true">{selected ? "● " : "○ "}</span>
                {PRACTICE_ANSWER_LABELS[value]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor={textId} className="text-xl font-bold">
          Racontez comment vous faites
        </label>
        <textarea
          id={textId}
          value={text}
          disabled={disabled}
          maxLength={MAX_PRACTICE_TEXT_LENGTH}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="Écrivez ici, avec vos mots."
          className="w-full rounded-[10px] border-2 border-line bg-card p-4 text-lg text-ink"
        />
        <span className="text-base text-ink2">Relisez votre texte. Aucun nom de personne accompagnée.</span>
      </div>

      {error && (
        <p role="alert" className="font-bold text-danger-text">
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-between gap-3">
        <Link
          href={previousHref}
          className="inline-flex min-h-14 items-center rounded-[10px] border border-ink bg-card px-5 font-bold text-ink hover:bg-soft"
        >
          ← Retour
        </Link>
        {!disabled && (
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="inline-flex min-h-14 items-center gap-2 rounded-[10px] bg-ink-fill px-6 text-lg font-bold text-on-ink hover:bg-ink-fill/90 disabled:opacity-60"
          >
            {isPending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
            {isLast ? lastLabel : "Enregistrer et continuer"}
          </button>
        )}
      </div>
    </div>
  );
}
