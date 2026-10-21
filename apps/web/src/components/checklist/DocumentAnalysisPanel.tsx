"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import {
  ChevronDown,
  AlertCircle,
  Lightbulb,
  Check,
  Sparkles,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import type { DocumentAnalysisResult, AnalysisFinding } from "@/lib/llm";
import { describeAnalysis, splitCriteriaCoverage, summariseAnalysis } from "@/lib/services/analysis-view-service";
import { setAnalysisReviewed } from "@/lib/actions/document";
import { Button } from "@/components/ui/button";

// Le formulaire des guidelines (liste des critères, saisie, relance de l'analyse) ne
// sert qu'au cabinet, panneau ouvert : chargé à la demande, il sort du premier
// chargement de la page Documents (budget de JavaScript, check:bundle).
const CriterionSuggestionsList = dynamic(() =>
  import("./CriterionSuggestionsList").then((m) => m.CriterionSuggestionsList)
);
const AnalysisGuidelines = dynamic(() => import("./AnalysisGuidelines").then((m) => m.AnalysisGuidelines), {
  loading: () => <p className="border-t border-gris-light pt-2 text-xs text-ink2">Chargement…</p>,
});
import type { CriterionSuggestionItem } from "@/lib/actions/checklist";

// Résultat de l'analyse automatique d'une version déposée. Replié par défaut : la
// checklist doit rester lisible en une page, l'analyse s'ouvre pour le document qu'on
// traite. Ce qui reste visible fermé, c'est le nombre de manques — la seule
// information qui décide si on ouvre.
type Props = {
  analysis: DocumentAnalysisResult;
  // Côté cabinet uniquement : la revue est ce qui rend l'analyse visible au client
  // (CDC §5, §7). Côté client, ces deux propriétés restent absentes.
  documentVersionId?: string;
  reviewedAt?: Date | null;
  // Mention montrée à la STRUCTURE (review-mention-service) : relu par EODA, ou la
  // réserve d'autonomie. Calculée par la couche de lecture, jamais ici.
  clientMention?: string | null;
  canReview?: boolean;
  // Critères HAS supplémentaires détectés par l'IA, en attente de revue — jamais
  // transmis côté client (cf. buildChecklist). establishmentId n'est nécessaire
  // que pour confirmer/rejeter, donc absent si canReview l'est aussi.
  establishmentId?: string;
  criterionSuggestions?: CriterionSuggestionItem[];
};

export function DocumentAnalysisPanel({
  analysis,
  documentVersionId,
  reviewedAt = null,
  clientMention = null,
  canReview = false,
  establishmentId,
  criterionSuggestions = [],
}: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const summary = summariseAnalysis(analysis);

  function toggleReview() {
    if (!documentVersionId) return;
    setError(null);
    startTransition(async () => {
      const result = await setAnalysisReviewed(documentVersionId, reviewedAt === null);
      if (result && "error" in result) setError(result.error);
    });
  }

  return (
    <div className="mt-2 rounded-lg border border-gris-light bg-ivoire/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer focus-visible:-outline-offset-4 rounded-lg"
      >
        <ChevronDown
          className={`w-3.5 h-3.5 text-ink2 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`}
          aria-hidden="true"
        />
        <Sparkles className="w-3.5 h-3.5 text-amber-text flex-shrink-0" aria-hidden="true" />
        <span className="text-xs text-brun-ancre font-medium">Analyse automatique</span>
        <span
          className={`text-xs ${summary.missingCount > 0 ? "text-rouge-imp" : "text-ink2"}`}
        >
          {describeAnalysis(summary)}
        </span>
      </button>
      {/* Côté client, l'analyse est là parce qu'elle a été relue, ou parce que la
          structure est en autonomie (analysisVisibleTo) : on dit laquelle, avec la
          phrase unique de review-mention-service. */}
      {!canReview && clientMention && (
        <p className="px-3 pb-2 text-sm font-bold text-ink">{clientMention}</p>
      )}

      {/* « Le modèle doit savoir que ce n'est pas un compte-rendu du CVS mais une
          enquête de satisfaction » (Damon, 20/10/2026). Quand il le dit, on le montre
          TOUJOURS, panneau replié compris : c'est peut-être la raison pour laquelle
          l'analyse parle à côté, et le geste qui la corrige (reclasser le document, ou
          écrire une consigne) est juste en dessous. `correspondAuType === false` est une
          observation du modèle, jamais un verdict : la décision reste humaine. */}
      {analysis.natureObservee?.correspondAuType === false && (
        <div className="mx-3 mb-2 rounded-md border border-amber-fill/40 bg-amber-fill/10 px-2.5 py-2">
          <p className="flex items-start gap-1.5 text-sm font-bold text-ink">
            <AlertCircle className="mt-0.5 w-3.5 h-3.5 flex-shrink-0 text-amber-text" aria-hidden="true" />
            Ce document ne semble pas être celui annoncé
          </p>
          {analysis.natureObservee.commentaire && (
            <p className="mt-0.5 pl-5 text-sm text-ink2">{analysis.natureObservee.commentaire}</p>
          )}
          <p className="mt-1 pl-5 text-sm text-ink2">
            L&apos;analyse porte donc sur ce qu&apos;il est vraiment. Si le classement est faux, corrigez-le
            dans « Classement et consigne d&apos;analyse », plus bas : l&apos;analyse sera à relancer sur les
            critères du bon type.
          </p>
        </div>
      )}

      {open && (
        <div className="px-3 pb-3 pt-1 space-y-3 animate-fade-in">
          {/* Deux listes (21/10/2026) : ce que le document TRAITE, et ce qu'on attendait
              de lui sans le trouver — chacune dans l'ordre numérique du référentiel. */}
          {analysis.criteriaCoverage.length > 0 && (() => {
            const { detected, missing } = splitCriteriaCoverage(analysis.criteriaCoverage);
            return (
              <div className="space-y-2">
                {detected.length > 0 && (
                  <div>
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-brun-ancre">
                      <CheckCircle2 className="h-3.5 w-3.5 text-accent-text" aria-hidden="true" />
                      Critères HAS détectés dans le document ({detected.length})
                    </p>
                    <ul className="space-y-1 pl-5">
                      {detected.map((c) => (
                        <li key={c.criterionCode} className="list-disc text-xs marker:text-gris-light">
                          <span className="font-medium text-brun-ancre">{c.criterionCode}</span>
                          {" — "}
                          <span className={c.status === "couvert" ? "text-ok-text" : "text-amber-text"}>
                            {c.status === "couvert" ? "traité" : "traité en partie"}
                          </span>
                          {" : "}
                          <span className="text-ink2">{c.note}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {missing.length > 0 && (
                  <div>
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-brun-ancre">
                      <AlertCircle className="h-3.5 w-3.5 text-rouge-imp" aria-hidden="true" />
                      Critères attendus pour ce type de document, absents ({missing.length})
                    </p>
                    <ul className="space-y-1 pl-5">
                      {missing.map((c) => (
                        <li key={c.criterionCode} className="list-disc text-xs marker:text-gris-light">
                          <span className="font-medium text-brun-ancre">{c.criterionCode}</span>
                          {" : "}
                          <span className="text-ink2">{c.note}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })()}

          {canReview && establishmentId && (
            <CriterionSuggestionsList establishmentId={establishmentId} suggestions={criterionSuggestions} />
          )}

          {summary.missingCount > 0 && (
            <Section
              icon={<AlertCircle className="w-3.5 h-3.5 text-rouge-imp" aria-hidden="true" />}
              title="Éléments attendus non retrouvés"
              entries={analysis.elementsManquants}
            />
          )}

          {summary.suggestionCount > 0 && (
            <Section
              icon={<Lightbulb className="w-3.5 h-3.5 text-amber-text" aria-hidden="true" />}
              title="Suggestions de correction"
              entries={analysis.suggestionsCorrection}
            />
          )}

          {summary.presentCount > 0 && (
            <FindingsSection
              icon={<Check className="w-3.5 h-3.5 text-ok-text" aria-hidden="true" />}
              title="Éléments retrouvés"
              findings={analysis.elementsPresents}
            />
          )}

          {canReview && (
            <div className="flex flex-wrap items-center gap-2 border-t border-gris-light pt-2">
              {/* La restitution au client est un GESTE, pas un effet de bord du
                  dépôt : le cahier des charges impose la relecture avant affichage,
                  et EODA engage sa parole professionnelle sur ce qu'elle restitue. */}
              <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={toggleReview}>
                {isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : reviewedAt ? (
                  <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                {reviewedAt ? "Retirer du portail client" : "Valider et restituer au client"}
              </Button>
              <span className="text-xs text-ink2">
                {reviewedAt
                  ? "Visible par le client."
                  : "Non visible par le client tant qu'elle n'est pas relue."}
              </span>
            </div>
          )}

          {canReview && <AnalysisGuidelines open={open} documentVersionId={documentVersionId ?? null} />}

          {error && (
            <p role="alert" className="flex items-center gap-1.5 text-xs text-rouge-imp">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}

          {/* Mention non négociable : EODA est en conseil/préparation, jamais en
              évaluateur officiel (CLAUDE.md §1). Une analyse automatique présentée
              sans réserve serait lue comme un verdict de conformité HAS. */}
          <p className="text-xs text-ink2 border-t border-gris-light pt-2">
            Analyse automatique produite à l&apos;appui de la préparation. Elle ne vaut
            pas évaluation HAS et ne remplace pas l&apos;appréciation de votre
            consultant.
          </p>
        </div>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  entries,
}: {
  icon: React.ReactNode;
  title: string;
  entries: string[];
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-medium text-brun-ancre mb-1">
        {icon}
        {title}
      </p>
      <ul className="space-y-1 pl-5">
        {entries.map((entry) => (
          <li key={entry} className="text-xs text-ink2 list-disc marker:text-gris-light">
            {entry}
          </li>
        ))}
      </ul>
    </div>
  );
}

// « Toujours apporter la justification 'source' » (Damon, 15/09/2026) : un élément
// retrouvé sans citation vérifiable n'est qu'une affirmation du modèle. Une source
// vide reste possible (analyses stockées avant cette date, ou un modèle qui n'a pas
// respecté la consigne malgré normalizeFindings) — dans ce cas, on ne l'invente pas,
// on ne montre simplement pas de citation pour cette entrée.
function FindingsSection({
  icon,
  title,
  findings,
}: {
  icon: React.ReactNode;
  title: string;
  findings: AnalysisFinding[];
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-medium text-brun-ancre mb-1">
        {icon}
        {title}
      </p>
      <ul className="space-y-1.5 pl-5">
        {findings.map((finding, index) => (
          <li key={`${finding.text}-${index}`} className="text-xs text-ink2 list-disc marker:text-gris-light">
            {finding.text}
            {finding.source && (
              <blockquote className="mt-0.5 border-l-2 border-gris-light pl-2 italic text-sm text-ink2">
                « {finding.source} »
              </blockquote>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
