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

  const unlink = () => prisma.documentTypeCriterion.deleteMany({ where: { documentTypeId: documentType.id } });
  const archive = () =>
    prisma.$transaction([
      unlink(),
      prisma.documentType.update({ where: { id: documentType.id }, data: { archivedAt: new Date() } }),
    ]);

  let outcome: "DELETED" | "ARCHIVED" = plan.kind === "DELETE" ? "DELETED" : "ARCHIVED";
  if (plan.kind === "DELETE") {
    try {
      await prisma.$transaction([unlink(), prisma.documentType.delete({ where: { id: documentType.id } })]);
    } catch (error) {
      // Un dépôt arrivé entre le décompte et la suppression : la clé étrangère refuse
      // (P2003). La ligne est devenue « utilisée » — on archive, comme la règle le veut.
      if (!isForeignKeyViolation(error)) throw error;
      await archive();
      outcome = "ARCHIVED";
    }
  } else {
    await archive();
  }

  await recordAuditEvent({
    action: outcome === "DELETED" ? "DOCUMENT_TYPE_DELETED" : "DOCUMENT_TYPE_ARCHIVED",
    actorUserId: userId,
    actorRole: session.user.role,
    targetId: documentType.id,
    detail: documentType.code,
  });

  revalidateTag(CRITERION_MATRIX_TAG);
  revalidatePath("/dashboard/cabinet", "layout");
  revalidatePath("/dashboard/client", "layout");
  return { ok: true, outcome };
}

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2003";
}
