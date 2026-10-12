"use server";

import { prisma } from "@eoda/database";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { requireCabinetAdminSession, requireCabinetSession } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { reindexValidatedExample } from "@/lib/services/validated-example-indexing";

// ─────────────────────────────────────────────────────────────────────────────
// LIEN GABARIT → TYPE DE DOCUMENT (N8, context/10 §9). Rattaché, un GABARIT voit ses
// versions FINALE servir d'EXEMPLES VALIDÉS à la mise en conformité (et à l'analyse)
// de ce type, pour toutes les structures du tenant. CABINET_ADMIN seul ; le gabarit
// doit être du tenant de l'appelant (notFound sinon). Un document de RÉFÉRENCE ne
// devient jamais un exemple.
// ─────────────────────────────────────────────────────────────────────────────

export async function listDocumentTypesForExampleLink(): Promise<{ id: string; label: string }[]> {
  await requireCabinetSession();
  return prisma.documentType.findMany({ select: { id: true, label: true }, orderBy: { label: "asc" } });
}

export async function setTemplateDocumentType(
  templateDocumentId: string,
  rawDocumentTypeId: string | null
): Promise<{ error: string } | null> {
  const { tenantId, userId, role } = await requireCabinetAdminSession();
  if (typeof templateDocumentId !== "string") notFound();

  const template = await prisma.templateDocument.findFirst({
    where: { id: templateDocumentId, tenantId },
    select: { id: true, kind: true },
  });
  if (!template) notFound();
  if (template.kind !== "GABARIT") {
    return { error: "Un document de référence ne sert pas d'exemple : seul un gabarit se rattache à un type." };
  }

  const documentTypeId = typeof rawDocumentTypeId === "string" && rawDocumentTypeId.length > 0 ? rawDocumentTypeId : null;
  if (documentTypeId) {
    const exists = await prisma.documentType.findUnique({ where: { id: documentTypeId }, select: { id: true } });
    if (!exists) return { error: "Ce type de document n'existe pas." };
  }

  const documentType = documentTypeId
    ? await prisma.documentType.findUnique({ where: { id: documentTypeId }, select: { code: true } })
    : null;
  await prisma.templateDocument.update({ where: { id: template.id }, data: { documentTypeId } });
  await reindexValidatedExample(tenantId, template.id);
  await recordAuditEvent({
    action: "TEMPLATE_DOCUMENT_TYPE_LINKED",
    actorUserId: userId,
    actorRole: role,
    targetId: template.id,
    detail: documentType?.code ?? "aucun type",
  });
  revalidatePath(`/dashboard/cabinet/modeles/${template.id}`);
  return null;
}
