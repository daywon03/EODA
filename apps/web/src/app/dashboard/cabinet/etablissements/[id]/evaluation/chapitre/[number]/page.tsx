import { notFound } from "next/navigation";
import { getEstablishment } from "@/lib/actions/establishment";
import { getEvaluationChapter, startOrResumeEvaluationSession } from "@/lib/actions/evaluation";
import { PageHeader } from "@/components/layout/PageHeader";
import { SessionTimer } from "@/components/evaluation/SessionTimer";
import { FinishSessionButton } from "@/components/evaluation/FinishSessionButton";
import { CriterionGroup } from "@/components/evaluation/CriterionGroup";
import { ChapterResultsSummary } from "@/components/evaluation/ChapterResultsSummary";

type Props = { params: Promise<{ id: string; number: string }> };

export default async function EvaluationChapterPage({ params }: Props) {
  const { id, number } = await params;
  const chapterNumber = Number(number);
  if (!Number.isInteger(chapterNumber)) notFound();

  const [establishment, data] = await Promise.all([
    getEstablishment(id),
    getEvaluationChapter(id, chapterNumber),
  ]);

  if (data.missionRequired) notFound();

  const { sessionId, startedAt } = await startOrResumeEvaluationSession(id, data.chapter.id);

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={`Chapitre ${data.chapter.number} — ${data.chapter.name}`}
        subtitle={`${establishment.name} · ${data.chapter.method}`}
        backHref={`/dashboard/cabinet/etablissements/${id}/evaluation`}
        action={
          <div className="flex items-center gap-3">
            <SessionTimer startedAt={startedAt} />
            <FinishSessionButton sessionId={sessionId} />
          </div>
        }
      />

      <ChapterResultsSummary chapterScore={data.chapterScore} imperatifsAtRisk={data.imperatifsAtRisk} />

      <div className="space-y-6">
        {data.themes.map((theme) => (
          <div key={theme.id} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-brun-ancre">{theme.name}</h2>
              {theme.score !== null && (
                <span className="text-sm font-semibold text-brun-ancre tabular-nums">{theme.score.toFixed(1)}/4</span>
              )}
            </div>
            {theme.objectives.map((objective) => (
              <div key={objective.id} className="space-y-2 pl-3 border-l-2 border-gris-light">
                <p className="text-xs text-gris-mid uppercase tracking-wide">Objectif {objective.code}</p>
                {objective.criteria.map((criterion) => (
                  <CriterionGroup key={criterion.id} sessionId={sessionId} criterion={criterion} />
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
