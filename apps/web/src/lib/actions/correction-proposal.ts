"use server";

import { prisma } from "@eoda/database";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { openCorrectionContext, readCriterionLabels, type CorrectionContext } from "./correction-context";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { canDepositDocuments } from "@/lib/services/mission-access-service";
import { CORRECTION_NOT_INCLUDED_MESSAGE } from "@/lib/services/offer-scope-service";
import { generateCorrectedDraft } from "@/lib/services/document-generation-service";
import { ingestDocumentVersion } from "@/lib/services/document-ingestion-service";
import { generateBrandedDocx, type CoverPageInput, type DocxBrand } from "@/lib/services/markdown-to-docx-service";
import { buildCoverPage, prepareFinalDocumentMarkdown } from "@/lib/services/final-document-service";
import { readBrandColors } from "@/lib/services/brand-color-service";
import { decodeLogoDataUri } from "@/lib/services/logo-response-service";
import { readEodaLogoPng } from "@/lib/services/eoda-logo-asset";
import { documentMention } from "@/lib/services/review-mention-service";
import { buildEodaFileName } from "@/lib/services/document-naming-service";
import { documentIdentityRule } from "@/lib/services/document-identity-service";
import {
  additionsOf,
  buildDecisionsRecord,
  countDecisions,
  parseDecisions,
  proposalToMarkdown,
  readDecisionsRecord,
  splitParagraphs,
  type ProposalDecision,
} from "@/lib/services/correction-proposal-service";
import { readStoredProposal, type CorrectionProposal } from "@/lib/llm/correction-proposal";
import { getLLMAnalysisPort, isKnownLlmModelId } from "@/lib/llm";
import { getFileStoragePort } from "@/lib/storage";
import { buildFinalDocx } from "@/lib/services/final-docx-builder";
import { nodeInflateRaw } from "@/lib/services/node-inflate";

// ─────────────────────────────────────────────────────────────────────────────
// METTRE EN CONFORMITÉ CÔTE À CÔTE — actions (tranche N8).
//
// Cabinet : toujours (dans son tenant). Structure : en autonomie, si l'offre
// comprend la génération de ce document (correctionRight, D13) — règle unique dans
// correction-context. Générer et enregistrer sont des ÉCRITURES : fermées après la
// clôture. « Enregistrer la version N+1 » crée une nouvelle DocumentVersion (origine
// cabinet ou structure selon l'auteur), liée à l'originale qui est conservée, et fige
// les décisions ajout par ajout sur la proposition.
// ─────────────────────────────────────────────────────────────────────────────

const DOCX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type CorrectionWorkspace = {
  context: Pick<CorrectionContext, "mode"> & { isClient: boolean; version: CorrectionContext["version"] };
  originalParagraphs: string[];
  proposal: {
    id: string;
    generatedAt: Date;
    content: CorrectionProposal;
    applied: { versionId: string; decisions: Record<string, ProposalDecision> } | null;
  } | null;
  criterionLabels: Record<string, string>;
  mention: string | null;
  canGenerate: boolean;
  generateBlockedReason: string | null;
  canSave: boolean;
};

export async function getCorrectionWorkspace(versionId: string): Promise<CorrectionWorkspace> {
  const context = await openCorrectionContext(versionId);
  const latest = await prisma.correctionProposal.findFirst({
    where: { sourceVersionId: context.version.id },
    orderBy: { generatedAt: "desc" },
    select: { id: true, generatedAt: true, proposalJson: true, resultVersionId: true, decisionsJson: true },
  });
  const content = latest ? readStoredProposal(latest.proposalJson) : null;
  const codes = content ? additionsOf(content).flatMap((a) => (a.criterionCode ? [a.criterionCode] : [])) : [];
  const labels = await readCriterionLabels(codes);

  const writable = canDepositDocuments(context.access.missionAccess);
  const generateBlockedReason = !writable
    ? "L'accompagnement est terminé : plus de nouvelle version."
    : !context.right.included
      ? CORRECTION_NOT_INCLUDED_MESSAGE
      : !context.hasAnalysis || !context.version.extractedText
        ? "Ce document doit d'abord être analysé."
        : null;

  return {
    context: { mode: context.mode, isClient: context.access.isClient, version: context.version },
    originalParagraphs: splitParagraphs(context.version.extractedText),
    proposal:
      latest && content
        ? {
            id: latest.id,
            generatedAt: latest.generatedAt,
            content,
            applied: latest.resultVersionId
              ? { versionId: latest.resultVersionId, decisions: Object.fromEntries(readDecisionsRecord(latest.decisionsJson)) }
              : null,
          }
        : null,
    criterionLabels: Object.fromEntries(labels),
    // Une proposition n'est relue par personne : en autonomie, la réserve complète.
    mention: documentMention({ mode: context.mode, reviewedAt: null }),
    canGenerate: generateBlockedReason === null,
    generateBlockedReason,
    canSave: writable && context.version.isCurrent,
  };
}

function revalidateCorrection(context: CorrectionContext): void {
  revalidatePath("/dashboard/client/documents");
  revalidatePath(`/dashboard/client/documents/conformite/${context.version.id}`);
  revalidatePath(`/dashboard/cabinet/conformite/${context.version.id}`);
  revalidatePath(`/dashboard/cabinet/etablissements/${context.version.establishmentId}`);
}

export async function generateCorrectionProposal(
  documentVersionId: string,
  modelId?: string | null
): Promise<{ error: string } | null> {
  const context = await openCorrectionContext(documentVersionId);
  if (!canDepositDocuments(context.access.missionAccess)) {
    return { error: "L'accompagnement est terminé : plus de nouvelle version." };
  }
  // Le DROIT de générer, vérifié AVANT l'appel payant au modèle (D13).
  if (!context.right.included) return { error: CORRECTION_NOT_INCLUDED_MESSAGE };

  const validatedModelId = modelId && isKnownLlmModelId(modelId) ? modelId : null;
  const result = await generateCorrectedDraft(context.version.id, getLLMAnalysisPort(), validatedModelId, context.access.userId);
  if ("error" in result) return { error: result.error };

  await recordAuditEvent({
    action: "CORRECTED_DRAFT_GENERATED",
    actorUserId: context.access.userId,
    actorRole: context.access.session.user.role,
    establishmentId: context.version.establishmentId,
    targetId: context.version.id,
    detail: context.version.documentCode,
  });
  revalidateCorrection(context);
  return null;
}

// Habillage du document FINAL (call du 09/11/2026) : la page de garde EODA (E2) liste
// les critères de la MATRICE du type — jamais ce que le modèle a écrit —, le corps
// porte le logo et les couleurs de la structure (E1). Lus ici, et pas dans le
// contexte de l'écran : le logo pèse jusqu'à 300 Ko et ne sert qu'à l'enregistrement.
async function readFinalDocumentDress(
  context: CorrectionContext
): Promise<{ coverPage: CoverPageInput; brand: DocxBrand; structureModelKey: string | null }> {
  const [links, establishment, eodaLogo, design] = await Promise.all([
    prisma.documentTypeCriterion.findMany({
      where: { documentTypeId: context.version.documentTypeId },
      select: { criterion: { select: { code: true, label: true } } },
    }),
    prisma.establishment.findUnique({
      where: { id: context.version.establishmentId },
      select: { logoDataUri: true, brandPrimaryColor: true, brandSecondaryColor: true },
    }),
    readEodaLogoPng(),
    prisma.establishmentDocumentDesign.findUnique({
      where: { establishmentId: context.version.establishmentId },
      select: { modelFileKey: true },
    }),
  ]);
  const logo = decodeLogoDataUri(establishment?.logoDataUri ?? null);
  return {
    coverPage: {
      ...buildCoverPage({
        documentLabel: context.version.documentLabel,
        establishmentName: context.version.establishmentName,
        criteria: links.map((link) => link.criterion),
      }),
      eodaLogo,
    },
    brand: {
      colors: establishment ? readBrandColors(establishment) : null,
      logo: logo ? { data: logo.bytes, type: logo.type === "image/png" ? "png" : "jpg" } : null,
    },
    structureModelKey: design?.modelFileKey ?? null,
  };
}

export async function applyCorrectionProposal(
  proposalId: string,
  rawDecisions: unknown
): Promise<{ error: string } | { ok: true; versionNumber: number }> {
  if (typeof proposalId !== "string") notFound();
  const stored = await prisma.correctionProposal.findUnique({
    where: { id: proposalId },
    select: { id: true, sourceVersionId: true, proposalJson: true, resultVersionId: true },
  });
  if (!stored) notFound();
  const context = await openCorrectionContext(stored.sourceVersionId);

  if (!canDepositDocuments(context.access.missionAccess)) {
    return { error: "L'accompagnement est terminé : plus de nouvelle version." };
  }
  if (stored.resultVersionId) return { error: "Cette proposition a déjà été enregistrée comme nouvelle version." };
  if (!context.version.isCurrent) {
    return { error: "Une version plus récente de ce document a été déposée : relancez la mise en conformité sur celle-ci." };
  }
  const proposal = readStoredProposal(stored.proposalJson);
  if (!proposal) return { error: "Cette proposition est illisible : relancez la mise en conformité." };
  const parsed = parseDecisions(rawDecisions, proposal);
  if (!parsed.ok) return { error: parsed.error };

  const now = new Date();
  // Document FINAL (call du 09/11/2026) : encarts « critères HAS » retirés du corps
  // (E2), version suivante et date du jour écrites par la PLATEFORME (E3) — jamais par
  // l'IA. Une fiche de sensibilisation garde sa date de dépôt (E4, provisoire).
  const { markdown, identity } = prepareFinalDocumentMarkdown(proposalToMarkdown(proposal, parsed.decisions), {
    identityRule: documentIdentityRule({ code: context.version.documentCode, folderId: context.version.documentFolderId }),
    previousVersionLabel: String(context.version.versionNumber),
    today: now,
  });
  const nextNumber = context.version.versionNumber + 1;
  const { coverPage, brand, structureModelKey } = await readFinalDocumentDress(context);
  const reviewMention = documentMention({ mode: context.mode, reviewedAt: null });
  // Le design du CLIENT (11/11/2026) : son Word d'origine, sinon le modèle de mise en page
  // de la structure ; le rendu EODA seulement en dernier recours.
  const { docx } = await buildFinalDocx({
    candidates: [
      { key: context.version.fileStorageKey, source: "SOURCE" },
      ...(structureModelKey ? [{ key: structureModelKey, source: "STRUCTURE_MODEL" as const }] : []),
    ],
    storage: getFileStoragePort(),
    inflateRaw: nodeInflateRaw,
    transplant: { markdown, cover: coverPage, reviewMention },
    branded: () =>
      generateBrandedDocx({
        markdown,
        title: context.version.documentLabel,
        establishmentName: context.version.establishmentName,
        reviewMention,
        coverPage,
        brand,
      }),
  });
  const originalFilename = buildEodaFileName({
    issuedOn: now,
    type: context.version.documentCode,
    clientName: context.version.establishmentName,
    objet: "Mise-en-conformite",
    version: nextNumber,
    audience: "Externe",
    extension: "docx",
  });

  const ingested = await ingestDocumentVersion(
    {
      establishmentId: context.version.establishmentId,
      documentTypeId: context.version.documentTypeId,
      documentTypeLabel: context.version.documentLabel,
      documentTypeCode: context.version.documentCode,
      content: docx,
      contentType: DOCX_CONTENT_TYPE,
      originalFilename,
      uploadedByUserId: context.access.userId,
      documentOrigin: context.access.isClient ? "CLIENT" : "CABINET",
      extractedText: markdown,
      regeneratedFromVersionId: context.version.id,
    },
    { storage: getFileStoragePort(), llm: getLLMAnalysisPort() }
  );

  await prisma.correctionProposal.update({
    where: { id: stored.id },
    data: {
      resultVersionId: ingested.documentVersionId,
      decisionsJson: buildDecisionsRecord(parsed.decisions, now),
      appliedAt: now,
      appliedById: context.access.userId,
    },
  });

  const counts = countDecisions(proposal, parsed.decisions);
  await recordAuditEvent({
    action: "CORRECTION_PROPOSAL_APPLIED",
    actorUserId: context.access.userId,
    actorRole: context.access.session.user.role,
    establishmentId: context.version.establishmentId,
    targetId: ingested.documentVersionId,
    detail: `${context.version.documentCode} v${nextNumber} : ${counts.accepted} accepté(s), ${counts.refused} refusé(s), ${counts.pending} non retenu(s)${identity ? ` ; version du document ${identity.version}` : ""}`,
  });
  revalidateCorrection(context);
  return { ok: true, versionNumber: nextNumber };
}
