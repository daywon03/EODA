import { Badge } from "@/components/ui/badge";
import { ElementRow } from "./ElementRow";
import { scoreLabel } from "@/lib/services/scoring-service";
import type { EvaluationCriterionView } from "@/lib/actions/evaluation";

// `sessionId` null = aucune session ouverte : les cotations s'affichent, elles ne se
// modifient pas. L'action serveur refuse de toute façon d'écrire dans une session
// clôturée — l'absence de boutons n'en est que le reflet visible.
type Props = { sessionId: string | null; criterion: EvaluationCriterionView };

export function CriterionGroup({ sessionId, criterion }: Props) {
  return (
    <div className="border border-gris-light rounded-lg p-4 space-y-1">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-gris-mid">{criterion.code}</p>
          <p className="text-sm font-semibold text-brun-ancre">{criterion.label}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {criterion.requirementLevel === "IMPERATIF" && <Badge variant="imperatif">Impératif</Badge>}
          {criterion.score !== null && (
            <span className="text-xs font-semibold text-brun-ancre tabular-nums">
              {criterion.score.toFixed(1)}/4 · {scoreLabel(criterion.score)}
            </span>
          )}
        </div>
      </div>
      <div className="pt-1">
        {criterion.elements.map((element) => (
          <ElementRow key={element.id} sessionId={sessionId} element={element} />
        ))}
      </div>
    </div>
  );
}
