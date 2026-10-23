"use server";

import { NEED } from "@/lib/auth/capabilities";
import { prisma } from "@eoda/database";
import { revalidateDocumentViews } from "./document-views-revalidation";
import { notFound } from "next/navigation";
import { requireEstablishmentAccess } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { canDepositDocuments } from "@/lib/services/mission-access-service";
import { getEstablishmentSupportMode } from "@/lib/services/establishment-offer-service";
import { notifyStructureActivity } from "@/lib/email/notifications";
import { analysisVisibleTo, parseAnalysisResult } from "@/lib/services/analysis-view-service";
import {
  canClientAcceptDocument,
  isAcceptanceCurrent,
  isReviewedByEoda,
} from "@/lib/services/client-documents-view-service";

// ─────────────────────────────────────────────────────────────────────────────
// « JE L'ACCEPTE » — acceptation d'un document par la structure (D6, tranche N2).
//
// Deux gestes, jamais fusionnés : EODA « relu » (`validatedAt`, parole du cabinet)
// et la structure « accepté » (« c'est lui qui valide, ce n'est pas moi », 15/09).
// Cette action ne touche JAMAIS `validatedAt`.
//
// Réservée au CLIENT, sur un document de SA structure (requireEstablishmentAccess :
// lien EstablishmentUser, notFound() sinon), et seulement sur ce qu'on lui a montré
// (canClientAcceptDocument — la même règle que l'écran).
// ─────────────────────────────────────────────────────────────────────────────

const NOT_VISIBLE_MESSAGE =
  "Ce document ne peut pas encore être accepté : il n'a pas encore été relu.";

export async function acceptDocument(
  establishmentId: string,
  documentTypeId: string
): Promise<{ error: string } | null> {
  if (typeof establishmentId !== "string" || typeof documentTypeId !== "string") notFound();

  const access = await requireEstablishmentAccess(establishmentId, NEED.DOCUMENTS_WRITE);
  // Accepter est la parole de la STRUCTURE : le cabinet a son propre geste
  // (setDocumentValidated). Un appel cabinet ne révèle rien de plus qu'un refus.
  if (!access.isClient) notFound();
  // Bibliothèque en lecture seule après la clôture : c'est une écriture.
  if (!canDepositDocuments(access.missionAccess)) {
    return { error: "L'accompagnement est terminé : aucun nouveau geste n'est possible." };
  }

  const document = await prisma.document.findUnique({
    where: { establishmentId_documentTypeId: { establishmentId, documentTypeId } },
    select: {
      id: true,
      validatedAt: true,
      clientAcceptedAt: true,
      documentType: { select: { code: true, label: true } },
      currentVersion: {
        select: { uploadedAt: true, analysisResultJson: true, analysisReviewedAt: true, uploadedBy: { select: { role: true } } },
      },
    },
  });
  if (!document?.currentVersion) return { error: "Ce document n'a pas encore été déposé." };

  const version = document.currentVersion;
  const mode = await getEstablishmentSupportMode(establishmentId);
  const reviewedByEoda = isReviewedByEoda({
    analysisReviewedAt: version.analysisReviewedAt,
    validatedAt: document.validatedAt,
    versionUploadedAt: version.uploadedAt,
    versionByCabinet: version.uploadedBy.role !== "CLIENT_USER",
  });
  // L'analyse telle que le CLIENT la voit — la barrière analysisVisibleTo, pas une
  // seconde règle écrite ici.
  const visibleAnalysis = analysisVisibleTo(
    "CLIENT",
    { analysis: parseAnalysisResult(version.analysisResultJson), reviewedAt: version.analysisReviewedAt },
    mode
  );
  if (!canClientAcceptDocument({ mode, hasVersion: true, analysisVisible: visibleAnalysis !== null, reviewedByEoda })) {
    return { error: NOT_VISIBLE_MESSAGE };
  }

  // Idempotent : un second clic ne redate pas une acceptation déjà valable.
  if (isAcceptanceCurrent({ clientAcceptedAt: document.clientAcceptedAt, versionUploadedAt: version.uploadedAt })) {
    return null;
  }

  await prisma.document.update({
    where: { id: document.id },
    data: { clientAcceptedAt: new Date(), clientAcceptedByUserId: access.userId },
  });

  await recordAuditEvent({
    action: "DOCUMENT_ACCEPTED_BY_CLIENT",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId,
    targetId: document.id,
    detail: document.documentType?.code ?? null,
  });

  revalidateDocumentViews(establishmentId);

  // Le cabinet est prévenu (16/10/2026) : c'est une fin de cycle — « c'est lui qui
  // valide, ce n'est pas moi » (15/09) — et il ne l'apprenait qu'en rouvrant la fiche.
  // L'acceptation est DÉJÀ enregistrée, et l'annonce ne peut pas la faire échouer
  // (`notifyStructureActivity` rend un état d'envoi, jamais une exception) : refuser
  // une acceptation parce qu'un e-mail n'est pas parti serait absurde, et c'est le
  // geste de la structure, pas le nôtre.
  await notifyStructureActivity({
    establishmentId,
    documentLabel: document.documentType?.label ?? "Document",
    kind: "ACCEPTED",
  });

  return null;
}
