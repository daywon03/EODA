import Link from "next/link";
import { getProspectSpace, saveProspectPracticeAnswer } from "@/lib/actions/prospect-space";
import { parseQuestionIndex } from "@/lib/services/practice-service";
import { ProgressBar } from "@/components/ui/progress-bar";
import { PracticeQuestionForm } from "@/components/diagnostic/PracticeQuestionForm";

export const metadata = { title: "Questions sur vos pratiques" };

const SPACE_PATH = "/espace";
const QUESTIONS_PATH = "/espace/diagnostic";

type Props = { searchParams: Promise<{ q?: string | string[] }> };

// Questions sur les pratiques d'une structure inscrite seule : le même écran que
// celui des structures accompagnées (une question à la fois, numéro dans l'adresse),
// enregistré par une action gardée « prospect ».
export default async function ProspectQuestionsPage({ searchParams }: Props) {
  const [space, params] = await Promise.all([getProspectSpace(), searchParams]);

  if (space.questions.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-[34px] font-bold">Vos pratiques</h1>
        <p>Aucune question pour le moment.</p>
        <Link href={SPACE_PATH} className="font-bold text-accent-text underline">
          ← Mon espace
        </Link>
      </div>
    );
  }

  const total = space.questions.length;
  const index = parseQuestionIndex(params.q, total);
  const question = space.questions[index]!;
  const isLast = index === total - 1;

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <Link href={SPACE_PATH} className="inline-flex min-h-12 w-fit items-center rounded-[10px] border border-ink bg-card px-4 hover:bg-soft">
        ← Mon espace
      </Link>
      <div role="note" className="flex items-center gap-3 rounded-xl border-2 border-accent-text bg-highlight px-4 py-3 font-bold">
        <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-current">
          !
        </span>
        Ne citez aucun nom de personne accompagnée.
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-ink2">
          Question {index + 1} sur {total} · {question.theme}
        </span>
        <ProgressBar value={index + 1} max={total} label={`Question ${index + 1} sur ${total}`} />
      </div>
      <h1 className="text-[28px] font-bold leading-tight">{question.question}</h1>
      {question.outdated && <p className="text-ink2">La question a été reformulée depuis votre réponse : relisez-la et répondez à nouveau.</p>}
      <PracticeQuestionForm
        key={question.criterionId}
        criterionId={question.criterionId}
        initialAnswer={question.current && !question.outdated ? question.current.answer : null}
        initialText={question.current?.text ?? ""}
        previousHref={index === 0 ? SPACE_PATH : `${QUESTIONS_PATH}?q=${index}`}
        nextHref={isLast ? SPACE_PATH : `${QUESTIONS_PATH}?q=${index + 2}`}
        isLast={isLast}
        disabled={space.signed}
        save={saveProspectPracticeAnswer}
        lastLabel="Enregistrer et voir ma liste de travail"
      />
      <p className="rounded-xl border border-line bg-card p-4 text-ink2">{question.proofHint}</p>
    </div>
  );
}
