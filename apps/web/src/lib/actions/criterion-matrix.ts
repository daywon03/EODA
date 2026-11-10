"use server";

import { prisma } from "@eoda/database";
import { revalidatePath, revalidateTag } from "next/cache";
import { CRITERION_MATRIX_TAG } from "@/lib/db/referential-cache";
import { notFound } from "next/navigation";
import { requireCabinetAdminSession, requireCabinetSession } from "@/lib/auth/guards";
import { OPEN_CONTENT_DOCUMENT_WHERE } from "@/lib/auth/document-file-access";
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
  manualUnlinkError,
  describeCriterionUnlink,
  MAX_MANUAL_LINKS,
  planManualLinks,
  type MatrixView,
} from "@/lib/services/criterion-matrix-service";
import { compareCriterionCodes } from "@/lib/services/criterion-picker-service";
import { unknownCriteriaMessage } from "@/lib/services/criterion-code-message";

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

export type MatrixReview = MatrixView & {
  promotable: PromotableSuggestion[];
  // Tous les types de la base, par libellé : le rattachement à la main en a besoin.
  documentTypes: { code: string; label: string }[];
};

// Un type ARCHIVÉ (ligne retirée de la liste, 09/11/2026) ne se rattache plus à rien :
// il répond comme un type inconnu.
async function findActiveDocumentType(code: string): Promise<{ id: string } | null> {
  if (typeof code !== "string" || code.length === 0) return null;
  const documentType = await prisma.documentType.findUnique({ where: { code }, select: { id: true, archivedAt: true } });
  return documentType && !documentType.archivedAt ? { id: documentType.id } : null;
}

async function loadLinkedPairs(): Promise<Set<string>> {
  const links = await prisma.documentTypeCriterion.findMany({
    select: { documentType: { select: { code: true } }, criterion: { select: { code: true } } },
  });
  return new Set(links.map((l) => pairKey(l.documentType.code, l.criterion.code)));
}

// Couples proposés que l'administration a refusés (10/11/2026) : ni pré-cochés sur la
// carte du type, ni recréés par « Charger toute la proposition ».
async function loadRefusedPairs(): Promise<Set<string>> {
  const refusals = await prisma.proposedCriterionRefusal.findMany({
    select: { documentType: { select: { code: true } }, criterion: { select: { code: true } } },
  });
  return new Set(refusals.map((r) => pairKey(r.documentType.code, r.criterion.code)));
}

export async function getMatrixReview(): Promise<MatrixReview> {
  const { tenantId } = await requireCabinetAdminSession();

  const [criteria, documentTypes, linkedPairs, refusedPairs, confirmed] = await Promise.all([
    prisma.criterion.findMany({ select: { code: true, label: true } }),
    prisma.documentType.findMany({ where: { archivedAt: null }, select: { code: true, label: true } }),
    loadLinkedPairs(),
    loadRefusedPairs(),
    // Suggestions confirmées des structures DE CE CABINET seulement (cloisonnement).
    prisma.documentCriterionSuggestion.findMany({
      where: {
        status: "CONFIRMED",
        // Jamais un critère reconnu dans un document à accès restreint (ADR 20261110).
        document: { establishment: { tenantId }, documentTypeId: { not: null }, ...OPEN_CONTENT_DOCUMENT_WHERE },
      },
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
    refusedPairs,
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

  return {
    ...view,
    promotable,
    documentTypes: documentTypes
      .map((t) => ({ code: t.code, label: t.label }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr", { sensitivity: "base" })),
  };
}

// Validation d'UN type de document : les cases cochées (entrée non fiable) sont
// recalculées contre la proposition et le référentiel en base.
export async function validateMatrixForDocumentType(formData: FormData): Promise<{ error: string } | null> {
  const { userId, session } = await requireCabinetAdminSession();

  const typeCode = formData.get("documentTypeCode");
  if (typeof typeCode !== "string" || typeCode.length === 0) return { error: "Type de document manquant." };
  const checked = formData.getAll("criterionCode").filter((v): v is string => typeof v === "string");

  const documentType = await findActiveDocumentType(typeCode);
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
    // Le refus se mémorise : « Charger toute la proposition » ne le défera plus.
    prisma.proposedCriterionRefusal.createMany({
      data: decision.toDelete.flatMap(toId).map((criterionId) => ({ documentTypeId: documentType.id, criterionId })),
      skipDuplicates: true,
    }),
    prisma.proposedCriterionRefusal.deleteMany({
      where: { documentTypeId: documentType.id, criterionId: { in: decision.toCreate.flatMap(toId) } },
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
export async function loadFullProposedMatrix(): Promise<
  { error: string } | { added: number; alreadyLinked: number; skipped: number; refused: number }
> {
  const { userId, session } = await requireCabinetAdminSession();

  const [criteria, documentTypes, linkedPairs, refusedPairs] = await Promise.all([
    prisma.criterion.findMany({ select: { id: true, code: true } }),
    prisma.documentType.findMany({ where: { archivedAt: null }, select: { id: true, code: true } }),
    loadLinkedPairs(),
    loadRefusedPairs(),
  ]);
  const plan = planFullProposalLoad(parseProposedMatrix(PROPOSED_MATRIX_CSV), {
    documentTypeIds: new Map(documentTypes.map((t) => [t.code, t.id])),
    criterionIds: new Map(criteria.map((c) => [c.code, c.id])),
    linkedPairs,
    refusedPairs,
  });

  const created =
    plan.toCreate.length === 0
      ? { count: 0 }
      : await prisma.documentTypeCriterion.createMany({ data: plan.toCreate, skipDuplicates: true });

  await recordAuditEvent({
    action: "DOCUMENT_TYPE_CRITERIA_UPDATED",
    actorUserId: userId,
    actorRole: session.user.role,
    detail: `proposition complète · +${created.count} · refusés gardés ${plan.refused}`,
  });

  revalidatePath(MATRIX_PATH);
  revalidateTag(CRITERION_MATRIX_TAG);
  return { added: created.count, alreadyLinked: plan.alreadyLinked, skipped: plan.skipped, refused: plan.refused };
}

// « Ajouter à la matrice » une suggestion confirmée sur un document d'une structure.
export async function promoteCriterionSuggestion(formData: FormData): Promise<{ error: string } | null> {
  const { userId, tenantId, session } = await requireCabinetAdminSession();

  const suggestionId = formData.get("suggestionId");
  if (typeof suggestionId !== "string" || suggestionId.length === 0) return { error: "Suggestion manquante." };

  // IDOR : la suggestion doit appartenir à une structure du cabinet de l'appelant.
  const suggestion = await prisma.documentCriterionSuggestion.findFirst({
    where: { id: suggestionId, document: { establishment: { tenantId }, ...OPEN_CONTENT_DOCUMENT_WHERE } },
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
  // Rattaché de nouveau : un ancien refus de ce couple ne vaut plus.
  await prisma.proposedCriterionRefusal.deleteMany({
    where: { documentTypeId, criterionId: { in: [suggestion.criterionId] } },
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

// ── Rattachement à la main (call du 21/10/2026) ─────────────────────────────

// `criterionId` : les consignes pour l'IA se posent sur le critère (CriterionGuideline).
export type DocumentTypeLink = { criterionId: string; code: string; label: string; proposed: boolean };

function proposedCodesFor(typeCode: string): Set<string> {
  return new Set(
    parseProposedMatrix(PROPOSED_MATRIX_CSV)
      .filter((r) => r.documentTypeCode === typeCode)
      .map((r) => r.criterionCode)
  );
}

// Les critères rattachés à UN type, dans l'ordre numérique, avec leur provenance.
// Lisible par tout le cabinet qui lit les structures (onglet « Critères HAS » de la
// fiche document, 09/11/2026) : la matrice est une configuration du cabinet, sans
// donnée de structure. L'écrire reste réservé à l'administration.
export async function getDocumentTypeLinks(typeCode: string): Promise<DocumentTypeLink[]> {
  await requireCabinetSession("STRUCTURES_READ");
  const documentType = await findActiveDocumentType(typeCode);
  if (!documentType) notFound();
  const links = await prisma.documentTypeCriterion.findMany({
    where: { documentTypeId: documentType.id },
    select: { criterion: { select: { id: true, code: true, label: true } } },
  });
  const proposed = proposedCodesFor(typeCode);
  return links
    .map((l) => ({
      criterionId: l.criterion.id,
      code: l.criterion.code,
      label: l.criterion.label,
      proposed: proposed.has(l.criterion.code),
    }))
    .sort((a, b) => compareCriterionCodes(a.code, b.code));
}

// Les lignes de « Documents » auxquelles rattacher un critère, par intitulé (page
// Critères d'une structure : « Rattacher un document existant à ce critère »).
export async function listLinkableDocumentTypes(): Promise<{ id: string; code: string; label: string }[]> {
  await requireCabinetAdminSession();
  const types = await prisma.documentType.findMany({ where: { archivedAt: null }, select: { id: true, code: true, label: true } });
  return types
    .map((t) => ({ id: t.id, code: t.code, label: t.label }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr", { sensitivity: "base" }));
}

export async function addManualMatrixLinks(
  typeCode: string,
  criterionCodes: string[]
): Promise<{ error: string } | { added: number; alreadyLinked: number }> {
  const { userId, session } = await requireCabinetAdminSession();
  const requested = Array.isArray(criterionCodes) ? criterionCodes.filter((c): c is string => typeof c === "string") : [];
  if (requested.length === 0) return { error: "Cochez au moins un critère." };
  if (requested.length > MAX_MANUAL_LINKS) return { error: `Au plus ${MAX_MANUAL_LINKS} critères à la fois.` };

  const documentType = await findActiveDocumentType(typeCode);
  if (!documentType) notFound();

  const [criteria, linked] = await Promise.all([
    prisma.criterion.findMany({ where: { code: { in: requested } }, select: { id: true, code: true } }),
    prisma.documentTypeCriterion.findMany({
      where: { documentTypeId: documentType.id },
      select: { criterion: { select: { code: true } } },
    }),
  ]);
  const plan = planManualLinks({
    requestedCriterionCodes: requested,
    knownCriterionCodes: new Set(criteria.map((c) => c.code)),
    linkedCriterionCodes: new Set(linked.map((l) => l.criterion.code)),
  });
  if (plan.unknown.length > 0) return { error: unknownCriteriaMessage(plan.unknown) };

  const idByCode = new Map(criteria.map((c) => [c.code, c.id]));
  const toCreateIds = plan.toCreate.flatMap((code) => {
    const criterionId = idByCode.get(code);
    return criterionId ? [criterionId] : [];
  });
  const created =
    toCreateIds.length === 0
      ? { count: 0 }
      : await prisma.documentTypeCriterion.createMany({
          data: toCreateIds.map((criterionId) => ({ documentTypeId: documentType.id, criterionId })),
          skipDuplicates: true,
        });
  // Rattachés de nouveau : leurs anciens refus ne valent plus.
  if (toCreateIds.length > 0) {
    await prisma.proposedCriterionRefusal.deleteMany({
      where: { documentTypeId: documentType.id, criterionId: { in: toCreateIds } },
    });
  }

  // Codes seulement : ni libellé libre, ni donnée de structure.
  await recordAuditEvent({
    action: "DOCUMENT_TYPE_CRITERIA_UPDATED",
    actorUserId: userId,
    actorRole: session.user.role,
    targetId: documentType.id,
    detail: `${typeCode} · ajout manuel +${created.count} (${plan.toCreate.join(", ")})`,
  });

  revalidatePath(MATRIX_PATH);
  revalidateTag(CRITERION_MATRIX_TAG);
  return { added: created.count, alreadyLinked: plan.alreadyLinked.length };
}

// Décocher un critère, depuis la fiche document, la matrice ou la page Critères d'une
// structure (retours de Sandrine, 09/11/2026). UNE action, qui choisit l'écriture :
//   - critère PROPOSÉ pour ce type : décocher = le refuser — la même suppression que
//     la carte du type (planMatrixDecision), journalisée « proposition refusée » ;
//   - critère ajouté à la main : retrait, journalisé « retrait manuel ».
// CABINET_ADMIN seul (la matrice vaut pour toutes les structures). Codes reçus = entrée
// non fiable : type archivé ou inconnu, critère inconnu → notFound.
export async function unlinkCriterionFromDocumentType(
  typeCode: string,
  criterionCode: string
): Promise<{ error: string } | null> {
  const { userId, session } = await requireCabinetAdminSession();
  if (typeof criterionCode !== "string" || criterionCode.length === 0) notFound();
  const [documentType, criterion] = await Promise.all([
    findActiveDocumentType(typeCode),
    prisma.criterion.findUnique({ where: { code: criterionCode }, select: { id: true } }),
  ]);
  if (!documentType || !criterion) notFound();

  const key = { documentTypeId_criterionId: { documentTypeId: documentType.id, criterionId: criterion.id } };
  const link = await prisma.documentTypeCriterion.findUnique({ where: key, select: { criterionId: true } });
  const error = manualUnlinkError({ linked: link !== null });
  if (error) return { error };

  const isProposed = proposedCodesFor(typeCode).has(criterionCode);
  if (isProposed) {
    // Décocher un critère PROPOSÉ = le refuser, et s'en souvenir (10/11/2026) :
    // « Charger toute la proposition » ne le remettra plus.
    const pair = { documentTypeId: documentType.id, criterionId: criterion.id };
    await prisma.$transaction([
      prisma.documentTypeCriterion.delete({ where: key }),
      prisma.proposedCriterionRefusal.upsert({ where: { documentTypeId_criterionId: pair }, create: pair, update: {} }),
    ]);
  } else {
    await prisma.documentTypeCriterion.delete({ where: key });
  }
  await recordAuditEvent({
    action: "DOCUMENT_TYPE_CRITERIA_UPDATED",
    actorUserId: userId,
    actorRole: session.user.role,
    targetId: documentType.id,
    detail: describeCriterionUnlink(typeCode, criterionCode, isProposed),
  });

  revalidatePath(MATRIX_PATH);
  revalidateTag(CRITERION_MATRIX_TAG);
  return null;
}
