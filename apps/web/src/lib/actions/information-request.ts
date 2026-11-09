"use server";

import { prisma } from "@eoda/database";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { requireEstablishmentAccess } from "@/lib/auth/guards";
import { NEED } from "@/lib/auth/capabilities";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { canDepositDocuments } from "@/lib/services/mission-access-service";
import { describeActionForAudit, titleError } from "@/lib/services/action-item-service";
import { requiredString } from "@/lib/validation/form-parsers";
import { notifyInformationRequested } from "@/lib/email/notifications";

// ─────────────────────────────────────────────────────────────────────────────
// « DEMANDER À LA STRUCTURE » (09/11/2026) — depuis un élément manquant relevé par
// l'analyse, la consultante envoie une demande qu'elle a relue et corrigée.
//
//  - garde unique : requireEstablishmentAccess(DOCUMENTS_WRITE) ; un compte de la
//    structure est refusé (notFound) — c'est un geste du cabinet ;
//  - une tâche `ActionItem` confiée à la STRUCTURE, source DOCUMENT, liée au document
//    de ce type s'il existe (le plan d'action de la structure la montre) ;
//  - la structure est prévenue par e-mail : l'INTITULÉ du type et « une information
//    est attendue », jamais le texte de la demande ni l'analyse — elle le lit dans la
//    plateforme. L'envoi ne fait jamais échouer la demande ;
//  - journal : source et côté, jamais le titre (texte libre).
// ─────────────────────────────────────────────────────────────────────────────

export type InformationRequestResult = { error: string } | { ok: true; notified: number };

export async function requestInformationFromStructure(formData: FormData): Promise<InformationRequestResult> {
  const establishmentIdRaw = formData.get("establishmentId");
  if (typeof establishmentIdRaw !== "string" || establishmentIdRaw.length === 0) return { error: "Structure manquante." };
  const access = await requireEstablishmentAccess(establishmentIdRaw, NEED.DOCUMENTS_WRITE);
  if (access.isClient) notFound();
  if (!canDepositDocuments(access.missionAccess)) {
    return { error: "L'accompagnement est clôturé : la structure ne peut plus répondre à une demande." };
  }

  const title = requiredString(formData, "title", "La demande", 400);
  if (!title.ok) return { error: title.error };
  const invalidTitle = titleError(title.value);
  if (invalidTitle) return { error: invalidTitle };

  const documentTypeIdRaw = formData.get("documentTypeId");
  if (typeof documentTypeIdRaw !== "string" || documentTypeIdRaw.length === 0) notFound();
  const [establishment, documentType] = await Promise.all([
    prisma.establishment.findUnique({ where: { id: access.establishmentId }, select: { tenantId: true, name: true } }),
    prisma.documentType.findUnique({ where: { id: documentTypeIdRaw }, select: { id: true, label: true, archivedAt: true } }),
  ]);
  if (!establishment || !documentType || documentType.archivedAt) notFound();

  const document = await prisma.document.findUnique({
    where: { establishmentId_documentTypeId: { establishmentId: access.establishmentId, documentTypeId: documentType.id } },
    select: { id: true },
  });

  const created = await prisma.actionItem.create({
    data: {
      tenantId: establishment.tenantId,
      establishmentId: access.establishmentId,
      title: title.value.trim(),
      ownerKind: "STRUCTURE",
      ownerUserId: null,
      source: "DOCUMENT",
      linkedDocumentId: document?.id ?? null,
      createdByUserId: access.userId,
    },
    select: { id: true, source: true, ownerKind: true },
  });
  await recordAuditEvent({
    action: "ACTION_ITEM_CREATED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId: access.establishmentId,
    targetId: created.id,
    detail: describeActionForAudit(created),
  });

  const { sent } = await notifyInformationRequested({
    establishmentId: access.establishmentId,
    establishmentName: establishment.name,
    documentLabel: documentType.label,
  });

  revalidatePath(`/dashboard/cabinet/etablissements/${access.establishmentId}/plan-action`);
  revalidatePath("/dashboard/client/taches");
  return { ok: true, notified: sent };
}
