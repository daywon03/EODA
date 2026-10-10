import type { EvaluationChapterData } from "@/lib/actions/evaluation-chapter";

type Props = { imperatifsAtRisk: EvaluationChapterData["imperatifsAtRisk"] };

// Impératifs cotés sous 4 : à traiter en priorité (02-referentiel-has.md §5 — plan
// d'action obligatoire). Rien à signaler = rien d'affiché.
export function ChapterResultsSummary({ imperatifsAtRisk }: Props) {
  if (imperatifsAtRisk.length === 0) return null;
  const plural = imperatifsAtRisk.length > 1;
  return (
    <section aria-labelledby="imperatifs-a-traiter" className="space-y-2 rounded-xl border border-line bg-card p-5">
      <h3 id="imperatifs-a-traiter" className="font-bold text-danger-text">
        <span aria-hidden="true">▲ </span>
        {imperatifsAtRisk.length} critère{plural ? "s" : ""} impératif{plural ? "s" : ""} coté{plural ? "s" : ""} sous 4
      </h3>
      <ul className="space-y-1">
        {imperatifsAtRisk.map((c) => (
          <li key={c.code} className="text-sm text-ink2">
            <span className="font-bold tabular-nums text-ink">{c.code}</span> — {c.label} (
            {c.score !== null ? c.score.toFixed(1).replace(".", ",") : "—"} / 4)
          </li>
        ))}
      </ul>
    </section>
  );
}
