"use server";

import { prisma, EstablishmentUserRole } from "@eoda/database";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireClientEstablishment } from "@/lib/auth/guards";
import { NEED, type ClientAccessRole } from "@/lib/auth/capabilities";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { canDepositDocuments } from "@/lib/services/mission-access-service";
import { firstError, requiredEmail, requiredEnum, requiredString } from "@/lib/validation/form-parsers";
import { generateTemporaryPassword, hashPassword } from "@/lib/security/password-hashing";
import { sendClientInvitationEmail } from "@/lib/email/notifications";
import type { InvitationDelivery } from "@/lib/services/email-delivery-service";
import {
  countActiveDirections,
  decideClientAccessRevocation,
  decideClientRoleChange,
  deriveAccessStatus,
  parseClientAccessRole,
  type AccessLinkFacts,
  type AccessStatus,
} from "@/lib/services/client-access-service";

// ─────────────────────────────────────────────────────────────────────────────
// ACCÈS À L'ESPACE DE LA STRUCTURE — gestes de SA DIRECTION (N9, « Paramètres »).
//
// La structure vient du lien du compte connecté (requireClientEstablishment, module
// ACCESS que seule la DIRECTION possède), jamais d'un paramètre : une direction ne
// peut agir que sur SA structure. Le compte visé est relu DANS cette structure ;
// sinon notFound(). Le cabinet garde ses propres gestes (lib/actions/client-user.ts).
// ─────────────────────────────────────────────────────────────────────────────

const SETTINGS_PATH = "/dashboard/client/parametres";
const CLOSED = "Votre accompagnement est clos : les accès ne se modifient plus ici. Écrivez à EODA.";

export type StructureAccessRow = {
  userId: string;
  name: string;
  email: string;
  roleInEstablishment: EstablishmentUserRole;
  accessRole: ClientAccessRole;
  status: AccessStatus;
  revokedAt: Date | null;
  isSelf: boolean;
};

export async function getStructureAccesses(): Promise<{ rows: StructureAccessRow[]; canEdit: boolean } | null> {
  const { establishment, userId, missionAccess } = await requireClientEstablishment(NEED.ACCESS_READ);
  if (!establishment) return null;
  const links = await prisma.establishmentUser.findMany({
    where: { establishmentId: establishment.id },
    select: {
      accessRole: true,
      revokedAt: true,
      roleInEstablishment: true,
      user: { select: { id: true, name: true, email: true, isActive: true, mustChangePassword: true, role: true } },
    },
    orderBy: [{ revokedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
  });
  const rows = links
    .filter((link) => link.user.role === "CLIENT_USER")
    .map((link) => ({
      userId: link.user.id,
      name: link.user.name,
      email: link.user.email,
      roleInEstablishment: link.roleInEstablishment,
      accessRole: link.accessRole,
      status: deriveAccessStatus({ ...link, isActive: link.user.isActive, mustChangePassword: link.user.mustChangePassword }),
      revokedAt: link.revokedAt,
      isSelf: link.user.id === userId,
    }));
  return { rows, canEdit: canDepositDocuments(missionAccess) };
}

async function requireAccessManager() {
  const context = await requireClientEstablishment(NEED.ACCESS_WRITE);
  if (!context.establishment) notFound();
  return { ...context, establishment: context.establishment };
}

async function loadLinks(establishmentId: string): Promise<AccessLinkFacts[]> {
  return prisma.establishmentUser.findMany({
    where: { establishmentId },
    select: { userId: true, accessRole: true, revokedAt: true },
  });
}

async function resolveTarget(establishmentId: string, targetUserId: unknown): Promise<AccessLinkFacts> {
  if (typeof targetUserId !== "string" || targetUserId.length === 0) notFound();
  const link = await prisma.establishmentUser.findUnique({
    where: { userId_establishmentId: { userId: targetUserId, establishmentId } },
    select: { userId: true, accessRole: true, revokedAt: true, user: { select: { role: true } } },
  });
  if (!link || link.user.role !== "CLIENT_USER") notFound();
  return { userId: link.userId, accessRole: link.accessRole, revokedAt: link.revokedAt };
}

export type GrantClientAccessResult =
  | { success: true; tempPassword: string; userName: string; userEmail: string; invitationDelivery: InvitationDelivery }
  | { error: string };

export async function grantClientAccess(formData: FormData): Promise<GrantClientAccessResult> {
  const context = await requireAccessManager();
  if (!canDepositDocuments(context.missionAccess)) return { error: CLOSED };

  const email = requiredEmail(formData, "email", "L'adresse e-mail");
  const name = requiredString(formData, "name", "Le nom", 120);
  const job = requiredEnum(formData, "roleInEstablishment", "Le poste", EstablishmentUserRole);
  const error = firstError(email, name, job);
  if (error) return { error };
  if (!email.ok || !name.ok || !job.ok) return { error: "Formulaire invalide." };
  const accessRole = parseClientAccessRole(formData.get("accessRole"));
  if (!accessRole) return { error: "Choisissez un rôle." };

  // Une seule phrase, quel que soit le compte existant : pas d'oracle d'existence.
  const existing = await prisma.user.findUnique({ where: { email: email.value }, select: { id: true } });
  if (existing) return { error: "Cette adresse e-mail a déjà un compte. Demandez à EODA de la rattacher." };

  const tempPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(tempPassword);
  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: email.value, name: name.value, passwordHash, role: "CLIENT_USER", mustChangePassword: true },
      select: { id: true },
    });
    await tx.establishmentUser.create({
      data: { userId: user.id, establishmentId: context.establishment.id, roleInEstablishment: job.value, accessRole },
    });
    return user;
  });

  await recordAuditEvent({
    action: "CLIENT_ACCESS_GRANTED",
    actorUserId: context.userId,
    actorRole: "CLIENT_USER",
    establishmentId: context.establishment.id,
    targetId: created.id,
    detail: accessRole,
  });
  const invitationDelivery = await sendClientInvitationEmail({
    recipientName: name.value,
    email: email.value,
    temporaryPassword: tempPassword,
    establishmentName: context.establishment.name,
  });
  return { success: true, tempPassword, userName: name.value, userEmail: email.value, invitationDelivery };
}

export async function changeClientAccessRole(formData: FormData): Promise<{ error: string } | null> {
  const context = await requireAccessManager();
  if (!canDepositDocuments(context.missionAccess)) return { error: CLOSED };
  const target = await resolveTarget(context.establishment.id, formData.get("userId"));
  const newRole = parseClientAccessRole(formData.get("accessRole"));
  if (!newRole) return { error: "Choisissez un rôle." };

  const decision = decideClientRoleChange({
    actorId: context.userId,
    target,
    newRole,
    activeDirectionCount: countActiveDirections(await loadLinks(context.establishment.id)),
  });
  if (!decision.ok) return { error: decision.error };
  if (target.accessRole === newRole) return null;

  await prisma.establishmentUser.update({
    where: { userId_establishmentId: { userId: target.userId, establishmentId: context.establishment.id } },
    data: { accessRole: newRole },
  });
  await recordAuditEvent({
    action: "CLIENT_ACCESS_ROLE_CHANGED",
    actorUserId: context.userId,
    actorRole: "CLIENT_USER",
    establishmentId: context.establishment.id,
    targetId: target.userId,
    detail: `${target.accessRole} → ${newRole}`,
  });
  revalidatePath(SETTINGS_PATH);
  return null;
}

// Le lien est désactivé (revokedAt), jamais supprimé. Si la personne n'a plus aucun
// lien actif, son compte est aussi désactivé dans la même transaction : un compte
// client sans structure pourrait encore se connecter (même règle que le retrait par
// le cabinet, client-user.ts).
export async function revokeClientAccess(targetUserId: string): Promise<{ error: string } | null> {
  const context = await requireAccessManager();
  if (!canDepositDocuments(context.missionAccess)) return { error: CLOSED };
  const target = await resolveTarget(context.establishment.id, targetUserId);
  const decision = decideClientAccessRevocation({
    actorId: context.userId,
    target,
    activeDirectionCount: countActiveDirections(await loadLinks(context.establishment.id)),
  });
  if (!decision.ok) return { error: decision.error };

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.establishmentUser.update({
      where: { userId_establishmentId: { userId: target.userId, establishmentId: context.establishment.id } },
      data: { revokedAt: now },
    });
    const remaining = await tx.establishmentUser.count({ where: { userId: target.userId, revokedAt: null } });
    if (remaining === 0) {
      await tx.user.update({ where: { id: target.userId }, data: { isActive: false, deactivatedAt: now } });
    }
  });
  await recordAuditEvent({
    action: "CLIENT_ACCESS_REVOKED",
    actorUserId: context.userId,
    actorRole: "CLIENT_USER",
    establishmentId: context.establishment.id,
    targetId: target.userId,
    detail: target.accessRole,
  });
  revalidatePath(SETTINGS_PATH);
  return null;
}
