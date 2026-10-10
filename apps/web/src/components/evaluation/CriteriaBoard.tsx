"use client";

import { useMemo, useState } from "react";
import type { EvaluationThemeView } from "@/lib/actions/evaluation-chapter";
import {
  ASSESSMENT_FILTERS,
  countByFilter,
  matchesFilter,
  type AssessmentFilter,
} from "@/lib/services/self-assessment-service";
import { FilterChip } from "@/components/ui/filter-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { CriterionGroup } from "./CriterionGroup";

type Props = { sessionId: string | null; themes: readonly EvaluationThemeView[] };

// Critères d'un chapitre, filtrables (maquette v2, vue Auto-évaluation). Les filtres
// sont des règles pures (self-assessment-service) : ce composant ne fait que choisir.
export function CriteriaBoard({ sessionId, themes }: Props) {
  const [filter, setFilter] = useState<AssessmentFilter>("ALL");

  const rows = useMemo(
    () =>
      themes.flatMap((theme) =>
        theme.objectives.flatMap((objective) =>
          objective.criteria.map((criterion) => ({
            criterion,
            context: `${theme.name} · objectif ${objective.code}`,
          }))
        )
      ),
    [themes]
  );
  const counts = useMemo(() => countByFilter(rows.map((r) => r.criterion)), [rows]);
  const visible = rows.filter((r) => matchesFilter(r.criterion, filter));

  return (
    <section aria-labelledby="criteres-titre" className="space-y-4">
      <h3 id="criteres-titre" className="sr-only">
        Critères du chapitre
      </h3>
      <div role="group" aria-label="Filtrer les critères" className="flex flex-wrap gap-2">
        {ASSESSMENT_FILTERS.map((f) => (
          <FilterChip key={f.id} pressed={filter === f.id} count={counts[f.id]} onClick={() => setFilter(f.id)}>
            {f.label}
          </FilterChip>
        ))}
      </div>
      <p className="text-sm text-ink2" aria-live="polite">
        {visible.length} critère{visible.length > 1 ? "s" : ""} affiché{visible.length > 1 ? "s" : ""} sur {rows.length}
      </p>
      {visible.length === 0 ? (
        <EmptyState title="Aucun critère pour ce filtre" />
      ) : (
        <ul className="space-y-4">
          {visible.map(({ criterion, context }) => (
            <CriterionGroup key={criterion.id} sessionId={sessionId} criterion={criterion} context={context} />
          ))}
        </ul>
      )}
    </section>
  );
}
