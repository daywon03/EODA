"use server";

import { prisma, Prisma } from "@eoda/database";
import { requireCabinetSession } from "@/lib/auth/guards";
import {
  sortReviewQueue,
  toReviewQueueItem,
  type ReviewQueueItem,
} from "@/lib/services/review-queue-service";

// ─────────────────────────────────────────────────────────────────────────────
// FILE « À RELIRE » — lecture côté cabinet (règles : review-queue-service.ts).
//
// Le tenant vient de la garde, jamais d'un paramètre, et le filtre n'est pas
// conditionnel : sans tenant, requireCabinetSession() a déjà refusé (fail-closed).
// Lecture seule : aucun document n'est ouvert ici, rien à journaliser — l'accès au
// contenu se fait depuis la fiche, qui journalise.
// ─────────────────────────────────────────────────────────────────────────────

// Au-delà, la page dit combien d'éléments ne sont pas affichés plutôt que de tout
// charger : la file se vide en relisant, pas en défilant.
const REVIEW_QUEUE_LIMIT = 200;

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
    })
  );
  return { items: sortReviewQueue(items), totalCount };
}
