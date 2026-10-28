"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { CRITERION_MATRIX_TAG } from "@/lib/db/referential-cache";
import { planManualLinks } from "@/lib/services/criterion-matrix-service";
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
  documentTypeRenameError,
  MAX_CRITERIA_AT_CREATION,
  normalizeDocumentTypeLabel,
  parseCriterionCodes,
  shouldAnnounceNewDocumentType,
} from "@/lib/services/document-type-creation-service";

export type CreateDocumentTypeResult =
  | { error: string }
  | {
      ok: true;
      documentTypeId: string;
      label: string;
      // Critères rattachés dans le même geste (codes).
      linkedCriteria: string[];
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

  // Critères couverts, rattachés DANS LE MÊME GESTE (call du 28/10/2026 : « mettre le
  // nom, ensuite relier quel critère directement »). Vérifiés AVANT la création : un
  // code inconnu ne doit pas laisser une ligne à moitié faite.
  const criteriaValue = formData.get("criteria");
  const requestedCodes = parseCriterionCodes(typeof criteriaValue === "string" ? criteriaValue : "");
  if (requestedCodes.length > MAX_CRITERIA_AT_CREATION) {
    return { error: `Au plus ${MAX_CRITERIA_AT_CREATION} critères à la fois.` };
  }
  const criteria =
    requestedCodes.length > 0
      ? await prisma.criterion.findMany({ where: { code: { in: requestedCodes } }, select: { id: true, code: true } })
      : [];
  const plan = planManualLinks({
    requestedCriterionCodes: requestedCodes,
    knownCriterionCodes: new Set(criteria.map((c) => c.code)),
    linkedCriterionCodes: new Set(),
  });
  if (plan.unknown.length > 0) return { error: `Critère inconnu du référentiel : ${plan.unknown.join(", ")}.` };
  const idByCode = new Map(criteria.map((c) => [c.code, c.id]));

  let created: { id: string };
  try {
    created = await prisma.$transaction(async (tx) => {
      const documentType = await tx.documentType.create({
        data: { code, category: documentCategory, label, requestedFromClient },
        select: { id: true },
      });
      if (plan.toCreate.length > 0) {
        await tx.documentTypeCriterion.createMany({
          data: plan.toCreate.flatMap((criterionCode) => {
            const criterionId = idByCode.get(criterionCode);
            return criterionId ? [{ documentTypeId: documentType.id, criterionId }] : [];
          }),
          skipDuplicates: true,
        });
      }
      return documentType;
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
    detail:
      `${code} (${documentCategory}) → ${requestedFromClient ? "réclamé au client" : "produit par EODA"}` +
      (plan.toCreate.length > 0 ? ` · critères ${plan.toCreate.join(", ")}` : ""),
  });
  if (plan.toCreate.length > 0) revalidateTag(CRITERION_MATRIX_TAG);

  const announced = announce
    ? await announceToStructures({ tenantId, label, category: documentCategory, requestedFromClient })
    : null;

  revalidatePath("/dashboard/client");
  revalidatePath("/dashboard/cabinet");

  return {
    ok: true,
    documentTypeId: created.id,
    label,
    linkedCriteria: plan.toCreate,
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

// ── Renommer une ligne (28/10/2026) ──────────────────────────────────────────
//
// « Uniformiser les titres » : l'intitulé change pour toutes les structures à la fois ;
// le CODE (clé de la matrice, des analyses, du journal) ne bouge pas. CABINET_ADMIN
// seul, comme la création. Règle pure : documentTypeRenameError.
export async function renameDocumentType(
  documentTypeId: string,
  rawLabel: string
): Promise<{ error: string } | { ok: true; label: string }> {
  const { session, userId } = await requireCabinetAdminSession();
  if (typeof documentTypeId !== "string" || typeof rawLabel !== "string") return { error: "Valeur invalide." };
  const label = normalizeDocumentTypeLabel(rawLabel);

  const documentType = await prisma.documentType.findUnique({
    where: { id: documentTypeId },
    select: { id: true, code: true, label: true, category: true },
  });
  if (!documentType) notFound();
  if (documentType.label === label) return { ok: true, label };

  const others = await prisma.documentType.findMany({
    where: { id: { not: documentType.id } },
    select: { label: true },
  });
  const problem = documentTypeRenameError({
    label,
    category: documentType.category,
    otherLabels: others.map((t) => t.label),
  });
  if (problem) return { error: problem };

  await prisma.documentType.update({ where: { id: documentType.id }, data: { label } });

  // Intitulés de cabinet, jamais une donnée de personne : l'ancien et le nouveau sont
  // gardés, pour retrouver une ligne sous son ancien nom.
  await recordAuditEvent({
    action: "DOCUMENT_TYPE_RENAMED",
    actorUserId: userId,
    actorRole: session.user.role,
    targetId: documentType.id,
    detail: `${documentType.code} : « ${documentType.label} » → « ${label} »`,
  });

  revalidatePath("/dashboard/client");
  revalidatePath("/dashboard/cabinet");
  return { ok: true, label };
}
