"use server";

import { prisma, EstablishmentUserRole } from "@eoda/database";
import { revalidatePath } from "next/cache";
import { requireEstablishmentInTenant } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { generateTemporaryPassword, hashPassword } from "@/lib/security/password-hashing";
import {
  firstError,
  requiredEnum,
  requiredString,
} from "@/lib/validation/form-parsers";

// ─────────────────────────────────────────────────────────────────────────────
// CYCLE DE VIE D'UN ACCÈS CLIENT — révocation, correction, réinitialisation
//
// Avant ces actions, la fiche établissement n'affichait les interlocuteurs qu'en
// lecture seule : le départ d'un salarié de la structure cliente se traitait par un
// UPDATE SQL à la main, et un client ayant perdu son mot de passe était enfermé
// dehors définitivement. Dans un produit médico-social, l'impossibilité de révoquer
// un accès est un écart réglementaire, pas une gêne.
//
// Deux niveaux, volontairement distincts :
//   - RETRAIT du lien EstablishmentUser  → l'accès à CET établissement disparaît ;
//   - DÉSACTIVATION du compte (`isActive`) → le compte ne s'authentifie plus du tout.
// Le second est nécessaire parce que le premier ne suffit pas : un CLIENT_USER sans
// aucun lien peut toujours se connecter. Le retrait du dernier lien entraîne donc la
// désactivation, dans la même transaction.
//
// Toutes ces actions sont réservées au Cabinet et passent par
// requireEstablishmentInTenant() : l'`establishmentId` et l'`userId` reçus viennent
// d'une route HTTP publique, jamais de l'UI.
// ─────────────────────────────────────────────────────────────────────────────

export type ClientUserActionResult = { success: true } | { error: string };

export type ResetClientPasswordResult =
  | { success: true; tempPassword: string; userName: string; userEmail: string }
  | { error: string };

// Message unique pour tout ce qui n'est pas résolu : compte inexistant, compte d'un
// autre établissement, compte Cabinet. Ne jamais distinguer les trois — ce serait un
// oracle d'existence sur les comptes des autres tenants.
const NOT_A_CLIENT_OF_THIS_ESTABLISHMENT = "Cet interlocuteur n'existe pas pour cet établissement.";

type ResolvedTarget = {
  establishmentId: string;
  actorUserId: string;
  actorRole: string;
  user: { id: string; name: string; email: string; isActive: boolean };
};

// Résout la cible d'une action : établissement du tenant de l'appelant, PUIS lien
// EstablishmentUser existant, PUIS rôle CLIENT_USER. L'ordre compte — on ne révèle
// jamais l'existence d'un compte avant d'avoir prouvé l'habilitation sur
// l'établissement. Un compte Cabinet n'est jamais manipulable par cette voie : son
// cycle de vie n'appartient pas à la fiche d'un établissement.
async function resolveTargetClientUser(
  formData: FormData
): Promise<{ error: string } | ResolvedTarget> {
  const establishmentIdRaw = formData.get("establishmentId");
  const userIdRaw = formData.get("userId");
  if (typeof establishmentIdRaw !== "string" || establishmentIdRaw.length === 0) {
    return { error: "Établissement manquant." };
  }
  if (typeof userIdRaw !== "string" || userIdRaw.length === 0) {
    return { error: "Interlocuteur manquant." };
  }

  const { establishmentId, session, userId: actorUserId } =
    await requireEstablishmentInTenant(establishmentIdRaw);

  const link = await prisma.establishmentUser.findUnique({
    where: { userId_establishmentId: { userId: userIdRaw, establishmentId } },
    include: { user: { select: { id: true, name: true, email: true, role: true, isActive: true } } },
  });
  if (!link || link.user.role !== "CLIENT_USER") {
    return { error: NOT_A_CLIENT_OF_THIS_ESTABLISHMENT };
  }

  return {
    establishmentId,
    actorUserId,
    actorRole: session.user.role,
    user: {
      id: link.user.id,
      name: link.user.name,
      email: link.user.email,
      isActive: link.user.isActive,
    },
  };
}

function revalidateEstablishment(establishmentId: string): void {
  revalidatePath(`/dashboard/cabinet/etablissements/${establishmentId}`);
}

// ── Correction d'une fiche interlocuteur ─────────────────────────────────────
// Nom et fonction dans la structure. L'email n'est PAS modifiable ici : c'est
// l'identifiant de connexion, le changer silencieusement depuis la fiche d'un
// établissement transférerait un accès existant vers une autre boîte mail.
export async function updateClientUser(formData: FormData): Promise<ClientUserActionResult> {
  const target = await resolveTargetClientUser(formData);
  if ("error" in target) return target;

  const name = requiredString(formData, "name", "Le nom", 120);
  const roleInEstablishment = requiredEnum(
    formData,
    "roleInEstablishment",
    "Le rôle dans l'établissement",
    EstablishmentUserRole
  );
  const error = firstError(name, roleInEstablishment);
  if (error) return { error };
  if (!name.ok || !roleInEstablishment.ok) return { error: "Formulaire invalide." };

  await prisma.$transaction([
    prisma.user.update({ where: { id: target.user.id }, data: { name: name.value } }),
    prisma.establishmentUser.update({
      where: { userId_establishmentId: { userId: target.user.id, establishmentId: target.establishmentId } },
      data: { roleInEstablishment: roleInEstablishment.value },
    }),
  ]);

  await recordAuditEvent({
    action: "CLIENT_USER_UPDATED",
    actorUserId: target.actorUserId,
    actorRole: target.actorRole,
    establishmentId: target.establishmentId,
    targetId: target.user.id,
    detail: roleInEstablishment.value,
  });

  revalidateEstablishment(target.establishmentId);
  return { success: true };
}

// ── Retrait de l'accès à un établissement ────────────────────────────────────
// Supprime le lien, et désactive le compte s'il ne lui reste plus aucun
// établissement : sinon on obtiendrait exactement l'anomalie que cette phase
// corrige — un compte qui s'authentifie encore sans rien avoir à voir.
export async function removeClientUserFromEstablishment(
  formData: FormData
): Promise<ClientUserActionResult> {
  const target = await resolveTargetClientUser(formData);
  if ("error" in target) return target;

  const deactivated = await prisma.$transaction(async (tx) => {
    await tx.establishmentUser.delete({
      where: {
        userId_establishmentId: { userId: target.user.id, establishmentId: target.establishmentId },
      },
    });

    const remaining = await tx.establishmentUser.count({ where: { userId: target.user.id } });
    if (remaining > 0) return false;

    await tx.user.update({
      where: { id: target.user.id },
      data: { isActive: false, deactivatedAt: new Date() },
    });
    return true;
  });

  await recordAuditEvent({
    action: "CLIENT_USER_UNLINKED",
    actorUserId: target.actorUserId,
    actorRole: target.actorRole,
    establishmentId: target.establishmentId,
    targetId: target.user.id,
    detail: deactivated ? "dernier rattachement — compte désactivé" : "rattachement retiré",
  });
  if (deactivated) {
    await recordAuditEvent({
      action: "USER_DEACTIVATED",
      actorUserId: target.actorUserId,
      actorRole: target.actorRole,
      establishmentId: target.establishmentId,
      targetId: target.user.id,
      detail: "aucun établissement rattaché",
    });
  }

  revalidateEstablishment(target.establishmentId);
  return { success: true };
}

// ── Désactivation / réactivation d'un compte ─────────────────────────────────
// Réversible par construction : c'est la différence avec le retrait de lien, et la
// raison pour laquelle les deux existent séparément.
export async function setClientUserActive(formData: FormData): Promise<ClientUserActionResult> {
  const target = await resolveTargetClientUser(formData);
  if ("error" in target) return target;

  // Booléen lu explicitement : pas de cast, pas de « toute valeur non vide = vrai ».
  const raw = formData.get("isActive");
  if (raw !== "true" && raw !== "false") return { error: "Valeur invalide." };
  const isActive = raw === "true";

  if (isActive === target.user.isActive) return { success: true };

  await prisma.user.update({
    where: { id: target.user.id },
    data: { isActive, deactivatedAt: isActive ? null : new Date() },
  });

  await recordAuditEvent({
    action: isActive ? "USER_REACTIVATED" : "USER_DEACTIVATED",
    actorUserId: target.actorUserId,
    actorRole: target.actorRole,
    establishmentId: target.establishmentId,
    targetId: target.user.id,
    detail: "décision du cabinet",
  });

  revalidateEstablishment(target.establishmentId);
  return { success: true };
}

// ── Réinitialisation du mot de passe par le cabinet ──────────────────────────
// Réutilise le mécanisme de rotation posé à la phase précédente, sans le
// réimplémenter : nouveau mot de passe temporaire, `mustChangePassword` réarmé, et
// `passwordChangedAt` mis à jour — ce dernier fait office d'horodatage de révocation,
// donc toute session encore ouverte sur l'ancien mot de passe est refusée par les
// gardes dès la requête suivante.
//
// Un compte désactivé n'est pas réinitialisable : redonner un mot de passe utilisable
// à un accès révoqué serait le contraire de la révocation.
export async function resetClientUserPassword(
  formData: FormData
): Promise<ResetClientPasswordResult> {
  const target = await resolveTargetClientUser(formData);
  if ("error" in target) return target;
  if (!target.user.isActive) {
    return { error: "Ce compte est désactivé : réactivez-le avant de réinitialiser son mot de passe." };
  }

  const tempPassword = generateTemporaryPassword();

  await prisma.user.update({
    where: { id: target.user.id },
    data: {
      passwordHash: await hashPassword(tempPassword),
      mustChangePassword: true,
      passwordChangedAt: new Date(),
    },
  });

  // Le mot de passe temporaire n'apparaît volontairement PAS dans l'événement.
  await recordAuditEvent({
    action: "PASSWORD_RESET_BY_ADMIN",
    actorUserId: target.actorUserId,
    actorRole: target.actorRole,
    establishmentId: target.establishmentId,
    targetId: target.user.id,
    detail: "réinitialisation par le cabinet",
  });

  revalidateEstablishment(target.establishmentId);

  return {
    success: true,
    tempPassword,
    userName: target.user.name,
    userEmail: target.user.email,
  };
}
