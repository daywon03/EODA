"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, Check, CheckCircle2, Loader2, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { submitPublicQuiz, type PublicQuestion, type PublicQuizResult } from "@/lib/actions/quiz-public";
import type { QuizPictogram } from "@/content/quiz/types";
import { QUIZ_PICTOGRAMS } from "./quiz-pictograms";
import { QuizRefusal } from "./QuizRefusal";

// Passage du quiz sur téléphone (FALC) : une question par écran, « Question N sur
// M », trois gros boutons, retour possible, envoi à la dernière réponse. Le score
// est calculé par le serveur ; l'écran de fin donne les bonnes réponses expliquées
// (on sensibilise, on ne piège pas).
type Props = { token: string; quiz: { title: string; pictogram: QuizPictogram; questions: PublicQuestion[] } };

export function PublicQuizRunner({ token, quiz }: Props) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<PublicQuizResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const Pictogram = QUIZ_PICTOGRAMS[quiz.pictogram];
  const question = quiz.questions[index];
  const total = quiz.questions.length;

  function choose(choiceId: string) {
    if (!question) return;
    const next = { ...answers, [question.id]: choiceId };
    setAnswers(next);
    if (index < total - 1) {
      setIndex(index + 1);
      return;
    }
    startTransition(async () => setResult(await submitPublicQuiz(token, next)));
  }

  if (result && result.state === "DONE") return <QuizResult title={quiz.title} result={result} />;
  if (result && result.state !== "INCOMPLETE") return <QuizRefusal state={result.state} />;
  if (!question) return null;

  return (
    <section aria-labelledby="quiz-question" className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Pictogram className="h-10 w-10 flex-shrink-0 text-accent-text" aria-hidden="true" />
        <p className="font-bold">{quiz.title}</p>
      </div>
      <div className="flex flex-col gap-2">
        <p className="font-bold tabular-nums" aria-live="polite">
          Question {index + 1} sur {total}
        </p>
        <div className="h-2.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
          <div className="h-full rounded-full bg-accent-fill" style={{ width: `${((index + 1) / total) * 100}%` }} />
        </div>
      </div>
      <h1 id="quiz-question" className="text-[26px] font-bold leading-snug">
        {question.prompt}
      </h1>
      <ul className="flex flex-col gap-3">
        {question.choices.map((choice) => {
          const selected = answers[question.id] === choice.id;
          return (
            <li key={choice.id}>
              <button
                type="button"
                onClick={() => choose(choice.id)}
                disabled={isPending}
                aria-pressed={selected}
                className={cn(
                  "flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 px-5 py-3 text-left text-[20px] font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-70",
                  selected ? "border-accent-fill bg-paper" : "border-line bg-card"
                )}
              >
                <span className="flex-1">{choice.label}</span>
                {selected && <Check className="h-6 w-6 flex-shrink-0" aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ul>
      {result?.state === "INCOMPLETE" && (
        <p role="alert" className="font-bold text-rouge-imp">
          Répondez à toutes les questions.
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        {index > 0 ? (
          <button
            type="button"
            onClick={() => setIndex(index - 1)}
            disabled={isPending}
            className="flex min-h-14 items-center gap-2 rounded-xl border border-line bg-card px-4 font-bold"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            Question précédente
          </button>
        ) : (
          <span />
        )}
        {isPending && (
          <span role="status" className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Envoi…
          </span>
        )}
      </div>
    </section>
  );
}

function QuizResult({ title, result }: { title: string; result: Extract<PublicQuizResult, { state: "DONE" }> }) {
  return (
    <section aria-labelledby="quiz-result" className="flex flex-col gap-5">
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-line bg-card p-6">
        {result.passed ? (
          <CheckCircle2 className="h-12 w-12 text-ok-text" aria-hidden="true" />
        ) : (
          <RotateCcw className="h-12 w-12 text-accent-text" aria-hidden="true" />
        )}
        <h1 id="quiz-result" className="text-[28px] font-bold leading-tight">
          {result.passed ? "Bravo, c'est réussi !" : "Presque ! Vous le referez bientôt."}
        </h1>
        <p className="tabular-nums">
          {title} : {result.score} bonnes réponses sur {result.total}.
        </p>
      </div>
      <h2 className="text-[22px] font-bold">Les bonnes réponses</h2>
      <ol className="flex flex-col gap-3">
        {result.corrections.map((c, i) => (
          <li key={c.id} className="rounded-2xl border border-line bg-card p-4">
            <p className="font-bold">
              {i + 1}. {c.prompt}
            </p>
            <p className="mt-1 flex items-start gap-2">
              {c.wasCorrect ? (
                <Check className="mt-1 h-5 w-5 flex-shrink-0 text-ok-text" aria-label="Juste" />
              ) : (
                <X className="mt-1 h-5 w-5 flex-shrink-0 text-rouge-imp" aria-label="Faux" />
              )}
              <span>{c.correctLabel}</span>
            </p>
            <p className="mt-1 text-ink2">{c.explanation}</p>
          </li>
        ))}
      </ol>
      <p>Vous pouvez fermer cette page.</p>
    </section>
  );
}
