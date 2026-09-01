"use server";

import { prisma, OptionRequestStatus, type PricingUnit } from "@eoda/database";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { requireCabinetAdminSession } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { firstError, requiredEnum, requiredString } from "@/lib/validation/form-parsers";

// ─────────────────────────────────────────────────────────────────────────────
// FILE DES DEMANDES D'OPTION — côté Cabinet.
//
// C'est l'autre moitié du parcours §12.3 : le client demande depuis son portail,
// Sandrine traite ici. Réservé à CABINET_ADMIN comme le reste du pipeline
// commercial (CLAUDE.md §7) — un CABINET_EVALUATOR n'a pas à voir une intention
// d'achat.
//
// Traiter une demande ne débloque RIEN : c'est un marqueur de file d'attente. Le
// déblocage réel passe par un devis puis un avenant (§12.6), qui vivent dans le
// module devis et nulle part ailleurs.
// ─────────────────────────────────────────────────────────────────────────────

export type PendingOptionRequest = {
  id: string;
  createdAt: Date;
  message: string | null;
  establishment: { id: string; name: string };
  option: {
    label: string;
    priceEuros: number;
    pricingUnit: PricingUnit;
    priceMaxEuros: number | null;
    minQuantity: number | null;
  };
};

// Nombre de demandes en attente — sert la pastille de navigation. Un `count` et non
// la liste : la barre de navigation est rendue à chaque page, elle n'a pas à charger
// des libellés et des prix pour afficher un chiffre.
export async function countPendingOptionRequests(): Promise<number> {
  const { tenantId } = await requireCabinetAdminSession();
  return prisma.clientOptionRequest.count({ where: { tenantId, status: "DEMANDEE" } });
}

// Demandes en attente du tenant de l'appelant, de la plus ancienne à la plus
// récente. Le filtre par tenant n'est pas conditionnel : sans tenant, la garde a
// déjà refusé (fail-closed).
export async function listPendingOptionRequests(): Promise<PendingOptionRequest[]> {
  const { tenantId } = await requireCabinetAdminSession();

  const requests = await prisma.clientOptionRequest.findMany({
    where: { tenantId, status: "DEMANDEE" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      createdAt: true,
      message: true,
      establishment: { select: { id: true, name: true } },
      catalogueOption: {
        select: {
          label: true,
          priceEuros: true,
          pricingUnit: true,
          priceMaxEuros: true,
          minQuantity: true,
        },
      },
    },
  });

  return requests.map((request) => ({
    id: request.id,
    createdAt: request.createdAt,
    message: request.message,
    establishment: request.establishment,
    option: request.catalogueOption,
  }));
}

export type HandleOptionRequestResult = { ok: true } | { ok: false; error: string };

// Marque une demande comme traitée ou refusée. `requestId` vient d'un formulaire,
// donc d'une route HTTP publique : son appartenance au tenant de l'appelant est
// vérifiée avant l'écriture, et un identifiant hors périmètre donne notFound() —
// jamais un redirect, qui révélerait qu'il existe ailleurs.
export async function handleOptionRequest(
  formData: FormData
): Promise<HandleOptionRequestResult> {
  const { tenantId, userId } = await requireCabinetAdminSession();

  const requestId = requiredString(formData, "requestId", "La demande", 64);
  const status = requiredEnum(formData, "status", "Le statut", OptionRequestStatus);
  const error = firstError(requestId, status);
  if (error) return { ok: false, error };
  if (!requestId.ok || !status.ok) return { ok: false, error: "Demande invalide." };

  if (status.value === "DEMANDEE") {
    return { ok: false, error: "Une demande ne peut pas être remise en attente." };
  }

  const existing = await prisma.clientOptionRequest.findFirst({
    where: { id: requestId.value, tenantId },
    select: { id: true, status: true, establishmentId: true, catalogueOptionId: true },
  });
  if (!existing) notFound();

  if (existing.status !== "DEMANDEE") {
    return { ok: false, error: "Cette demande a déjà été traitée." };
  }

  await prisma.clientOptionRequest.update({
    where: { id: existing.id },
    data: { status: status.value, handledAt: new Date() },
  });

  await recordAuditEvent({
    action: "OPTION_REQUEST_HANDLED",
    actorUserId: userId,
    actorRole: "CABINET_ADMIN",
    establishmentId: existing.establishmentId,
    targetId: existing.catalogueOptionId,
    detail: status.value,
  });

  revalidatePath("/dashboard/cabinet/commercial");
  revalidatePath("/dashboard/client/accompagnement");

  return { ok: true };
}
