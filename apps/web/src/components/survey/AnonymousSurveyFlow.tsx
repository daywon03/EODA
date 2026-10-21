"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnonymousSurveyTemplateView } from "@/lib/actions/anonymous-survey";
// Le module seul, pas tout le contenu des questionnaires (paquet de la page publique).
import { missingAnswerHint } from "@/content/enquete/hints";
import { ProgressBar } from "@/components/ui/progress-bar";
import { TABLET_CHOICE, TABLET_CHOICE_OFF, TABLET_CHOICE_ON, TABLET_PRIMARY, TABLET_SECONDARY } from "@/components/tablet/tablet-ui";

// Une question par écran, gros boutons, passage automatique après un choix — le même
// geste sur la tablette et sur le téléphone d'un proche. Aucune zone de texte :
// l'enquête anonyme n'en a pas (un texte peut contenir un nom).
type Props = {
  template: AnonymousSurveyTemplateView;
  // Phrase d'aide au-dessus de chaque question (tablette : « lisez à voix haute »).
  coaching?: string;
  onBack: () => void;
  onFinish: (answers: Record<string, string>) => Promise<string | null>;
};

export function AnonymousSurveyFlow({ template, coaching, onBack, onFinish }: Props) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [hint, setHint] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const advance = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (advance.current) clearTimeout(advance.current);
  }, []);

  const total = template.questions.length;
  const question = template.questions[index]!;
  const isLast = index === total - 1;
  const chosen = answers[question.id];

  function choose(choice: string) {
    setAnswers((current) => ({ ...current, [question.id]: choice }));
    setHint(null);
    if (advance.current) clearTimeout(advance.current);
    if (!isLast) advance.current = setTimeout(() => setIndex((i) => (i === index ? i + 1 : i)), 320);
  }

  async function next() {
    if (!chosen) {
      setHint(missingAnswerHint(question.options));
      return;
    }
    if (!isLast) {
      setIndex(index + 1);
      return;
    }
    setSending(true);
    const error = await onFinish(answers);
    setSending(false);
    if (error) setHint(error);
  }

  return (
    <section aria-labelledby="enquete-question" className="mx-auto flex w-full max-w-[860px] flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-bold tabular-nums text-ink2" aria-live="polite">
          {question.number ? `Question ${question.number} · ` : "Question "}
          {index + 1} sur {total}
        </p>
        <ProgressBar value={index + 1} max={total} label="Avancement de l'enquête" colorClassName="bg-accent-fill" className="min-w-[140px] max-w-[280px] flex-1" />
      </div>
      {coaching && <p className="rounded-xl bg-soft px-4 py-3">{coaching}</p>}
      <h1 id="enquete-question" className="text-balance text-[28px] font-bold leading-tight sm:text-[34px]">
        {question.prompt}
      </h1>
      {question.help && <p className="text-ink2">{question.help}</p>}
      <div className="flex flex-col gap-3" role="group" aria-labelledby="enquete-question">
        {question.options.map((option) => (
          <button
            key={option.choice}
            type="button"
            aria-pressed={chosen === option.choice}
            onClick={() => choose(option.choice)}
            className={cn(TABLET_CHOICE, chosen === option.choice ? TABLET_CHOICE_ON : TABLET_CHOICE_OFF)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {hint && (
        <p role="alert" className="font-bold text-danger-text">
          {hint}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="button" className={TABLET_SECONDARY} onClick={() => (index > 0 ? setIndex(index - 1) : onBack())} disabled={sending}>
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          Retour
        </button>
        <button type="button" className={cn(TABLET_PRIMARY, "flex-1")} onClick={() => void next()} disabled={sending}>
          {isLast ? (sending ? "Envoi…" : "Envoyer mes réponses") : "Question suivante"}
        </button>
      </div>
    </section>
  );
}
