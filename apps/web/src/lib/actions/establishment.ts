"use server";

import { prisma, type Prisma, EstablishmentType } from "@eoda/database";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCabinetSession, requireEstablishmentInTenant } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import {
  firstError,
  optionalDate,
  optionalString,
  requiredEnum,
  requiredString,
} from "@/lib/validation/form-parsers";

function parseEstablishmentInput(formData: FormData): { error: string } | {
  name: string;
  type: EstablishmentType;
  finessNumber: string | null;
  address: string | null;
  hasEvaluationTargetDate: Date | null;
} {
  const name = requiredString(formData, "name", "Le nom de l'établissement", 200);
  const type = requiredEnum(formData, "type", "Le type de SAD", EstablishmentType);
  // FINESS = 9 chiffres. Validé ici plutôt que laissé libre : c'est la clé
  // d'identification de l'ESSMS auprès de la HAS, une saisie approximative se
  // retrouverait dans un livrable.
  const finessNumber = optionalString(formData, "finessNumber", "Le numéro FINESS", 20);
  const address = optionalString(formData, "address", "L'adresse", 300);
  const hasEvaluationTargetDate = optionalDate(
    formData,
    "hasEvaluationTargetDate",
    "La date d'évaluation visée"
  );

  const error = firstError(name, type, finessNumber, address, hasEvaluationTargetDate);
  if (error) return { error };
  if (!name.ok || !type.ok || !finessNumber.ok || !address.ok || !hasEvaluationTargetDate.ok) {
    return { error: "Formulaire invalide." };
  }

  if (finessNumber.value && !/^\d{9}$/.test(finessNumber.value)) {
    return { error: "Le numéro FINESS doit comporter exactement 9 chiffres." };
  }

  return {
    name: name.value,
    type: type.value,
    finessNumber: finessNumber.value,
    address: address.value,
    hasEvaluationTargetDate: hasEvaluationTargetDate.value,
  };
}

export async function createEstablishment(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const { tenantId } = await requireCabinetSession();

  const parsed = parseEstablishmentInput(formData);
  if ("error" in parsed) return parsed;

  const establishment = await prisma.establishment.create({
    data: { ...parsed, tenantId, commercialTier: "BETA" },
  });

  revalidatePath("/dashboard/cabinet");
  redirect(`/dashboard/cabinet/etablissements/${establishment.id}`);
}

export async function updateEstablishment(
  id: string,
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  await requireEstablishmentInTenant(id);

  const parsed = parseEstablishmentInput(formData);
  if ("error" in parsed) return parsed;

  await prisma.establishment.update({
    where: { id },
    data: parsed,
  });

  revalidatePath("/dashboard/cabinet");
  revalidatePath(`/dashboard/cabinet/etablissements/${id}`);
  redirect(`/dashboard/cabinet/etablissements/${id}`);
}

export async function deleteEstablishment(id: string): Promise<{ error: string } | void> {
  const { session, userId } = await requireEstablishmentInTenant(id);

  // Comptes clients supprimés avec l'établissement — calculés DANS la transaction,
  // journalisés après elle.
  const deletedUserIds = await prisma.$transaction(async (tx) => {
    await tx.elementRating.deleteMany({
      where: { evaluationSession: { establishmentId: id } },
    });
    await tx.evaluationSession.deleteMany({ where: { establishmentId: id } });
    await tx.document.updateMany({
      where: { establishmentId: id },
      data: { currentVersionId: null },
    });
    await tx.documentVersion.deleteMany({ where: { document: { establishmentId: id } } });
    await tx.document.deleteMany({ where: { establishmentId: id } });

    // ── Comptes orphelins ────────────────────────────────────────────────────
    // Jusqu'ici, seuls les liens EstablishmentUser étaient supprimés : les lignes
    // `users` survivaient, et un compte client d'un établissement disparu POUVAIT
    // ENCORE S'AUTHENTIFIER. C'est une fuite d'accès, pas un résidu cosmétique.
    // Un compte encore rattaché à un autre établissement est évidemment conservé ;
    // seul le CLIENT_USER qui ne l'est plus à rien est supprimé, dans la même
    // transaction que l'établissement — les deux relations qui le référencent
    // (DocumentVersion.uploadedBy, EvaluationSession) viennent d'être effacées.
    const linkedUserIds = (
      await tx.establishmentUser.findMany({ where: { establishmentId: id }, select: { userId: true } })
    ).map((link) => link.userId);

    await tx.establishmentUser.deleteMany({ where: { establishmentId: id } });

    let orphanIds: string[] = [];
    if (linkedUserIds.length > 0) {
      const stillLinked = new Set(
        (
          await tx.establishmentUser.findMany({
            where: { userId: { in: linkedUserIds } },
            select: { userId: true },
          })
        ).map((link) => link.userId)
      );
      const clientAccounts = await tx.user.findMany({
        where: { id: { in: linkedUserIds }, role: "CLIENT_USER" },
        select: { id: true },
      });
      orphanIds = clientAccounts.map((u) => u.id).filter((userId) => !stillLinked.has(userId));
      if (orphanIds.length > 0) {
        await tx.user.deleteMany({ where: { id: { in: orphanIds } } });
      }
    }

    await tx.missionChecklistItemStatus.deleteMany({ where: { mission: { establishmentId: id } } });
    await tx.mission.deleteMany({ where: { establishmentId: id } });
    await tx.establishment.delete({ where: { id } });

    return orphanIds;
  });

  // Journalisé après coup, hors transaction : la trace de suppression ne doit pas
  // être annulée avec la transaction si celle-ci échoue, ni la faire échouer.
  await recordAuditEvent({
    action: "ESTABLISHMENT_DELETED",
    actorUserId: userId,
    actorRole: session.user.role,
    establishmentId: id,
    detail: `${deletedUserIds.length} compte(s) client supprimé(s)`,
  });

  // Une ligne par compte supprimé : le journal doit permettre de répondre « quel
  // accès a disparu, quand », pas seulement « un établissement a été supprimé ».
  for (const deletedUserId of deletedUserIds) {
    await recordAuditEvent({
      action: "USER_DELETED_WITH_ESTABLISHMENT",
      actorUserId: userId,
      actorRole: session.user.role,
      establishmentId: id,
      targetId: deletedUserId,
    });
  }

  revalidatePath("/dashboard/cabinet");
  redirect("/dashboard/cabinet");
}

export async function listEstablishments() {
  const { tenantId } = await requireCabinetSession();

  return prisma.establishment.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { documents: true } } },
  });
}

export type EstablishmentWithUsers = Prisma.EstablishmentGetPayload<{
  include: {
    establishmentUsers: {
      include: {
        user: { select: { id: true; name: true; email: true; role: true; isActive: true } };
      };
    };
  };
}>;

export async function getEstablishment(id: string): Promise<EstablishmentWithUsers> {
  const { tenantId } = await requireCabinetSession();

  const establishment = await prisma.establishment.findFirst({
    where: { id, tenantId },
    include: {
      establishmentUsers: {
        include: {
          user: { select: { id: true, name: true, email: true, role: true, isActive: true } },
        },
      },
    },
  });

  // notFound() et non redirect() — ne jamais révéler qu'un identifiant existe dans
  // un autre tenant.
  if (!establishment) notFound();
  return establishment;
}
