import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { formatDate } from "@/lib/services/date-format-service";
import { getEstablishment } from "@/lib/actions/establishment";
import { getChapterSessionState, getEvaluationChapter } from "@/lib/actions/evaluation";
import { PageHeader } from "@/components/layout/PageHeader";
import { SessionTimer } from "@/components/evaluation/SessionTimer";
import { FinishSessionButton } from "@/components/evaluation/FinishSessionButton";
import { CriterionGroup } from "@/components/evaluation/CriterionGroup";
import { OpenSessionButton } from "@/components/evaluation/OpenSessionButton";
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

  // La session n'est PLUS créée par le rendu de cette page (cf. commentaire de
  // `getChapterSessionState`) : on lit son état, et l'ouverture est un geste.
  const sessionState = await getChapterSessionState(id, data.chapter.id);
  const sessionId = sessionState.kind === "OPEN" ? sessionState.sessionId : null;

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={`Chapitre ${data.chapter.number} — ${data.chapter.name}`}
        subtitle={`${establishment.name} · ${data.chapter.method}`}
        backHref={`/dashboard/cabinet/etablissements/${id}/evaluation`}
        action={
          sessionState.kind === "OPEN" ? (
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
          )
        }
      />

      {/* Session clôturée : les cotations restent LISIBLES, mais plus modifiables.
          Une session close est la photo d'un état à une date — la réécrire ferait
          dériver la première auto-évaluation pendant qu'on mène la seconde, et la
          comparaison des deux ne voudrait plus rien dire. */}
      {sessionState.kind === "CLOSED" && (
        <div className="flex items-start gap-3 rounded-lg border border-gris-light bg-ivoire px-5 py-4">
          <Lock className="mt-0.5 h-5 w-5 flex-shrink-0 text-ambre" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold text-brun-ancre">
              Session clôturée le {formatDate(sessionState.finishedAt)}
            </p>
            <p className="text-gris-mid">
              Les cotations ci-dessous sont conservées en lecture. Ouvrir une nouvelle session
              démarre une auto-évaluation distincte, comparable à celle-ci — elle n&apos;écrase
              rien.
              {sessionState.sessionCount > 1 &&
                ` ${sessionState.sessionCount} sessions ont déjà été menées sur ce chapitre.`}
            </p>
          </div>
        </div>
      )}

      {sessionState.kind === "NONE" && (
        <div className="flex items-start gap-3 rounded-lg border border-gris-light bg-ivoire px-5 py-4">
          <Lock className="mt-0.5 h-5 w-5 flex-shrink-0 text-gris-mid" aria-hidden="true" />
          <p className="text-sm text-gris-mid">
            Aucune session de cotation n&apos;est ouverte sur ce chapitre. Démarrez-en une pour
            coter les éléments d&apos;évaluation.
          </p>
        </div>
      )}

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
