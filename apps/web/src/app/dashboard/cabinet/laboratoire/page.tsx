import { FlaskConical } from "lucide-react";
import { getAnalysisLabOverview } from "@/lib/actions/analysis-lab";
import { ANALYSIS_PROMPT_CHOICES, DEFAULT_ANALYSIS_PROMPT_VARIANT } from "@/lib/llm/analysis-prompt-choices";
import { ANALYSIS_VERDICT_LABELS } from "@/lib/services/analysis-lab-service";
import { formatDate } from "@/lib/services/date-format-service";
import { PageHeader } from "@/components/layout/PageHeader";
import { Callout } from "@/components/ui/callout";

export const metadata = { title: "Laboratoire d'analyse" };

// ─────────────────────────────────────────────────────────────────────────────
// LABORATOIRE D'ANALYSE — bilan (demande de Damon, 29/10/2026).
//
// Les essais se lancent depuis le panneau d'un document (onglet Documents d'une
// fiche) ; cette page les rassemble et compte les verdicts par version de prompt :
// c'est sur ces chiffres que la version par défaut se choisit. Lecture seule, bornée
// au périmètre de l'appelant (getAnalysisLabOverview).
// ─────────────────────────────────────────────────────────────────────────────
export default async function AnalysisLabPage() {
  const { tallies, rows } = await getAnalysisLabOverview();
  const defaultLabel = ANALYSIS_PROMPT_CHOICES.find((c) => c.id === DEFAULT_ANALYSIS_PROMPT_VARIANT)?.label;

  return (
    <div className="flex max-w-5xl flex-col gap-8">
      <PageHeader title="Laboratoire d'analyse" subtitle={`${rows.length} essai${rows.length > 1 ? "s" : ""}`} icon={FlaskConical} />

      <Callout title="Comment s'en servir">
        Dans l&apos;onglet Documents d&apos;une structure, ouvrez un document puis « Laboratoire d&apos;analyse » : voyez le prompt
        exact envoyé au modèle, lancez un essai avec une autre version, et dites si le résultat est bon. Un essai ne change
        jamais l&apos;analyse du document. Version utilisée aujourd&apos;hui pour toutes les analyses : <strong>{defaultLabel}</strong>.
      </Callout>

      <section aria-labelledby="versions" className="space-y-3">
        <h2 id="versions" className="text-xl font-bold text-ink">
          Les versions du prompt
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {ANALYSIS_PROMPT_CHOICES.map((choice) => {
            const tally = tallies.find((t) => t.variant === choice.id);
            return (
              <li key={choice.id} className="space-y-2 rounded-xl border border-line bg-card p-4">
                <p className="font-bold text-ink">
                  {choice.label} <span className="font-normal text-ink2">· v{choice.version}</span>
                </p>
                <p className="text-sm text-ink2">{choice.description}</p>
                <p className="tabular-nums text-ink">
                  {tally ? (
                    <>
                      {tally.trials} essai{tally.trials > 1 ? "s" : ""} · <strong>{tally.good} bon{tally.good > 1 ? "s" : ""}</strong> ·{" "}
                      {tally.toReview} à revoir · {tally.unjudged} non jugé{tally.unjudged > 1 ? "s" : ""}
                    </>
                  ) : (
                    "Aucun essai"
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="essais" className="space-y-3">
        <h2 id="essais" className="text-xl font-bold text-ink">
          Derniers essais
        </h2>
        {rows.length === 0 ? (
          <p className="text-ink2">Aucun essai pour l&apos;instant.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="font-bold text-ink">{row.documentLabel}</span>
                  <span className="text-ink2"> · {row.establishmentName}</span>
                  <span className="block text-sm text-ink2">
                    {row.promptLabel} · {row.model} · le {formatDate(row.createdAt)}
                  </span>
                  {row.verdictNote && <span className="block text-sm text-ink">« {row.verdictNote} »</span>}
                </span>
                <span className="font-bold text-ink">{row.verdict ? ANALYSIS_VERDICT_LABELS[row.verdict] : "Non jugé"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
