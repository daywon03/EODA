import { getEstablishment } from "@/lib/actions/establishment";
import { getEvaluationComparison } from "@/lib/actions/evaluation-comparison";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/services/date-format-service";
import { formatDelta, type ComparisonTrend } from "@/lib/services/evaluation-comparison-service";
import { scoreLabel } from "@/lib/services/scoring-service";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Equal, Minus } from "lucide-react";

export const metadata = { title: "Comparaison des sessions · EODA Conseil" };

type Props = { params: Promise<{ id: string }> };

const TREND_STYLE: Record<ComparisonTrend, { className: string; icon: typeof Equal }> = {
  PROGRESSION: { className: "text-vert-ok", icon: ArrowUpRight },
  REGRESSION: { className: "text-rouge-imp", icon: ArrowDownRight },
  STABLE: { className: "text-gris-mid", icon: Equal },
  INCOMPARABLE: { className: "text-gris-mid", icon: Minus },
};

// ─────────────────────────────────────────────────────────────────────────────
// DEUXIÈME AUTO-ÉVALUATION, COMPARÉE À LA PREMIÈRE (§12.6, offre Excellence).
//
// Les deux sessions comparées sont les deux dernières du chapitre. Tout le calcul vit
// dans `evaluation-comparison-service` (pur, testé) : cet écran ne fait que rendre —
// et il rend d'abord ce qui a RECULÉ, parce que c'est ce qui coûte cher le jour de la
// visite.
// ─────────────────────────────────────────────────────────────────────────────
export default async function EvaluationComparisonPage({ params }: Props) {
  const { id } = await params;
  const [establishment, comparison] = await Promise.all([
    getEstablishment(id),
    getEvaluationComparison(id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comparaison des auto-évaluations"
        subtitle={establishment.name}
        backHref={`/dashboard/cabinet/etablissements/${id}/evaluation`}
      />

      {comparison.chapters.length === 0 ? (
        <div className="rounded-xl border border-gris-light bg-white px-5 py-8 text-center">
          <p className="text-sm font-semibold text-brun-ancre">Rien à comparer pour l&apos;instant</p>
          <p className="mt-1 text-sm text-gris-mid">
            La comparaison s&apos;affiche dès qu&apos;un chapitre a été coté au cours de deux
            sessions distinctes. Clôturez la session en cours, puis ouvrez-en une nouvelle
            pour la seconde auto-évaluation.
          </p>
        </div>
      ) : (
        comparison.chapters.map((chapter) => (
          <Card key={chapter.chapterNumber}>
            <CardHeader>
              <CardTitle className="text-base">
                Chapitre {chapter.chapterNumber} — {chapter.chapterName}
              </CardTitle>
              <p className="text-xs text-gris-mid">
                Session du {formatDate(chapter.previousStartedAt)} comparée à celle du{" "}
                {formatDate(chapter.currentStartedAt)}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Counter label="Critères comparables" value={String(chapter.summary.comparable)} />
                <Counter label="En progression" value={String(chapter.summary.progression)} />
                <Counter label="En recul" value={String(chapter.summary.regression)} />
                <Counter
                  label="Moyenne"
                  value={`${scoreLabel(chapter.summary.currentAverage)} (${formatDelta(
                    chapter.summary.averageDelta
                  )})`}
                />
              </div>

              {/* La ligne qu'on regarde en premier : un impératif qui était à 4 et
                  n'y est plus. */}
              {chapter.summary.imperatifsRegressed.length > 0 && (
                <div className="flex items-start gap-3 rounded-lg border border-rouge-imp/30 bg-rouge-imp/5 px-4 py-3">
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 flex-shrink-0 text-rouge-imp"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-brun-ancre">
                    Critères impératifs passés sous 4 depuis la première session :{" "}
                    <span className="font-semibold">
                      {chapter.summary.imperatifsRegressed.join(", ")}
                    </span>
                  </p>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gris-light text-left text-xs uppercase tracking-wide text-gris-mid">
                      <th className="py-2">Critère</th>
                      <th className="py-2 text-right">1ʳᵉ session</th>
                      <th className="py-2 text-right">2ᵉ session</th>
                      <th className="py-2 text-right">Écart</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gris-light">
                    {chapter.comparisons.map((line) => {
                      const { className, icon: Icon } = TREND_STYLE[line.trend];
                      return (
                        <tr key={line.code}>
                          <td className="py-2 pr-3">
                            <span className="font-medium text-brun-ancre">{line.code}</span>
                            {line.requirementLevel === "IMPERATIF" && (
                              <span className="ml-2 text-xs text-rouge-imp">impératif</span>
                            )}
                            <span className="block text-xs text-gris-mid">{line.label}</span>
                          </td>
                          <td className="py-2 text-right tabular-nums text-gris-mid">
                            {scoreLabel(line.previousScore)}
                          </td>
                          <td className="py-2 text-right tabular-nums text-brun-ancre">
                            {scoreLabel(line.currentScore)}
                          </td>
                          <td className={`py-2 text-right tabular-nums ${className}`}>
                            <span className="inline-flex items-center gap-1">
                              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                              {formatDelta(line.delta)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {chapter.summary.incomparable > 0 && (
                <p className="text-xs text-gris-mid">
                  {chapter.summary.incomparable} critère(s) coté(s) d&apos;un seul côté, ou
                  entièrement NC/RI : aucun écart n&apos;est calculé — un écart déduit d&apos;une
                  absence serait faux.
                </p>
              )}
            </CardContent>
          </Card>
        ))
      )}

      {comparison.chaptersWithSingleSession.length > 0 && (
        <p className="text-sm text-gris-mid">
          Chapitre(s) {comparison.chaptersWithSingleSession.join(", ")} : une seule session à ce
          jour, la comparaison s&apos;affichera après la seconde auto-évaluation.
        </p>
      )}
    </div>
  );
}

function Counter({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gris-light bg-ivoire/40 px-3 py-2">
      <p className="text-xs text-gris-mid">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-brun-ancre">{value}</p>
    </div>
  );
}
