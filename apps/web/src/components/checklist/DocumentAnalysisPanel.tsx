"use client";

import { useEffect, useState, useTransition } from "react";
import {
  ChevronDown,
  AlertCircle,
  Lightbulb,
  Check,
  Sparkles,
  Eye,
  EyeOff,
  Loader2,
  MessageSquarePlus,
  CheckCircle2,
} from "lucide-react";
import type { DocumentAnalysisResult, AnalysisFinding } from "@/lib/llm";
import { describeAnalysis, summariseAnalysis } from "@/lib/services/analysis-view-service";
import {
  setAnalysisReviewed,
  listCriteriaForPicker,
  addCriterionGuideline,
  listCriterionGuidelines,
  setCriterionGuidelineAiUse,
  type CriterionOption,
  type CriterionGuidelineItem,
} from "@/lib/actions/document";
import { MAX_GUIDELINE_LENGTH } from "@/lib/services/criterion-guideline-service";
import { formatDate } from "@/lib/services/date-format-service";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CriterionSuggestionsList } from "@/components/checklist/CriterionSuggestionsList";
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

      {open && (
        <div className="px-3 pb-3 pt-1 space-y-3 animate-fade-in">
          {analysis.criteriaCoverage.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-xs font-medium text-brun-ancre mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-accent-text" aria-hidden="true" />
                Couverture par critère HAS
              </p>
              <ul className="space-y-1 pl-5">
                {analysis.criteriaCoverage.map((c) => (
                  <li key={c.criterionCode} className="text-xs list-disc marker:text-gris-light">
                    <span className="font-medium text-brun-ancre">{c.criterionCode}</span>
                    {" — "}
                    <span
                      className={
                        c.status === "couvert"
                          ? "text-ok-text"
                          : c.status === "partiel"
                            ? "text-amber-text"
                            : "text-rouge-imp"
                      }
                    >
                      {c.status}
                    </span>
                    {" : "}
                    <span className="text-ink2">{c.note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

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

          {canReview && <AnalysisGuidelines open={open} />}

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

// « Que la base de connaissance apprenne des commentaires que mettra Sandrine lors
// des analyses, pour ne pas refaire les mêmes erreurs » (Damon, 10/09/2026), ANCRÉES
// SUR LE CRITÈRE HAS — cf. CriterionGuideline dans le schéma. Rappelée à toute
// analyse future d'un document rattaché à ce critère, quel que soit l'établissement.
//
// La consultante choisit elle-même le critère. Une guideline est relue pour tout
// document dont le TYPE est rattaché au critère (matrice) ou dont l'analyse a reconnu
// ce critère (suggestion non rejetée) — et seulement si elle est « prise en compte par
// l'IA » (call du 18/10/2026 : oui ou non, case à cocher, chaque bascule journalisée).
//
// Chargement paresseux : la liste des critères et les guidelines existantes ne sont
// demandées que si ce panneau est ouvert (P2/P3).
function AnalysisGuidelines({ open }: { open: boolean }) {
  const [criteria, setCriteria] = useState<CriterionOption[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [criterionId, setCriterionId] = useState("");
  const [existing, setExisting] = useState<CriterionGuidelineItem[] | null>(null);
  const [note, setNote] = useState("");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || criteria !== null) return;
    startTransition(async () => {
      const result = await listCriteriaForPicker();
      setCriteria(result ?? []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleCriterionChange(value: string) {
    setCriterionId(value);
    setExisting(null);
    setSaved(false);
    if (!value) return;
    startTransition(async () => {
      const result = await listCriterionGuidelines(value);
      setExisting(result ?? []);
    });
  }

  function handleSubmit() {
    const trimmed = note.trim();
    if (!criterionId || trimmed.length === 0) return;
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await addCriterionGuideline(criterionId, trimmed, aiEnabled);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      setNote("");
      setSaved(true);
      const refreshed = await listCriterionGuidelines(criterionId);
      setExisting(refreshed ?? []);
    });
  }

  function handleToggleAi(guidelineId: string, enabled: boolean) {
    setError(null);
    // Réponse immédiate à l'écran ; l'état serveur est relu ensuite.
    setExisting((list) => list?.map((g) => (g.id === guidelineId ? { ...g, aiEnabled: enabled } : g)) ?? null);
    startTransition(async () => {
      const result = await setCriterionGuidelineAiUse(guidelineId, enabled);
      if (result && "error" in result) setError(result.error);
      const refreshed = await listCriterionGuidelines(criterionId);
      setExisting(refreshed ?? []);
    });
  }

  return (
    <div className="space-y-2 border-t border-gris-light pt-2">
      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-xs text-accent-text hover:underline"
        >
          <MessageSquarePlus className="w-3.5 h-3.5" aria-hidden="true" />
          Ajouter une guideline sur un critère HAS
        </button>
      ) : (
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-brun-ancre">Critère concerné</label>
          <select
            value={criterionId}
            onChange={(e) => handleCriterionChange(e.target.value)}
            disabled={isPending || criteria === null}
            className="w-full rounded-md border border-gris-light bg-surface px-2 py-1.5 text-xs text-brun-ancre"
          >
            <option value="">— Sélectionner un critère —</option>
            {criteria?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.label.slice(0, 80)}
              </option>
            ))}
          </select>

          {existing && existing.length > 0 && (
            <ul className="space-y-1.5">
              {existing.map((g) => (
                <li key={g.id} className="rounded-md bg-surface/70 px-2 py-1.5 text-xs text-brun-ancre">
                  <p className={cn(!g.aiEnabled && "text-ink2")}>{g.note}</p>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-ink2">
                      {g.createdByName} · {formatDate(g.createdAt)}
                    </p>
                    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={g.aiEnabled}
                        disabled={isPending}
                        onChange={(e) => handleToggleAi(g.id, e.target.checked)}
                        className="h-4 w-4 accent-current"
                      />
                      Pris en compte par l&apos;IA
                    </label>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <label className="block text-xs font-medium text-brun-ancre">
            Aide-mémoire court — une phrase, pas un paragraphe
          </label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={MAX_GUIDELINE_LENGTH}
            disabled={isPending || !criterionId}
            className="text-xs"
            placeholder="ex : vérifier aussi la date de révision annuelle du règlement."
          />
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={aiEnabled}
              disabled={isPending || !criterionId}
              onChange={(e) => setAiEnabled(e.target.checked)}
              className="h-4 w-4 accent-current"
            />
            Faire prendre en compte par l&apos;IA dans les prochaines analyses
          </label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isPending || !criterionId || note.trim().length === 0}
              onClick={handleSubmit}
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <MessageSquarePlus className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              Enregistrer
            </Button>
            <button
              type="button"
              className="text-xs text-ink2 hover:underline"
              onClick={() => {
                setShowForm(false);
                setNote("");
                setCriterionId("");
                setExisting(null);
              }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {saved && (
        <p role="status" className="flex items-center gap-1.5 text-xs text-ok-text">
          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
          Guideline enregistrée — reprise dans les prochaines analyses des documents qui répondent à ce critère, tant
          qu&apos;elle est prise en compte par l&apos;IA. « Réanalyser » l&apos;applique tout de suite.
        </p>
      )}

      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-rouge-imp">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
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
