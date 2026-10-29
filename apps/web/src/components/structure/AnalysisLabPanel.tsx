"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { AlertCircle, Check, Copy, FlaskConical, Loader2, ThumbsDown, ThumbsUp } from "lucide-react";
import {
  judgeAnalysisTrial,
  listAnalysisTrials,
  previewAnalysisPrompt,
  runAnalysisTrial,
  type AnalysisPromptPreview,
  type AnalysisTrialRow,
  type OfficialAnalysisFacts,
} from "@/lib/actions/analysis-lab";
import { ANALYSIS_PROMPT_CHOICES, DEFAULT_ANALYSIS_PROMPT_VARIANT } from "@/lib/llm/analysis-prompt-choices";
import { DEFAULT_LLM_MODEL_ID, LLM_MODEL_OPTIONS } from "@/lib/llm/openrouter-models";
import { ANALYSIS_VERDICT_LABELS, type AnalysisSummary } from "@/lib/services/analysis-lab-service";
import { formatDate } from "@/lib/services/date-format-service";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DocumentAnalysisPanel } from "@/components/checklist/DocumentAnalysisPanel";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// LABORATOIRE D'ANALYSE — panneau du document, CABINET seul (29/10/2026).
//
// « Voir le prompt » montre la consigne et le message EXACTS envoyés au modèle ;
// « Lancer un essai » analyse ce document avec la version choisie SANS toucher à son
// analyse officielle ; la consultante juge chaque essai (bon / à revoir + note).
// Replié par défaut : c'est un outil de mise au point, pas le quotidien du panneau.
// ─────────────────────────────────────────────────────────────────────────────

function SummaryLine({ summary }: { summary: AnalysisSummary | null }) {
  if (!summary) return <span className="text-ink2">résultat illisible</span>;
  return (
    <span className="tabular-nums">
      {summary.present} trouvé{summary.present > 1 ? "s" : ""} · {summary.missing} manquant{summary.missing > 1 ? "s" : ""} · critères :{" "}
      {summary.covered} couvert{summary.covered > 1 ? "s" : ""}, {summary.partial} partiel{summary.partial > 1 ? "s" : ""}, {summary.absent} absent
      {summary.absent > 1 ? "s" : ""} · {summary.extraCriteria} en plus
      {summary.natureMismatch && " · nature différente du type"}
    </span>
  );
}

function TrialVerdict({ trial, onJudged }: { trial: AnalysisTrialRow; onJudged: () => void }) {
  const [note, setNote] = useState(trial.verdictNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function judge(verdict: "BON" | "A_REVOIR") {
    setError(null);
    startTransition(async () => {
      const result = await judgeAnalysisTrial(trial.id, verdict, note);
      if (result) setError(result.error);
      else onJudged();
    });
  }

  return (
    <div className="space-y-2">
      {trial.verdict && (
        <p className="text-sm font-bold text-ink">
          Verdict : {ANALYSIS_VERDICT_LABELS[trial.verdict]}
          {trial.judgedByName && <span className="font-normal text-ink2"> — {trial.judgedByName}</span>}
          {trial.judgedAt && <span className="font-normal text-ink2">, le {formatDate(trial.judgedAt)}</span>}
        </p>
      )}
      <label className="block space-y-1">
        <span className="text-sm font-bold text-ink">Ce qui est juste ou faux dans cet essai (facultatif)</span>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} disabled={isPending} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant={trial.verdict === "BON" ? "default" : "outline"} onClick={() => judge("BON")} disabled={isPending}>
          <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
          Bon
        </Button>
        <Button type="button" size="sm" variant={trial.verdict === "A_REVOIR" ? "default" : "outline"} onClick={() => judge("A_REVOIR")} disabled={isPending}>
          <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />À revoir
        </Button>
      </div>
      {error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-rouge-imp">
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

function PromptView({ preview }: { preview: AnalysisPromptPreview }) {
  const [copied, setCopied] = useState(false);
  const full = `### CONSIGNE SYSTÈME\n\n${preview.system}\n\n### MESSAGE\n\n${preview.user}`;
  return (
    <div className="space-y-2 rounded-lg border border-line bg-soft p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink">
          <strong>{preview.variantLabel}</strong> · envoyé à {preview.provider}, modèle <strong>{preview.model}</strong> ·{" "}
          {full.length.toLocaleString("fr-FR")} caractères
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard?.writeText(full).then(() => setCopied(true));
          }}
        >
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
          {copied ? "Copié" : "Copier le prompt"}
        </Button>
      </div>
      <details open>
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-ink">Consigne système</summary>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded border border-line bg-card p-3 text-sm text-ink">{preview.system}</pre>
      </details>
      <details>
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-ink">Message (contexte et texte du document, anonymisé)</summary>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded border border-line bg-card p-3 text-sm text-ink">{preview.user}</pre>
      </details>
    </div>
  );
}

export function AnalysisLabPanel({ documentVersionId }: { documentVersionId: string }) {
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState<string>(DEFAULT_ANALYSIS_PROMPT_VARIANT);
  const [modelId, setModelId] = useState(DEFAULT_LLM_MODEL_ID);
  const [preview, setPreview] = useState<AnalysisPromptPreview | null>(null);
  const [data, setData] = useState<{ official: OfficialAnalysisFacts; trials: AnalysisTrialRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"preview" | "trial" | null>(null);

  const reload = useCallback(() => {
    void listAnalysisTrials(documentVersionId).then(setData);
  }, [documentVersionId]);

  useEffect(() => {
    if (open && data === null) reload();
  }, [open, data, reload]);

  async function showPrompt() {
    setError(null);
    setBusy("preview");
    const result = await previewAnalysisPrompt(documentVersionId, variant, modelId);
    setBusy(null);
    if ("error" in result) setError(result.error);
    else setPreview(result);
  }

  async function runTrial() {
    setError(null);
    setBusy("trial");
    const result = await runAnalysisTrial(documentVersionId, variant, modelId);
    setBusy(null);
    if ("error" in result) setError(result.error);
    else reload();
  }

  const choice = ANALYSIS_PROMPT_CHOICES.find((c) => c.id === variant);

  return (
    <details className="group rounded-xl border border-line bg-card" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 py-2 font-bold text-ink">
        <FlaskConical className="h-4 w-4" aria-hidden="true" />
        Laboratoire d&apos;analyse
        <span className="font-normal text-ink2">· voir le prompt, essayer une autre version</span>
      </summary>
      <div className="space-y-4 border-t border-line px-4 py-4">
        <p className="text-sm text-ink2">
          Un essai n&apos;écrase pas l&apos;analyse du document et n&apos;est jamais montré à la structure. Jugez chaque essai : vos
          verdicts décident de la version de prompt retenue pour tous.
        </p>

        {data && (
          <p className="text-sm text-ink">
            Analyse actuelle : <strong>{data.official.promptLabel}</strong>
            {data.official.model && <> · {data.official.model}</>}
            {data.official.analyzedAt && <> · le {formatDate(data.official.analyzedAt)}</>}
            <br />
            <SummaryLine summary={data.official.summary} />
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-bold text-ink">Version du prompt</span>
            <Select value={variant} onChange={(e) => setVariant(e.target.value)} disabled={busy !== null}>
              {ANALYSIS_PROMPT_CHOICES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} (v{c.version})
                </option>
              ))}
            </Select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-bold text-ink">Modèle</span>
            <Select value={modelId} onChange={(e) => setModelId(e.target.value)} disabled={busy !== null}>
              {LLM_MODEL_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
        </div>
        {choice && <p className="text-sm text-ink2">{choice.description}</p>}

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => void showPrompt()} disabled={busy !== null}>
            {busy === "preview" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            Voir le prompt envoyé
          </Button>
          <Button type="button" size="sm" onClick={() => void runTrial()} disabled={busy !== null}>
            {busy === "trial" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />}
            {busy === "trial" ? "Essai en cours (jusqu'à une minute)…" : "Lancer un essai"}
          </Button>
        </div>
        {error && (
          <p role="alert" className="flex items-center gap-1 text-sm text-rouge-imp">
            <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
        {preview && <PromptView preview={preview} />}

        {data && data.trials.length > 0 && (
          <section aria-label="Essais" className="space-y-3">
            <h3 className="font-bold text-ink">Essais ({data.trials.length})</h3>
            <ul className="space-y-3">
              {data.trials.map((trial) => (
                <li key={trial.id} className={cn("space-y-3 rounded-lg border p-3", trial.verdict === "BON" ? "border-ok-text" : "border-line")}>
                  <p className="text-sm text-ink">
                    <strong>{trial.promptLabel}</strong> · {trial.model} · le {formatDate(trial.createdAt)}
                    {trial.createdByName && <span className="text-ink2"> par {trial.createdByName}</span>}
                    <br />
                    <SummaryLine summary={trial.summary} />
                  </p>
                  {trial.analysis && (
                    <>
                      <DocumentAnalysisPanel analysis={trial.analysis} />
                      {trial.analysis.criteresSupplementaires.length > 0 && (
                        <div className="text-sm text-ink">
                          <p className="font-bold">Critères proposés en plus</p>
                          <ul className="list-disc pl-5">
                            {trial.analysis.criteresSupplementaires.map((c) => (
                              <li key={c.criterionCode}>
                                <span className="font-bold tabular-nums">{c.criterionCode}</span> — {c.justification}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                  <TrialVerdict trial={trial} onJudged={reload} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </details>
  );
}
