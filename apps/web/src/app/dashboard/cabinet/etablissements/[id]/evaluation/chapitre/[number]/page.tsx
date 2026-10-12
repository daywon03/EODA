import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/services/date-format-service";
import { getChapterSessionState } from "@/lib/actions/evaluation";
import { getEvaluationChapter } from "@/lib/actions/evaluation-chapter";
import { getEstablishment } from "@/lib/actions/establishment";
import { describeChapterMeasure } from "@/lib/services/structure-sheet-service";
import { countRatedElements, describeChapterRatedMeasure } from "@/lib/services/self-assessment-service";
import { structureHref } from "@/lib/design/structure-tabs";
import { chapterLabel } from "@/lib/services/chapter-label-service";
import { SessionTimer } from "@/components/evaluation/SessionTimer";
import { FinishSessionButton } from "@/components/evaluation/FinishSessionButton";
import { OpenSessionButton } from "@/components/evaluation/OpenSessionButton";
import { ChapterResultsSummary } from "@/components/evaluation/ChapterResultsSummary";
import { CriteriaBoard } from "@/components/evaluation/CriteriaBoard";
import { MeasureCard } from "@/components/ui/measure-card";
import { Callout } from "@/components/ui/callout";

type Props = { params: Promise<{ id: string; number: string }> };

export default async function EvaluationChapterPage({ params }: Props) {
  const { id, number } = await params;
  const chapterNumber = Number(number);
  if (!Number.isInteger(chapterNumber)) notFound();

  // getEstablishment reste appelé : c'est la garde (tenant, notFound) de la route.
  const [, data] = await Promise.all([getEstablishment(id), getEvaluationChapter(id, chapterNumber)]);
  if (data.missionRequired) notFound();

  // La session n'est PLUS créée par le rendu de cette page (cf. `getChapterSessionState`) :
  // on lit son état, et l'ouverture est un geste.
  const sessionState = await getChapterSessionState(id, data.chapter.id);
  const sessionId = sessionState.kind === "OPEN" ? sessionState.sessionId : null;

  const criteria = data.themes.flatMap((t) => t.objectives.flatMap((o) => o.criteria));
  const scoreMeasure = describeChapterMeasure({
    number: data.chapter.number,
    name: data.chapter.name,
    score: data.chapterScore,
    imperatifsAtRisk: data.imperatifsAtRisk.length,
  });
  const ratedMeasure = describeChapterRatedMeasure(data.chapter, countRatedElements(criteria));

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link href={structureHref(id, "evaluation")} className="font-bold text-accent-text hover:underline">
            ← Auto-évaluation
          </Link>
          <h2 className="text-2xl font-bold text-ink">
            {chapterLabel(data.chapter)}
          </h2>
          {/* Méthode d'évaluation du chapitre, telle que la base la porte. */}
          {data.chapter.method && (
            <span className="inline-flex w-fit rounded-md border border-line bg-soft px-2.5 py-0.5 text-sm font-bold text-ink">
              {data.chapter.method}
            </span>
          )}
        </div>
        {sessionState.kind === "OPEN" ? (
          <div className="flex items-center gap-3">
            <SessionTimer startedAt={sessionState.startedAt} />
            <FinishSessionButton sessionId={sessionState.sessionId} />
          </div>
        ) : (
          <OpenSessionButton
            establishmentId={id}
            chapterId={data.chapter.id}
            chapterNumber={data.chapter.number}
            isSecondSession={sessionState.kind === "CLOSED"}
          />
        )}
      </div>

      {/* Session clôturée : les cotations restent LISIBLES, plus modifiables. Une
          session close est la photo d'un état à une date — la réécrire ferait dériver
          la première auto-évaluation pendant qu'on mène la seconde. */}
      {sessionState.kind === "CLOSED" && (
        <Callout title={`Session clôturée le ${formatDate(sessionState.finishedAt)}`}>
          Les cotations ci-dessous sont conservées en lecture. Ouvrir une nouvelle session démarre
          une auto-évaluation distincte, comparable à celle-ci — elle n&apos;écrase rien.
          {sessionState.sessionCount > 1 &&
            ` ${sessionState.sessionCount} sessions ont déjà été menées sur ce chapitre.`}
        </Callout>
      )}
      {sessionState.kind === "NONE" && (
        <Callout title="Aucune session ouverte">
          Démarrez une session pour coter les éléments d&apos;évaluation de ce chapitre.
        </Callout>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <MeasureCard {...scoreMeasure} label="Score du chapitre" />
        <MeasureCard {...ratedMeasure} label="Éléments cotés" />
      </div>

      <ChapterResultsSummary imperatifsAtRisk={data.imperatifsAtRisk} />

      <CriteriaBoard sessionId={sessionId} themes={data.themes} />

      <p className="text-sm text-ink2">
        Cotation HAS par élément d&apos;évaluation : 1 pas du tout, 2 plutôt pas, 3 plutôt, 4 tout à
        fait satisfaisant, ★ niveau optimisé (compte 4), NC non concerné (hors moyenne, impossible sur
        un impératif){data.chapter.number === 1 ? ", RI réponse inadaptée (hors moyenne)" : ""}.
      </p>
    </div>
  );
}
