"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { Prisma, prisma, type DocumentCategory } from "@eoda/database";
import { requireCabinetAdminSession } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { requiredString } from "@/lib/validation/form-parsers";
import { deriveMissionAccessState } from "@/lib/services/mission-access-service";
import { getCoveredDocumentCategories } from "@/lib/services/offer-scope-service";
import { notifyNewDocumentType } from "@/lib/email/notifications";
import {
  documentTypeCode,
  documentTypeCreationError,
  normalizeDocumentTypeLabel,
  shouldAnnounceNewDocumentType,
} from "@/lib/services/document-type-creation-service";

export type CreateDocumentTypeResult =
  | { error: string }
  | {
      ok: true;
      documentTypeId: string;
      label: string;
      // La ligne apparaît-elle dans la liste de la structure d'où elle a été créée ?
      // (son offre doit suivre la catégorie) — `null` hors d'une fiche.
      visibleOnStructure: boolean | null;
      // Ce qui est réellement parti : `null` quand le cabinet n'a pas voulu prévenir.
      announced: { structures: number; sent: number; recipients: number } | null;
    };

// ── Nouvelle ligne dans « Documents » (28/10/2026) ───────────────────────────
//
// Une ligne = un `DocumentType`, qui n'appartient à aucune structure : créée une
// fois, elle vaut pour TOUTES — elle s'analyse, se rattache aux critères (matrice,
// un seul rattachement pour tous) et se met à jour une fois. Réservée à
// CABINET_ADMIN, comme la bascule « réclamé / produit par EODA » : la liste est une
// politique de cabinet. Règles pures : document-type-creation-service.ts.
//
// Les structures accompagnées dont l'offre suit la catégorie sont prévenues par
// e-mail (si le cabinet le demande) ; l'envoi ne fait jamais échouer la création.
export async function createDocumentType(formData: FormData): Promise<CreateDocumentTypeResult> {
  const { session, userId, tenantId } = await requireCabinetAdminSession();

  const labelInput = requiredString(formData, "label", "Le nom du document", 500);
  if (!labelInput.ok) return { error: labelInput.error };
  const label = normalizeDocumentTypeLabel(labelInput.value);
  const categoryValue = formData.get("category");
  const category = typeof categoryValue === "string" ? categoryValue : "";
  const requestedFromClient = formData.get("provider") === "STRUCTURE";
  const announce = formData.get("announce") === "on";
  const establishmentIdValue = formData.get("establishmentId");
  const establishmentId = typeof establishmentIdValue === "string" && establishmentIdValue ? establishmentIdValue : null;

  // La fiche d'origine est une entrée non fiable : elle doit appartenir au cabinet.
  const origin = establishmentId
    ? await prisma.establishment.findFirst({
        where: { id: establishmentId, tenantId },
        select: { id: true, mission: { select: { formule: true, gratuit: true } } },
      })
    : null;
  if (establishmentId && !origin) notFound();

  const existing = await prisma.documentType.findMany({ select: { label: true, code: true } });
  const problem = documentTypeCreationError({
    label,
    category,
    existingLabels: existing.map((t) => t.label),
  });
  if (problem) return { error: problem };
  // Après la règle pure : la catégorie est l'une des trois ouvertes.
  const documentCategory = category as DocumentCategory;
  const code = documentTypeCode(label, existing.map((t) => t.code));

  let created: { id: string };
  try {
    created = await prisma.documentType.create({
      data: { code, category: documentCategory, label, requestedFromClient },
      select: { id: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Ce document vient d'être ajouté par ailleurs. Rechargez la page." };
    }
    throw error;
  }

  await recordAuditEvent({
    action: "DOCUMENT_TYPE_CREATED",
    actorUserId: userId,
    actorRole: session.user.role,
    targetId: created.id,
    detail: `${code} (${documentCategory}) → ${requestedFromClient ? "réclamé au client" : "produit par EODA"}`,
  });

  const announced = announce
    ? await announceToStructures({ tenantId, label, category: documentCategory, requestedFromClient })
    : null;

  revalidatePath("/dashboard/client");
  revalidatePath("/dashboard/cabinet");

  return {
    ok: true,
    documentTypeId: created.id,
    label,
    visibleOnStructure: origin
      ? origin.mission === null ||
        getCoveredDocumentCategories(origin.mission.formule, origin.mission.gratuit).includes(documentCategory)
      : null,
    announced,
  };
}

async function announceToStructures(input: {
  tenantId: string;
  label: string;
  category: DocumentCategory;
  requestedFromClient: boolean;
}): Promise<{ structures: number; sent: number; recipients: number }> {
  const establishments = await prisma.establishment.findMany({
    where: { tenantId: input.tenantId },
    select: {
      id: true,
      name: true,
      mission: { select: { formule: true, gratuit: true, closedAt: true, clientAccessRevokedAt: true } },
    },
  });

  const concerned = establishments.filter((establishment) =>
    shouldAnnounceNewDocumentType({
      access: deriveMissionAccessState(establishment.mission),
      coveredCategories: establishment.mission
        ? getCoveredDocumentCategories(establishment.mission.formule, establishment.mission.gratuit)
        : null,
      category: input.category,
    })
  );

  let sent = 0;
  let recipients = 0;
  // Une structure après l'autre : quelques structures, et un fournisseur d'e-mail
  // qui limite le débit — la rafale n'apporterait rien.
  for (const establishment of concerned) {
    const result = await notifyNewDocumentType({
      establishmentId: establishment.id,
      establishmentName: establishment.name,
      documentLabel: input.label,
      requestedFromClient: input.requestedFromClient,
    });
    sent += result.sent;
    recipients += result.total;
  }
  return { structures: concerned.length, sent, recipients };
}
