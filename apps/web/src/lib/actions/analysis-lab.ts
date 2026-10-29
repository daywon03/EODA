"use server";

import { prisma } from "@eoda/database";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCabinetSession, requireEstablishmentAccess, structureScopeWhere } from "@/lib/auth/guards";
import { NEED, type EstablishmentNeed } from "@/lib/auth/capabilities";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { consumeThrottledAttempt } from "@/lib/security/attempt-throttle";
import { getLLMAnalysisPort, isKnownLlmModelId } from "@/lib/llm";
import {
  analysisPromptVariant,
  DEFAULT_ANALYSIS_PROMPT_VARIANT,
  describeAnalysisPrompt,
  isAnalysisPromptVariantId,
  type AnalysisPromptVariantId,
} from "@/lib/llm/analysis-prompt-variants";
import { prepareAnalysisInput, readAnalysisTarget } from "@/lib/services/document-ingestion-service";
import { parseAnalysisResult } from "@/lib/services/analysis-view-service";
import {
  normalizeVerdictNote,
  parseVerdict,
  summarizeAnalysis,
  tallyByVariant,
  type AnalysisSummary,
  type VariantTally,
} from "@/lib/services/analysis-lab-service";
import type { DocumentAnalysisResult } from "@/lib/llm/llm-analysis-port";
import type { AnalysisVerdict } from "@eoda/database";

// ─────────────────────────────────────────────────────────────────────────────
// LABORATOIRE D'ANALYSE (demande de Damon, 29/10/2026) — CABINET seul.
//
//  - « Voir le prompt » : la consigne et le message EXACTS que le modèle reçoit pour
//    cette version de document (même assemblage que l'analyse officielle :
//    `prepareAnalysisInput` + `describeAnalysisCall` de l'adaptateur), sans l'appeler ;
//  - « Essai » : une version du prompt lancée SANS toucher à l'analyse officielle —
//    ni statut, ni suggestions de critères, ni rien de ce que voit la structure ;
//  - « Verdict » : la consultante juge l'essai (bon / à revoir + note).
//
// La version de document est une entrée non fiable : l'établissement est relu par
// elle, puis `requireEstablishmentAccess` (périmètre de la consultante compris) ; un
// compte client reçoit notFound(). Chaque essai est un appel payant au modèle : débit
// borné par personne.
// ─────────────────────────────────────────────────────────────────────────────

const TRIAL_RATE_LIMIT = { limit: 30, windowSeconds: 60 * 60 } as const;

async function requireLab(documentVersionId: unknown, need: EstablishmentNeed) {
  if (typeof documentVersionId !== "string" || documentVersionId.length === 0) notFound();
  const version = await prisma.documentVersion.findUnique({
    where: { id: documentVersionId },
    select: { document: { select: { establishmentId: true, establishment: { select: { tenantId: true } } } } },
  });
  if (!version) notFound();
  const access = await requireEstablishmentAccess(version.document.establishmentId, need);
  if (access.isClient) notFound();
  return { access, establishmentId: version.document.establishmentId, tenantId: version.document.establishment.tenantId };
}

function chosenVariant(value: unknown): AnalysisPromptVariantId {
  return isAnalysisPromptVariantId(value) ? value : DEFAULT_ANALYSIS_PROMPT_VARIANT;
}

function chosenModel(value: unknown): string | null {
  return typeof value === "string" && isKnownLlmModelId(value) ? value : null;
}

async function prepare(documentVersionId: string, variant: AnalysisPromptVariantId, modelId: string | null) {
  const loaded = await readAnalysisTarget(documentVersionId);
  if (!loaded) notFound();
  if (!loaded.target.extractedText) {
    return { error: "Le texte de ce document n'a pas encore été extrait : lancez d'abord une analyse." } as const;
  }
  const { input } = await prepareAnalysisInput({ ...loaded.target, promptVariant: variant, ...(modelId && { modelId }) });
  return { input } as const;
}

export type AnalysisPromptPreview = {
  variantLabel: string;
  provider: string;
  model: string;
  system: string;
  user: string;
};

export async function previewAnalysisPrompt(
  documentVersionId: string,
  variantId: string,
  modelId: string | null
): Promise<AnalysisPromptPreview | { error: string }> {
  const { access, establishmentId } = await requireLab(documentVersionId, NEED.DOCUMENTS_READ);
  const variant = chosenVariant(variantId);
  const prepared = await prepare(documentVersionId, variant, chosenModel(modelId));
  if ("error" in prepared) return { error: prepared.error };
  const call = getLLMAnalysisPort().describeAnalysisCall(prepared.input);

  // Le prompt contient le texte du document : le consulter est un accès au document.
  await recordAuditEvent({
    action: "ANALYSIS_PROMPT_VIEWED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId,
    targetId: documentVersionId,
    detail: `prompt ${variant}`,
  });
  return { variantLabel: describeAnalysisPrompt(variant, analysisPromptVariant(variant).version), ...call };
}

export async function runAnalysisTrial(
  documentVersionId: string,
  variantId: string,
  modelId: string | null
): Promise<{ trialId: string } | { error: string }> {
  const { access, establishmentId, tenantId } = await requireLab(documentVersionId, NEED.DOCUMENTS_WRITE);
  const allowed = await consumeThrottledAttempt({
    key: `analysis-trial:${access.userId}`,
    policy: TRIAL_RATE_LIMIT,
    auditAction: "ANALYSIS_TRIAL_RUN",
    actorUserId: access.userId,
  });
  if (!allowed) return { error: "Trop d'essais en peu de temps (30 par heure). Réessayez plus tard." };

  const variant = analysisPromptVariant(chosenVariant(variantId));
  const prepared = await prepare(documentVersionId, variant.id, chosenModel(modelId));
  if ("error" in prepared) return { error: prepared.error };

  const llm = getLLMAnalysisPort();
  const call = llm.describeAnalysisCall(prepared.input);
  let result: DocumentAnalysisResult;
  try {
    result = await llm.analyze(prepared.input);
  } catch (error) {
    console.error("Essai d'analyse échoué :", error instanceof Error ? error.message : "erreur inconnue");
    return { error: "L'essai a échoué (le modèle n'a pas répondu correctement). Réessayez ou changez de modèle." };
  }

  const trial = await prisma.analysisTrial.create({
    data: {
      tenantId,
      documentVersionId,
      promptVariant: variant.id,
      promptVersion: variant.version,
      model: call.model,
      resultJson: result as unknown as object,
      createdByUserId: access.userId,
    },
    select: { id: true },
  });

  await recordAuditEvent({
    action: "ANALYSIS_TRIAL_RUN",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId,
    targetId: trial.id,
    detail: `prompt ${variant.id} v${variant.version} · ${call.model}`,
  });
  return { trialId: trial.id };
}

export type AnalysisTrialRow = {
  id: string;
  promptLabel: string;
  model: string;
  createdAt: Date;
  createdByName: string | null;
  analysis: DocumentAnalysisResult | null;
  summary: AnalysisSummary | null;
  verdict: AnalysisVerdict | null;
  verdictNote: string | null;
  judgedByName: string | null;
  judgedAt: Date | null;
};

export type OfficialAnalysisFacts = { promptLabel: string; model: string | null; analyzedAt: Date | null; summary: AnalysisSummary | null };

export async function listAnalysisTrials(
  documentVersionId: string
): Promise<{ official: OfficialAnalysisFacts; trials: AnalysisTrialRow[] }> {
  await requireLab(documentVersionId, NEED.DOCUMENTS_READ);
  const [version, trials] = await Promise.all([
    prisma.documentVersion.findUnique({
      where: { id: documentVersionId },
      select: { analysisResultJson: true, analysisPromptVariant: true, analysisPromptVersion: true, analysisModel: true, analyzedAt: true },
    }),
    prisma.analysisTrial.findMany({
      where: { documentVersionId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        promptVariant: true,
        promptVersion: true,
        model: true,
        resultJson: true,
        createdAt: true,
        verdict: true,
        verdictNote: true,
        judgedAt: true,
        createdBy: { select: { name: true } },
        judgedBy: { select: { name: true } },
      },
    }),
  ]);
  const officialAnalysis = parseAnalysisResult(version?.analysisResultJson ?? null);
  return {
    official: {
      promptLabel: describeAnalysisPrompt(version?.analysisPromptVariant ?? null, version?.analysisPromptVersion ?? null),
      model: version?.analysisModel ?? null,
      analyzedAt: version?.analyzedAt ?? null,
      summary: officialAnalysis && summarizeAnalysis(officialAnalysis),
    },
    trials: trials.map((trial) => {
      const analysis = parseAnalysisResult(trial.resultJson);
      return {
        id: trial.id,
        promptLabel: describeAnalysisPrompt(trial.promptVariant, trial.promptVersion),
        model: trial.model,
        createdAt: trial.createdAt,
        createdByName: trial.createdBy?.name ?? null,
        analysis,
        summary: analysis && summarizeAnalysis(analysis),
        verdict: trial.verdict,
        verdictNote: trial.verdictNote,
        judgedByName: trial.judgedBy?.name ?? null,
        judgedAt: trial.judgedAt,
      };
    }),
  };
}

export async function judgeAnalysisTrial(trialId: string, verdictValue: string, noteValue: string | null): Promise<{ error: string } | null> {
  if (typeof trialId !== "string" || trialId.length === 0) notFound();
  const trial = await prisma.analysisTrial.findUnique({ where: { id: trialId }, select: { id: true, documentVersionId: true } });
  if (!trial) notFound();
  const { access, establishmentId } = await requireLab(trial.documentVersionId, NEED.DOCUMENTS_WRITE);

  const verdict = parseVerdict(verdictValue);
  if (!verdict) return { error: "Choisissez « Bon » ou « À revoir »." };
  const note = normalizeVerdictNote(noteValue);
  if (note !== null && typeof note === "object") return { error: note.error };

  await prisma.analysisTrial.update({
    where: { id: trial.id },
    data: { verdict, verdictNote: note, judgedByUserId: access.userId, judgedAt: new Date() },
  });
  // Jamais le texte de la note au journal : il peut citer le document.
  await recordAuditEvent({
    action: "ANALYSIS_TRIAL_JUDGED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId,
    targetId: trial.id,
    detail: verdict,
  });
  revalidatePath("/dashboard/cabinet/laboratoire");
  return null;
}

// Bilan de tous les essais du cabinet, par version de prompt — ce qui permet de
// choisir la version par défaut sur des faits. Borné au périmètre de l'appelant (une
// consultante ne voit que les essais de ses structures).
export type LabOverviewRow = {
  id: string;
  promptLabel: string;
  model: string;
  createdAt: Date;
  establishmentName: string;
  documentLabel: string;
  verdict: AnalysisVerdict | null;
  verdictNote: string | null;
};

export async function getAnalysisLabOverview(): Promise<{ tallies: (VariantTally & { label: string })[]; rows: LabOverviewRow[] }> {
  const context = await requireCabinetSession("STRUCTURES_READ");
  const trials = await prisma.analysisTrial.findMany({
    where: { tenantId: context.tenantId, documentVersion: { document: { establishment: structureScopeWhere(context) } } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      promptVariant: true,
      promptVersion: true,
      model: true,
      createdAt: true,
      verdict: true,
      verdictNote: true,
      documentVersion: { select: { document: { select: { establishment: { select: { name: true } }, documentType: { select: { label: true } } } } } },
    },
  });
  return {
    tallies: tallyByVariant(trials).map((tally) => ({
      ...tally,
      label: isAnalysisPromptVariantId(tally.variant) ? analysisPromptVariant(tally.variant).label : tally.variant,
    })),
    rows: trials.map((trial) => ({
      id: trial.id,
      promptLabel: describeAnalysisPrompt(trial.promptVariant, trial.promptVersion),
      model: trial.model,
      createdAt: trial.createdAt,
      establishmentName: trial.documentVersion.document.establishment.name,
      documentLabel: trial.documentVersion.document.documentType?.label ?? "Document",
      verdict: trial.verdict,
      verdictNote: trial.verdictNote,
    })),
  };
}
