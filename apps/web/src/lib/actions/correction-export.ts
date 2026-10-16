import { prisma } from "@eoda/database";
import { notFound } from "next/navigation";
import { openCorrectionContext, readCriterionLabels } from "./correction-context";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { documentMention } from "@/lib/services/review-mention-service";
import { buildEodaFileName } from "@/lib/services/document-naming-service";
import { additionsOf, buildChangeReport, readDecisionsRecord } from "@/lib/services/correction-proposal-service";
import {
  buildAnnotatedPlan,
  generateAnnotatedDocx,
  generateChangeReportDocx,
} from "@/lib/services/annotated-docx-service";
import { readStoredProposal } from "@/lib/llm/correction-proposal";

// Les deux exports Word d'une proposition (N8) : le document ANNOTÉ et le RAPPORT DES
// CHANGEMENTS. Même contexte que l'écran (correction-context : garde + règle d'usage),
// accès journalisé, nom de fichier à la convention EODA. Avant enregistrement, l'annoté
// montre toute la proposition ; après, les ajouts acceptés seulement.

export type DocxExport = { buffer: Buffer; fileName: string };

async function loadExport(proposalId: string) {
  const stored = await prisma.correctionProposal.findUnique({
    where: { id: proposalId },
    select: { id: true, sourceVersionId: true, proposalJson: true, resultVersionId: true, decisionsJson: true },
  });
  if (!stored) notFound();
  const context = await openCorrectionContext(stored.sourceVersionId);
  const proposal = readStoredProposal(stored.proposalJson);
  if (!proposal) notFound();
  const decisions = stored.resultVersionId ? readDecisionsRecord(stored.decisionsJson) : undefined;
  const labels = await readCriterionLabels(additionsOf(proposal).flatMap((a) => (a.criterionCode ? [a.criterionCode] : [])));
  const versionNumber = context.version.versionNumber + 1;
  return { stored, context, proposal, decisions, labels, versionNumber };
}

export async function exportAnnotatedDocx(proposalId: string): Promise<DocxExport> {
  const { stored, context, proposal, decisions, labels, versionNumber } = await loadExport(proposalId);
  const buffer = await generateAnnotatedDocx({
    title: context.version.documentLabel,
    establishmentName: context.version.establishmentName,
    plan: buildAnnotatedPlan(proposal, {
      ...(decisions && { decisions }),
      labels,
      mention: documentMention({ mode: context.mode, reviewedAt: null }),
    }),
  });
  await recordAuditEvent({
    action: "CORRECTION_PROPOSAL_EXPORTED",
    actorUserId: context.access.userId,
    actorRole: context.access.session.user.role,
    establishmentId: context.version.establishmentId,
    targetId: stored.id,
    detail: context.version.documentCode,
  });
  const fileName = buildEodaFileName({
    issuedOn: new Date(),
    type: context.version.documentCode,
    clientName: context.version.establishmentName,
    objet: "Mise-en-conformite-annotee",
    version: versionNumber,
    audience: "Externe",
    extension: "docx",
  });
  return { buffer, fileName };
}

export async function exportChangeReportDocx(proposalId: string): Promise<DocxExport> {
  const { stored, context, proposal, decisions, labels, versionNumber } = await loadExport(proposalId);
  const buffer = await generateChangeReportDocx({
    documentLabel: context.version.documentLabel,
    establishmentName: context.version.establishmentName,
    versionCaption: decisions
      ? `Version ${context.version.versionNumber} → version ${versionNumber}.`
      : `Proposition sur la version ${context.version.versionNumber}, pas encore enregistrée.`,
    mention: documentMention({ mode: context.mode, reviewedAt: null }),
    rows: buildChangeReport(proposal, decisions ?? new Map(), labels),
  });
  await recordAuditEvent({
    action: "CHANGE_REPORT_DOWNLOADED",
    actorUserId: context.access.userId,
    actorRole: context.access.session.user.role,
    establishmentId: context.version.establishmentId,
    targetId: stored.id,
    detail: context.version.documentCode,
  });
  const fileName = buildEodaFileName({
    issuedOn: new Date(),
    type: context.version.documentCode,
    clientName: context.version.establishmentName,
    objet: "Rapport-des-changements",
    version: versionNumber,
    audience: "Externe",
    extension: "docx",
  });
  return { buffer, fileName };
}
