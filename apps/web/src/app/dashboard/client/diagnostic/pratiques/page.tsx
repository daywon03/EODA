import Link from "next/link";
import { getClientPractices } from "@/lib/actions/practice";
import { parseQuestionIndex } from "@/lib/services/practice-service";
import { CLIENT_DIAGNOSTIC_PATH, CLIENT_PRACTICES_PATH } from "@/lib/design/client-navigation";
import { ProgressBar } from "@/components/ui/progress-bar";
import { PracticeQuestionForm } from "@/components/diagnostic/PracticeQuestionForm";

export const metadata = { title: "Questions sur vos pratiques" };

type Props = { searchParams: Promise<{ q?: string | string[] }> };

// « Questions sur les pratiques » (maquette Portail Client v2, N7) : une question par
// critère impératif, une à la fois. Le numéro est dans l'adresse (?q=3) : partageable,
// et « Retour » ne perd rien.
export default async function ClientPracticesPage({ searchParams }: Props) {
  const [practices, params] = await Promise.all([getClientPractices(), searchParams]);

  if (!practices || practices.questions.length === 0) {
    return (
      <div className="space-y-3">
        <h1 className="text-[34px] font-bold">Vos pratiques</h1>
        <p>Aucune question pour le moment.</p>
        <Link href={CLIENT_DIAGNOSTIC_PATH} className="font-bold text-accent-text underline">
          ← Mon diagnostic
        </Link>
      </div>
    );
  }

  const total = practices.questions.length;
  const index = parseQuestionIndex(params.q, total);
  const question = practices.questions[index]!;
  const isLast = index === total - 1;
  const previousHref = index === 0 ? CLIENT_DIAGNOSTIC_PATH : `${CLIENT_PRACTICES_PATH}?q=${index}`;
  const nextHref = isLast ? CLIENT_DIAGNOSTIC_PATH : `${CLIENT_PRACTICES_PATH}?q=${index + 2}`;

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6">
      <Link
        href={CLIENT_DIAGNOSTIC_PATH}
        className="inline-flex min-h-12 w-fit items-center rounded-[10px] border border-ink bg-card px-4 text-ink hover:bg-soft"
      >
        ← Mon diagnostic
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
      {question.outdated && (
        <p className="text-ink2">La question a été reformulée depuis votre réponse : relisez-la et répondez à nouveau.</p>
      )}

      <PracticeQuestionForm
        key={question.criterionId}
        criterionId={question.criterionId}
        initialAnswer={question.current && !question.outdated ? question.current.answer : null}
        initialText={question.current?.text ?? ""}
        previousHref={previousHref}
        nextHref={nextHref}
        isLast={isLast}
        disabled={!practices.canAnswer}
      />

      <div className="flex flex-col gap-1 rounded-xl border border-line bg-card p-4">
        <span className="font-bold">{question.linkedDocuments}</span>
        <span className="text-ink2">{question.proofHint}</span>
      </div>

      {practices.provisional && (
        <p className="text-base text-ink2">
          Questions provisoires ({practices.questionnaireVersion}) : EODA les relit et peut les reformuler.
        </p>
      )}
    </div>
  );
}
