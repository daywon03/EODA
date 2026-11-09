"use server";

import { prisma } from "@eoda/database";
import { revalidatePath, revalidateTag } from "next/cache";
import { notFound } from "next/navigation";
import { CRITERION_MATRIX_TAG } from "@/lib/db/referential-cache";
import { requireCabinetAdminSession } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { planDocumentTypeRemoval } from "@/lib/services/document-type-removal-service";

// ─────────────────────────────────────────────────────────────────────────────
// « RETIRER CETTE LIGNE » (retours de Sandrine, 09/11/2026 : « il manque des
// poubelles »). CABINET_ADMIN seul : la liste vaut pour toutes les structures.
// Règles pures : document-type-removal-service.ts.
//
//  - jamais utilisée : supprimée, avec ses rattachements de la matrice ;
//  - utilisée (documents d'une structure, gabarit) : ARCHIVÉE — masquée de toutes les
//    listes, versions et journal intacts. Ses rattachements de la matrice sont retirés
//    dans la même transaction : un critère ne doit plus attendre une preuve qu'aucune
//    liste ne montre (« Critères et preuves », analyse, guidelines).
// Journal : le CODE de la ligne seulement.
// ─────────────────────────────────────────────────────────────────────────────

export type RemoveDocumentTypeResult = { error: string } | { ok: true; outcome: "DELETED" | "ARCHIVED" };

export async function removeDocumentType(documentTypeId: string): Promise<RemoveDocumentTypeResult> {
  const { session, userId } = await requireCabinetAdminSession();
  if (typeof documentTypeId !== "string" || documentTypeId.length === 0) notFound();

  const documentType = await prisma.documentType.findUnique({
    where: { id: documentTypeId },
    select: { id: true, code: true, category: true, archivedAt: true },
  });
  if (!documentType) notFound();

  const [documents, templates] = await Promise.all([
    prisma.document.count({ where: { documentTypeId: documentType.id } }),
    prisma.templateDocument.count({ where: { documentTypeId: documentType.id } }),
  ]);
  const plan = planDocumentTypeRemoval(documentType, { documents, templates });
  if (plan.kind === "REFUSED") return { error: plan.error };

  const unlink = prisma.documentTypeCriterion.deleteMany({ where: { documentTypeId: documentType.id } });
  if (plan.kind === "DELETE") {
    await prisma.$transaction([unlink, prisma.documentType.delete({ where: { id: documentType.id } })]);
  } else {
    await prisma.$transaction([
      unlink,
      prisma.documentType.update({ where: { id: documentType.id }, data: { archivedAt: new Date() } }),
    ]);
  }

  await recordAuditEvent({
    action: plan.kind === "DELETE" ? "DOCUMENT_TYPE_DELETED" : "DOCUMENT_TYPE_ARCHIVED",
    actorUserId: userId,
    actorRole: session.user.role,
    targetId: documentType.id,
    detail: documentType.code,
  });

  revalidateTag(CRITERION_MATRIX_TAG);
  revalidatePath("/dashboard/cabinet", "layout");
  revalidatePath("/dashboard/client", "layout");
  return { ok: true, outcome: plan.kind === "DELETE" ? "DELETED" : "ARCHIVED" };
}
