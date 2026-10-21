"use server";

import { prisma } from "@eoda/database";
import { revalidatePath, revalidateTag } from "next/cache";
import { CRITERION_MATRIX_TAG } from "@/lib/db/referential-cache";
import { notFound } from "next/navigation";
import { requireCabinetAdminSession } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { PROPOSED_MATRIX_CSV } from "@/content/criteres/matrice-proposition";
import {
  buildMatrixView,
  describeMatrixDecision,
  pairKey,
  parseProposedMatrix,
  planFullProposalLoad,
  planMatrixDecision,
  promotionError,
  type MatrixView,
} from "@/lib/services/criterion-matrix-service";

// ─────────────────────────────────────────────────────────────────────────────
// MATRICE TYPE DE DOCUMENT → CRITÈRE — écran d'administration (tranche N4, spec 04).
// CABINET_ADMIN uniquement : la matrice est une configuration de cabinet qui gouverne
// l'analyse, les guidelines et « critères & preuves » de toutes les structures.
// ─────────────────────────────────────────────────────────────────────────────

const MATRIX_PATH = "/dashboard/cabinet/criteres";

export type PromotableSuggestion = {
  suggestionId: string;
  documentTypeCode: string;
  documentTypeLabel: string;
  criterionCode: string;
  criterionLabel: string;
};

export type MatrixReview = MatrixView & { promotable: PromotableSuggestion[] };

async function loadLinkedPairs(): Promise<Set<string>> {
  const links = await prisma.documentTypeCriterion.findMany({
    select: { documentType: { select: { code: true } }, criterion: { select: { code: true } } },
  });
  return new Set(links.map((l) => pairKey(l.documentType.code, l.criterion.code)));
}

export async function getMatrixReview(): Promise<MatrixReview> {
  const { tenantId } = await requireCabinetAdminSession();

  const [criteria, documentTypes, linkedPairs, confirmed] = await Promise.all([
    prisma.criterion.findMany({ select: { code: true, label: true } }),
    prisma.documentType.findMany({ select: { code: true, label: true } }),
    loadLinkedPairs(),
    // Suggestions confirmées des structures DE CE CABINET seulement (cloisonnement).
    prisma.documentCriterionSuggestion.findMany({
      where: { status: "CONFIRMED", document: { establishment: { tenantId }, documentTypeId: { not: null } } },
      select: {
        id: true,
        criterion: { select: { code: true, label: true } },
        document: { select: { documentType: { select: { code: true, label: true } } } },
      },
      orderBy: { reviewedAt: "desc" },
    }),
  ]);

  const view = buildMatrixView(parseProposedMatrix(PROPOSED_MATRIX_CSV), {
    criterionLabels: new Map(criteria.map((c) => [c.code, c.label])),
    documentTypeLabels: new Map(documentTypes.map((t) => [t.code, t.label])),
    linkedPairs,
  });

  // Une ligne par couple (type, critère) pas encore rattaché — plusieurs documents
  // peuvent avoir confirmé le même critère.
  const seen = new Set<string>();
  const promotable = confirmed.flatMap((s): PromotableSuggestion[] => {
    const type = s.document.documentType;
    if (!type) return [];
    const key = pairKey(type.code, s.criterion.code);
    if (linkedPairs.has(key) || seen.has(key)) return [];
    seen.add(key);
    return [
      {
        suggestionId: s.id,
        documentTypeCode: type.code,
        documentTypeLabel: type.label,
        criterionCode: s.criterion.code,
        criterionLabel: s.criterion.label,
      },
    ];
  });

  return { ...view, promotable };
}

// Validation d'UN type de document : les cases cochées (entrée non fiable) sont
// recalculées contre la proposition et le référentiel en base.
export async function validateMatrixForDocumentType(formData: FormData): Promise<{ error: string } | null> {
  const { userId, session } = await requireCabinetAdminSession();

  const typeCode = formData.get("documentTypeCode");
  if (typeof typeCode !== "string" || typeCode.length === 0) return { error: "Type de document manquant." };
  const checked = formData.getAll("criterionCode").filter((v): v is string => typeof v === "string");

  const documentType = await prisma.documentType.findUnique({ where: { code: typeCode }, select: { id: true } });
  if (!documentType) notFound();

  const proposedCodes = parseProposedMatrix(PROPOSED_MATRIX_CSV)
    .filter((r) => r.documentTypeCode === typeCode)
    .map((r) => r.criterionCode);
  // Seuls les critères proposés ET présents en base sont décidables.
  const criteria = await prisma.criterion.findMany({
    where: { code: { in: proposedCodes } },
    select: { id: true, code: true },
  });
  const idByCode = new Map(criteria.map((c) => [c.code, c.id]));
  const linked = await prisma.documentTypeCriterion.findMany({
    where: { documentTypeId: documentType.id },
    select: { criterion: { select: { code: true } } },
  });

  const decision = planMatrixDecision({
    proposedCriterionCodes: [...idByCode.keys()],
    checkedCriterionCodes: checked,
    linkedCriterionCodes: new Set(linked.map((l) => l.criterion.code)),
  });

  const toId = (code: string): string[] => {
    const id = idByCode.get(code);
    return id ? [id] : [];
  };
  await prisma.$transaction([
    prisma.documentTypeCriterion.createMany({
      data: decision.toCreate.flatMap(toId).map((criterionId) => ({ documentTypeId: documentType.id, criterionId })),
      skipDuplicates: true,
    }),
    prisma.documentTypeCriterion.deleteMany({
      where: { documentTypeId: documentType.id, criterionId: { in: decision.toDelete.flatMap(toId) } },
    }),
  ]);

  await recordAuditEvent({
    action: "DOCUMENT_TYPE_CRITERIA_UPDATED",
    actorUserId: userId,
    actorRole: session.user.role,
    targetId: documentType.id,
    detail: describeMatrixDecision(typeCode, decision),
  });

  revalidatePath(MATRIX_PATH);
  revalidateTag(CRITERION_MATRIX_TAG);
  return null;
}

// « Charger toute la proposition » (décision de Damon, 21/10/2026) — CABINET_ADMIN
// seul. Ajoute, n'enlève rien ; le plan est recalculé ici depuis la proposition
// embarquée et la base, aucune entrée du formulaire n'est lue.
export async function loadFullProposedMatrix(): Promise<{ error: string } | { added: number; alreadyLinked: number; skipped: number }> {
  const { userId, session } = await requireCabinetAdminSession();

  const [criteria, documentTypes, linkedPairs] = await Promise.all([
    prisma.criterion.findMany({ select: { id: true, code: true } }),
    prisma.documentType.findMany({ select: { id: true, code: true } }),
    loadLinkedPairs(),
  ]);
  const plan = planFullProposalLoad(parseProposedMatrix(PROPOSED_MATRIX_CSV), {
    documentTypeIds: new Map(documentTypes.map((t) => [t.code, t.id])),
    criterionIds: new Map(criteria.map((c) => [c.code, c.id])),
    linkedPairs,
  });

  const created =
    plan.toCreate.length === 0
      ? { count: 0 }
      : await prisma.documentTypeCriterion.createMany({ data: plan.toCreate, skipDuplicates: true });

  await recordAuditEvent({
    action: "DOCUMENT_TYPE_CRITERIA_UPDATED",
    actorUserId: userId,
    actorRole: session.user.role,
    detail: `proposition complète · +${created.count}`,
  });

  revalidatePath(MATRIX_PATH);
  revalidateTag(CRITERION_MATRIX_TAG);
  return { added: created.count, alreadyLinked: plan.alreadyLinked, skipped: plan.skipped };
}

// « Ajouter à la matrice » une suggestion confirmée sur un document d'une structure.
export async function promoteCriterionSuggestion(formData: FormData): Promise<{ error: string } | null> {
  const { userId, tenantId, session } = await requireCabinetAdminSession();

  const suggestionId = formData.get("suggestionId");
  if (typeof suggestionId !== "string" || suggestionId.length === 0) return { error: "Suggestion manquante." };

  // IDOR : la suggestion doit appartenir à une structure du cabinet de l'appelant.
  const suggestion = await prisma.documentCriterionSuggestion.findFirst({
    where: { id: suggestionId, document: { establishment: { tenantId } } },
    select: {
      id: true,
      status: true,
      criterionId: true,
      criterion: { select: { code: true } },
      document: { select: { documentTypeId: true, documentType: { select: { code: true } } } },
    },
  });
  if (!suggestion) notFound();

  const documentTypeId = suggestion.document.documentTypeId;
  const alreadyLinked =
    documentTypeId !== null &&
    (await prisma.documentTypeCriterion.findUnique({
      where: { documentTypeId_criterionId: { documentTypeId, criterionId: suggestion.criterionId } },
      select: { criterionId: true },
    })) !== null;
  const error = promotionError({ status: suggestion.status, documentTypeId, alreadyLinked });
  if (error || documentTypeId === null) return { error: error ?? "Ce document n'a pas de type." };

  await prisma.documentTypeCriterion.create({
    data: { documentTypeId, criterionId: suggestion.criterionId },
  });

  await recordAuditEvent({
    action: "DOCUMENT_TYPE_CRITERION_PROMOTED",
    actorUserId: userId,
    actorRole: session.user.role,
    targetId: suggestion.id,
    detail: `${suggestion.document.documentType?.code ?? "?"} · ${suggestion.criterion.code}`,
  });

  revalidatePath(MATRIX_PATH);
  revalidateTag(CRITERION_MATRIX_TAG);
  return null;
}
