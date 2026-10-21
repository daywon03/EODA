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
  X,
} from "lucide-react";
import type { DocumentAnalysisResult, AnalysisFinding } from "@/lib/llm";
import { describeAnalysis, splitCriteriaCoverage, summariseAnalysis } from "@/lib/services/analysis-view-service";
import {
  setAnalysisReviewed,
  listCriteriaForPicker,
  addCriterionGuidelines,
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
import { AnalyzeDocumentButton } from "@/components/checklist/AnalyzeDocumentButton";
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
function AnalysisGuidelines({ open, documentVersionId }: { open: boolean; documentVersionId: string | null }) {
  const [criteria, setCriteria] = useState<CriterionOption[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  // Plusieurs critères à la fois (21/10/2026) : on coche, on écrit UNE note, on
  // enregistre UNE fois, puis on relance l'analyse.
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [existing, setExisting] = useState<CriterionGuidelineItem[] | null>(null);
  const [note, setNote] = useState("");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [saved, setSaved] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || criteria !== null) return;
    startTransition(async () => {
      // Déjà dans l'ordre NUMÉRIQUE (listCriteriaForPicker).
      const result = await listCriteriaForPicker();
      setCriteria(result ?? []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Les guidelines existantes se montrent quand UN critère est coché : sur plusieurs,
  // la liste mélangerait des critères différents.
  const single = selected.size === 1 ? [...selected][0]! : null;
  useEffect(() => {
    setExisting(null);
    if (!single) return;
    let cancelled = false;
    void listCriterionGuidelines(single).then((result) => {
      if (!cancelled) setExisting(result ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [single]);

  function toggle(id: string) {
    setSaved(null);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit() {
    const trimmed = note.trim();
    if (selected.size === 0 || trimmed.length === 0) return;
    setError(null);
    setSaved(null);
    startTransition(async () => {
      const result = await addCriterionGuidelines([...selected], trimmed, aiEnabled);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setNote("");
      setSaved(result.saved);
      if (single) setExisting((await listCriterionGuidelines(single)) ?? []);
    });
  }

  function handleToggleAi(guidelineId: string, enabled: boolean) {
    setError(null);
    // Réponse immédiate à l'écran ; l'état serveur est relu ensuite.
    setExisting((list) => list?.map((g) => (g.id === guidelineId ? { ...g, aiEnabled: enabled } : g)) ?? null);
    startTransition(async () => {
      const result = await setCriterionGuidelineAiUse(guidelineId, enabled);
      if (result && "error" in result) setError(result.error);
      if (single) setExisting((await listCriterionGuidelines(single)) ?? []);
    });
  }

  // Les critères cochés, rappelés au-dessus de la liste dans l'ordre numérique : on voit
  // ce qui sera enregistré sans faire défiler la liste (21/10/2026).
  const chosen = (criteria ?? []).filter((c) => selected.has(c.id));

  const needle = filter.trim().toLowerCase();
  const visible = (criteria ?? []).filter(
    (c) => needle.length === 0 || c.code.startsWith(needle) || c.label.toLowerCase().includes(needle)
  );

  return (
    <div className="space-y-2 border-t border-gris-light pt-2">
      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex min-h-11 items-center gap-1.5 text-xs text-accent-text hover:underline"
        >
          <MessageSquarePlus className="w-3.5 h-3.5" aria-hidden="true" />
          Ajouter une guideline sur des critères HAS
        </button>
      ) : (
        <div className="space-y-2">
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-medium text-brun-ancre">
              Critères concernés — cochez-en un ou plusieurs ({selected.size} coché{selected.size > 1 ? "s" : ""})
            </legend>
            {chosen.length > 0 && (
              <ul aria-label="Critères cochés" className="flex flex-wrap gap-1.5">
                {chosen.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => toggle(c.id)}
                      disabled={isPending}
                      aria-label={`Retirer le critère ${c.code}`}
                      className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line bg-card px-3 text-sm font-bold tabular-nums text-ink hover:bg-soft"
                    >
                      {c.code}
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrer : 3.12 ou « plaintes »"
              aria-label="Filtrer les critères"
              className="h-11 w-full rounded-md border border-gris-light bg-surface px-2 text-xs text-brun-ancre"
            />
            <ul className="max-h-60 space-y-0.5 overflow-y-auto rounded-md border border-gris-light bg-surface p-1">
              {criteria === null && <li className="px-2 py-1.5 text-xs text-ink2">Chargement des critères…</li>}
              {visible.map((c) => (
                <li key={c.id}>
                  <label className="flex min-h-11 cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-xs text-brun-ancre hover:bg-soft">
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      disabled={isPending}
                      onChange={() => toggle(c.id)}
                      className="mt-0.5 h-4 w-4 flex-shrink-0 accent-current"
                    />
                    <span>
                      <span className="font-bold tabular-nums">{c.code}</span> {c.label}
                      {c.requirementLevel === "IMPERATIF" && <span className="ml-1 font-bold text-accent-text">▲</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

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
            onChange={(e) => {
              setNote(e.target.value);
              setSaved(null);
            }}
            rows={2}
            maxLength={MAX_GUIDELINE_LENGTH}
            disabled={isPending || selected.size === 0}
            className="text-xs"
            placeholder="ex : vérifier aussi la date de révision annuelle du règlement."
          />
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={aiEnabled}
              disabled={isPending || selected.size === 0}
              onChange={(e) => setAiEnabled(e.target.checked)}
              className="h-4 w-4 accent-current"
            />
            Faire prendre en compte par l&apos;IA dans les prochaines analyses
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isPending || selected.size === 0 || note.trim().length === 0}
              onClick={handleSubmit}
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <MessageSquarePlus className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              Enregistrer{selected.size > 1 ? ` sur ${selected.size} critères` : ""}
            </Button>
            <button
              type="button"
              className="min-h-11 text-xs text-ink2 hover:underline"
              onClick={() => {
                setShowForm(false);
                setNote("");
                setSelected(new Set());
                setExisting(null);
              }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {saved !== null && (
        <div className="space-y-2 rounded-md border border-line bg-card p-2">
          <p role="status" className="flex items-center gap-1.5 text-xs text-ok-text">
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
            Guideline enregistrée sur {saved} critère{saved > 1 ? "s" : ""}. Relancez l&apos;analyse pour
            qu&apos;elle soit prise en compte maintenant.
          </p>
          {/* Enregistrer PUIS analyser (21/10/2026) : le bouton vient juste après
              l'enregistrement, jamais avant — une analyse lancée avant ne lirait pas
              la guideline. */}
          {documentVersionId && <AnalyzeDocumentButton documentVersionId={documentVersionId} hasAnalysis />}
        </div>
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
