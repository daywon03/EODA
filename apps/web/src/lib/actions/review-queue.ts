"use server";

import { prisma, Prisma } from "@eoda/database";
import { notFound } from "next/navigation";
import { requireCabinetSession } from "@/lib/auth/guards";
import { parseAnalysisResult } from "@/lib/services/analysis-view-service";
import { isCriterionImperativeForEstablishment } from "@/lib/services/criterion-imperativeness-service";
import {
  buildReviewProposals,
  countProposals,
  sortReviewQueue,
  toReviewQueueItem,
  type ReviewProposals,
  type ReviewQueueItem,
} from "@/lib/services/review-queue-service";

// ─────────────────────────────────────────────────────────────────────────────
// FILE « À RELIRE » — lecture côté cabinet (règles : review-queue-service.ts).
//
// Le tenant vient de la garde, jamais d'un paramètre, et le filtre n'est pas
// conditionnel : sans tenant, requireCabinetSession() a déjà refusé (fail-closed).
// Lecture seule : les gestes (critères, « Marquer relu ») passent par les actions
// existantes — criterion-suggestion.ts et setAnalysisReviewed — qui gardent leur
// propre garde et journalisent. L'ouverture du FICHIER passe par
// getDocumentPreviewData, qui journalise l'accès.
// ─────────────────────────────────────────────────────────────────────────────

// Au-delà, la page dit combien d'éléments ne sont pas affichés plutôt que de tout
// charger : la file se vide en relisant, pas en défilant.
const REVIEW_QUEUE_LIMIT = 200;

// Identifiant cuid : une chaîne courte. Tout le reste est refusé avant la base.
const MAX_ID_LENGTH = 64;

function awaitingReviewWhere(tenantId: string): Prisma.DocumentVersionWhereInput {
  return {
    analysisResultJson: { not: Prisma.AnyNull },
    analysisReviewedAt: null,
    currentForDocument: { isNot: null },
    document: { establishment: { tenantId } },
  };
}

// Sert la pastille de la barre latérale, rendue à chaque page : un `count`, pas
// la liste.
export async function countDocumentsAwaitingReview(): Promise<number> {
  const { tenantId } = await requireCabinetSession();
  return prisma.documentVersion.count({ where: awaitingReviewWhere(tenantId) });
}

// Même file, regroupée par structure (accueil, liste des structures). Une requête
// groupée sur les DOCUMENTS dont la version courante attend : un document n'a
// qu'une version courante, donc le compte est le même que celui de la file.
export async function countDocumentsAwaitingReviewByEstablishment(): Promise<Map<string, number>> {
  const { tenantId } = await requireCabinetSession();
  const groups = await prisma.document.groupBy({
    by: ["establishmentId"],
    where: {
      establishment: { tenantId },
      currentVersion: {
        is: { analysisResultJson: { not: Prisma.AnyNull }, analysisReviewedAt: null },
      },
    },
    _count: { _all: true },
  });
  return new Map(groups.map((g) => [g.establishmentId, g._count._all]));
}

export async function listDocumentsAwaitingReview(): Promise<{
  items: ReviewQueueItem[];
  totalCount: number;
}> {
  const { tenantId } = await requireCabinetSession();
  const where = awaitingReviewWhere(tenantId);

  const [rows, totalCount] = await Promise.all([
    prisma.documentVersion.findMany({
      where,
      orderBy: { uploadedAt: "asc" },
      take: REVIEW_QUEUE_LIMIT,
      select: {
        id: true,
        versionNumber: true,
        uploadedAt: true,
        originalFilename: true,
        analysisResultJson: true,
        _count: { select: { criterionSuggestions: { where: { status: "PENDING" } } } },
        document: {
          select: {
            documentType: { select: { label: true } },
            establishment: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.documentVersion.count({ where }),
  ]);

  const items = rows.map((row) =>
    toReviewQueueItem({
      versionId: row.id,
      versionNumber: row.versionNumber,
      uploadedAt: row.uploadedAt,
      originalFilename: row.originalFilename,
      documentTypeLabel: row.document.documentType?.label ?? null,
      establishmentId: row.document.establishment.id,
      establishmentName: row.document.establishment.name,
      proposalCount: countProposals(
        parseAnalysisResult(row.analysisResultJson),
        row._count.criterionSuggestions
      ),
    })
  );
  return { items: sortReviewQueue(items), totalCount };
}

export type ReviewQueueEntry = {
  versionId: string;
  establishmentId: string;
  establishmentName: string;
  documentLabel: string;
  versionLabel: string;
  uploadedAt: Date;
  analysisReviewedAt: Date | null;
  // Une version remplacée n'est plus ce que le client verra : on l'affiche, sans
  // proposer de la marquer relue.
  isCurrent: boolean;
  // Faux quand le JSON stocké est vide, illisible ou issu d'un repli : l'écran le
  // dit au lieu de présenter un document « sans reproche ».
  hasReadableAnalysis: boolean;
  proposals: ReviewProposals;
};

// Un élément de la file désigné par l'URL (`?v=`) : entrée NON FIABLE. Il n'est
// lu que s'il appartient au tenant de l'appelant — sinon notFound(), sans dire
// s'il existe ailleurs.
export async function getReviewQueueEntry(versionId: string): Promise<ReviewQueueEntry> {
  const { tenantId } = await requireCabinetSession();
  if (typeof versionId !== "string" || versionId.length === 0 || versionId.length > MAX_ID_LENGTH) notFound();

  const version = await prisma.documentVersion.findFirst({
    where: { id: versionId, document: { establishment: { tenantId } } },
    select: {
      id: true,
      versionNumber: true,
      uploadedAt: true,
      originalFilename: true,
      analysisResultJson: true,
      analysisReviewedAt: true,
      currentForDocument: { select: { id: true } },
      criterionSuggestions: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          status: true,
          justification: true,
          criterion: { select: { code: true, label: true, requirementLevel: true } },
        },
      },
      document: {
        select: {
          documentType: { select: { label: true } },
          establishment: { select: { id: true, name: true, type: true } },
        },
      },
    },
  });
  if (!version) notFound();

  const { establishment } = version.document;
  const analysis = parseAnalysisResult(version.analysisResultJson);
  return {
    versionId: version.id,
    establishmentId: establishment.id,
    establishmentName: establishment.name,
    documentLabel: version.document.documentType?.label ?? version.originalFilename,
    versionLabel: `Version ${version.versionNumber}`,
    uploadedAt: version.uploadedAt,
    analysisReviewedAt: version.analysisReviewedAt,
    isCurrent: version.currentForDocument !== null,
    hasReadableAnalysis: analysis !== null,
    proposals: buildReviewProposals({
      analysis,
      criteria: version.criterionSuggestions.map((s) => ({
        kind: "CRITERION" as const,
        id: s.id,
        status: s.status,
        criterionCode: s.criterion.code,
        criterionLabel: s.criterion.label,
        // Résolu selon le profil réel de la structure (3.6.2 impératif en SAD mixte).
        isImperative: isCriterionImperativeForEstablishment(
          { code: s.criterion.code, requirementLevel: s.criterion.requirementLevel },
          establishment.type
        ),
        justification: s.justification,
      })),
    }),
  };
}
