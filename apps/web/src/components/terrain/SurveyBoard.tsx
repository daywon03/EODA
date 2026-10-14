import { Download, MessageSquareHeart } from "lucide-react";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { gradeLabel, type SatisfactionGrade, type TemplateStats } from "@/lib/services/survey-stats-service";
import type { TerrainSurveyBoard } from "@/lib/actions/terrain-read";
import { SurveyPlanForm } from "./SurveyPlanForm";

// Enquêtes de satisfaction (maquette « Espace structure », A5) : avancement,
// satisfaction par question, plan d'action PROPOSÉ, idées. Tout est AGRÉGÉ : aucun
// nom, aucune réponse individuelle. Le niveau s'écrit en toutes lettres à côté du
// pourcentage — la couleur de la barre ne porte jamais seule l'information.
const GRADE_FILL: Record<SatisfactionGrade, string> = {
  EXCELLENT: "bg-green-fill",
  SATISFAISANT: "bg-green-fill",
  A_SURVEILLER: "bg-amber-fill",
  ALERTE: "bg-danger-fill",
};

function StatsSection({ stats }: { stats: TemplateStats }) {
  const rated = stats.questions.filter((q) => !q.isControl);
  return (
    <section aria-labelledby={`stats-${stats.templateCode}`} className="flex flex-col gap-3 rounded-xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`stats-${stats.templateCode}`} className="text-xl font-bold">
          {stats.templateCode === "PERSONNE" ? "Personnes accompagnées" : "Familles et proches"}
        </h2>
        <span className="tabular-nums text-ink2">
          {stats.responses} réponse{stats.responses > 1 ? "s" : ""}
          {stats.rate !== null && ` · ${stats.rate} % · ${gradeLabel(stats.grade)}`}
        </span>
      </div>
      {stats.responses === 0 ? (
        <p className="text-ink2">Pas encore de réponse à ce questionnaire.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rated.map((q) => (
            <li key={q.questionId} className="flex flex-col gap-1.5">
              <div className="flex justify-between gap-3">
                <span>{q.shortLabel}</span>
                <span className="whitespace-nowrap font-bold tabular-nums">
                  {q.rate === null ? "—" : `${q.rate} %`} <span className="font-normal text-ink2">{gradeLabel(q.grade)}</span>
                </span>
              </div>
              <ProgressBar
                value={q.rate ?? 0}
                label={q.shortLabel}
                valueText={q.rate === null ? "Pas encore de données" : `${q.rate} %, ${gradeLabel(q.grade)}`}
                colorClassName={q.grade ? GRADE_FILL[q.grade] : "bg-line"}
              />
            </li>
          ))}
        </ul>
      )}
      {stats.controlAlerts > 0 && (
        <p className="font-bold">
          {stats.controlAlerts} réponse{stats.controlAlerts > 1 ? "s" : ""} « Non » ou « Je ne sais pas » sur la personne à prévenir : dossiers à mettre à jour.
        </p>
      )}
    </section>
  );
}

type Props = { board: TerrainSurveyBoard; establishmentId: string; canWrite: boolean };

export function SurveyBoard({ board, establishmentId, canWrite }: Props) {
  const ideas = board.surveyStats.flatMap((s) => [
    ...s.verbatims.map((t) => ({ text: t, kind: s.templateCode === "PERSONNE" ? "Une personne accompagnée" : "Un proche" })),
    ...s.ruleProposals.map((t) => ({ text: t, kind: "Proposition sur le règlement de fonctionnement" })),
  ]);
  const responses = board.coverage.personne + board.coverage.famille;

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="avancement-titre" className="flex flex-col gap-3 rounded-xl border border-line bg-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="avancement-titre" className="text-xl font-bold">Avancement</h2>
          <span className="text-[28px] font-bold tabular-nums">
            {board.coverage.done} / {board.coverage.total}
          </span>
        </div>
        <ProgressBar
          value={board.coverage.done}
          max={Math.max(board.coverage.total, 1)}
          label="Personnes accompagnées interrogées"
          valueText={`${board.coverage.done} personnes sur ${board.coverage.total}`}
          colorClassName="bg-accent-fill"
        />
        <p className="text-ink2">
          {board.coverage.personne} questionnaire{board.coverage.personne > 1 ? "s" : ""} personne · {board.coverage.famille} questionnaire
          {board.coverage.famille > 1 ? "s" : ""} famille, sur les 12 derniers mois.
        </p>
        {responses > 0 && (
          <a
            href={`/api/export/enquete/${encodeURIComponent(establishmentId)}`}
            className="inline-flex h-11 w-fit items-center gap-2 rounded-md border border-line bg-card px-4 font-bold hover:bg-soft"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Exporter les résultats (tableur)
          </a>
        )}
      </section>

      {responses === 0 ? (
        <EmptyState
          icon={MessageSquareHeart}
          title="Pas encore de résultats"
          description="Les intervenants font l'enquête sur la tablette, au domicile. Les taux s'affichent ici dès les premières réponses, sans aucun nom."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {board.surveyStats.map((stats) => (
            <StatsSection key={stats.templateCode} stats={stats} />
          ))}
        </div>
      )}

      {board.proposals.length > 0 && (
        <SurveyPlanForm establishmentId={establishmentId} proposals={board.proposals} canWrite={canWrite} />
      )}

      {board.freeTextsWithheld && responses > 0 && (
        <p className="text-ink2">
          Les commentaires libres restent dans l&apos;espace de la structure : un texte libre peut contenir un nom.
        </p>
      )}

      {ideas.length > 0 && (
        <section aria-labelledby="idees-titre" className="flex flex-col gap-2 rounded-xl border border-line bg-card p-5">
          <h2 id="idees-titre" className="text-xl font-bold">Idées des personnes et des familles</h2>
          <ul className="divide-y divide-line">
            {ideas.map((idea, index) => (
              <li key={index} className="flex flex-col py-2.5">
                <span>« {idea.text} »</span>
                <span className="text-ink2">{idea.kind}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
