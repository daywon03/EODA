import { ElementRow } from "./ElementRow";
import { NC_ON_IMPERATIF_REFUSAL, scoreLabel } from "@/lib/services/scoring-service";
import type { EvaluationCriterionView } from "@/lib/actions/evaluation-chapter";

// Un critère et ses éléments d'évaluation : la cotation se fait à l'ÉLÉMENT
// (décision 4, unité de Synaé), l'affichage regroupe par critère.
//
// `sessionId` null = aucune session ouverte : les cotations s'affichent, elles ne se
// modifient pas. L'action serveur refuse de toute façon d'écrire dans une session
// clôturée — l'absence de boutons n'en est que le reflet visible.
type Props = {
  sessionId: string | null;
  criterion: EvaluationCriterionView;
  context: string;
};

export function CriterionGroup({ sessionId, criterion, context }: Props) {
  const isImperatif = criterion.requirementLevel === "IMPERATIF";
  const ncNoteId = `nc-${criterion.id}`;
  const headingId = `critere-${criterion.id}`;

  return (
    <li aria-labelledby={headingId} className="space-y-3 rounded-xl border border-line bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h4 id={headingId} className="font-bold text-ink">
            <span className="tabular-nums">{criterion.code}</span> — {criterion.label}
          </h4>
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-ink2">
            {isImperatif && <span className="font-bold text-danger-text">▲ Impératif</span>}
            <span>{context}</span>
          </p>
        </div>
        <p className="text-sm font-bold tabular-nums text-ink">
          {criterion.score === null
            ? "Non coté"
            : `${criterion.score.toFixed(1).replace(".", ",")} / 4 · ${scoreLabel(criterion.score)}`}
        </p>
      </div>

      {isImperatif && sessionId !== null && (
        <p id={ncNoteId} className="text-sm text-ink2">
          {NC_ON_IMPERATIF_REFUSAL}
        </p>
      )}

      <ul className="divide-y divide-line border-t border-line">
        {criterion.elements.map((element) => (
          <ElementRow
            key={element.id}
            sessionId={sessionId}
            element={element}
            isImperatif={isImperatif}
            ncNoteId={ncNoteId}
          />
        ))}
      </ul>
    </li>
  );
}
