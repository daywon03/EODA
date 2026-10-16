"use server";

import { prisma } from "@eoda/database";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireTeamManagerSession, type CabinetContext } from "@/lib/auth/guards";
import { CABINET_ROLES, CABINET_ROLE_LABELS, type CabinetRole } from "@/lib/auth/capabilities";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { firstError, requiredEmail, requiredString } from "@/lib/validation/form-parsers";
import { generateTemporaryPassword, hashPassword } from "@/lib/security/password-hashing";
import { sendCabinetInvitationEmail } from "@/lib/email/notifications";
import type { InvitationDelivery } from "@/lib/services/email-delivery-service";
import {
  countActiveAdmins,
  decideAccessRemoval,
  decideRoleChange,
  normalizeAssignments,
  parseCabinetRole,
  type TeamMemberFacts,
} from "@/lib/services/cabinet-team-service";

// ─────────────────────────────────────────────────────────────────────────────
// ÉQUIPE EODA — tranche N9. Toutes les actions passent par
// requireTeamManagerSession() (capacité TEAM_MANAGE : l'administration seule) ;
// les règles (soi-même, dernier administrateur, affectations) sont dans
// cabinet-team-service.ts, pur et testé. Les identifiants reçus (compte visé,
// structures suivies) sont relus DANS le tenant de l'appelant : un compte d'un autre
// cabinet est introuvable, une structure étrangère est ignorée.
//
// Le retrait d'accès DÉSACTIVE le compte (isActive) : jamais de suppression, le
// journal garde qui a fait quoi. Les gardes refusent un compte inactif à la requête
// suivante, session ouverte comprise.
// ─────────────────────────────────────────────────────────────────────────────

const TEAM_PATH = "/dashboard/cabinet/equipe";

export type CabinetTeamMember = {
  id: string;
  name: string;
  email: string;
  role: CabinetRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  assignedEstablishmentIds: string[];
};

export type CabinetTeam = {
  members: CabinetTeamMember[];
  establishments: { id: string; name: string }[];
  currentUserId: string;
};

async function loadTeamFacts(tenantId: string): Promise<TeamMemberFacts[]> {
  return prisma.user.findMany({
    where: { tenantId, role: { in: [...CABINET_ROLES] } },
    select: { id: true, role: true, isActive: true },
  });
}

export async function getCabinetTeam(): Promise<CabinetTeam> {
  const { tenantId, userId } = await requireTeamManagerSession();
  const [users, establishments] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId, role: { in: [...CABINET_ROLES] } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        establishmentAssignments: { select: { establishmentId: true } },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    prisma.establishment.findMany({ where: { tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const members = users.flatMap((user) => {
    const role = parseCabinetRole(user.role);
    if (!role) return [];
    return [
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        assignedEstablishmentIds: user.establishmentAssignments.map((a) => a.establishmentId),
      },
    ];
  });
  return { members, establishments, currentUserId: userId };
}

type MemberForm = { role: CabinetRole; establishmentIds: string[] };

async function parseMemberForm(
  formData: FormData,
  tenantId: string
): Promise<{ error: string } | MemberForm> {
  const role = parseCabinetRole(formData.get("role"));
  if (!role) return { error: "Choisissez un rôle." };
  const requested = formData.getAll("establishmentIds").filter((v): v is string => typeof v === "string");
  const tenantIds = (
    await prisma.establishment.findMany({ where: { tenantId }, select: { id: true } })
  ).map((e) => e.id);
  return { role, establishmentIds: normalizeAssignments(role, requested, tenantIds) };
}

async function replaceAssignments(context: CabinetContext, userId: string, establishmentIds: string[]): Promise<void> {
  await prisma.$transaction([
    prisma.establishmentAssignment.deleteMany({ where: { userId, tenantId: context.tenantId } }),
    prisma.establishmentAssignment.createMany({
      data: establishmentIds.map((establishmentId) => ({ tenantId: context.tenantId, establishmentId, userId })),
    }),
  ]);
}

export type InviteCabinetMemberResult =
  | { success: true; tempPassword: string; userName: string; userEmail: string; invitationDelivery: InvitationDelivery }
  | { error: string };

export async function inviteCabinetMember(formData: FormData): Promise<InviteCabinetMemberResult> {
  const context = await requireTeamManagerSession();
  const email = requiredEmail(formData, "email", "L'adresse e-mail");
  const name = requiredString(formData, "name", "Le nom", 120);
  const error = firstError(email, name);
  if (error) return { error };
  if (!email.ok || !name.ok) return { error: "Formulaire invalide." };

  const parsed = await parseMemberForm(formData, context.tenantId);
  if ("error" in parsed) return parsed;

  // Phrase unique, quel que soit le compte existant (client, autre cabinet) : pas
  // d'oracle d'existence sur les comptes des autres.
  const existing = await prisma.user.findUnique({ where: { email: email.value }, select: { id: true } });
  if (existing) return { error: "Cette adresse e-mail est déjà utilisée par un compte." };

  const tempPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(tempPassword);
  const created = await prisma.user.create({
    data: {
      email: email.value,
      name: name.value,
      passwordHash,
      role: parsed.role,
      tenantId: context.tenantId,
      mustChangePassword: true,
      passwordChangedAt: null,
    },
    select: { id: true },
  });
  if (parsed.establishmentIds.length > 0) await replaceAssignments(context, created.id, parsed.establishmentIds);

  await recordAuditEvent({
    action: "CABINET_USER_INVITED",
    actorUserId: context.userId,
    actorRole: context.role,
    targetId: created.id,
    detail: parsed.role,
  });

  // Hors transaction et après l'audit : un e-mail qui échoue n'annule pas le compte,
  // et l'écran dit ce qui s'est passé (SENT / NOT_CONFIGURED / FAILED).
  const invitationDelivery = await sendCabinetInvitationEmail({
    recipientName: name.value,
    email: email.value,
    temporaryPassword: tempPassword,
    roleLabel: CABINET_ROLE_LABELS[parsed.role].label,
  });
  return { success: true, tempPassword, userName: name.value, userEmail: email.value, invitationDelivery };
}

async function resolveMember(context: CabinetContext, targetId: unknown): Promise<TeamMemberFacts> {
  if (typeof targetId !== "string" || targetId.length === 0) notFound();
  const target = await prisma.user.findFirst({
    where: { id: targetId, tenantId: context.tenantId, role: { in: [...CABINET_ROLES] } },
    select: { id: true, role: true, isActive: true },
  });
  if (!target) notFound();
  return target;
}

export async function updateCabinetMember(formData: FormData): Promise<{ error: string } | null> {
  const context = await requireTeamManagerSession();
  const target = await resolveMember(context, formData.get("userId"));
  const parsed = await parseMemberForm(formData, context.tenantId);
  if ("error" in parsed) return parsed;

  const decision = decideRoleChange({
    actorId: context.userId,
    target,
    newRole: parsed.role,
    activeAdminCount: countActiveAdmins(await loadTeamFacts(context.tenantId)),
  });
  if (!decision.ok) return { error: decision.error };

  if (target.role !== parsed.role) {
    await prisma.user.update({ where: { id: target.id }, data: { role: parsed.role } });
    await recordAuditEvent({
      action: "CABINET_USER_ROLE_CHANGED",
      actorUserId: context.userId,
      actorRole: context.role,
      targetId: target.id,
      detail: `${target.role} → ${parsed.role}`,
    });
  }
  await replaceAssignments(context, target.id, parsed.establishmentIds);
  await recordAuditEvent({
    action: "CABINET_USER_ASSIGNMENTS_UPDATED",
    actorUserId: context.userId,
    actorRole: context.role,
    targetId: target.id,
    detail: `${parsed.establishmentIds.length} structure(s) suivie(s)`,
  });

  revalidatePath(TEAM_PATH);
  return null;
}

export async function removeCabinetMemberAccess(userId: string): Promise<{ error: string } | null> {
  const context = await requireTeamManagerSession();
  const target = await resolveMember(context, userId);
  const decision = decideAccessRemoval({
    actorId: context.userId,
    target,
    activeAdminCount: countActiveAdmins(await loadTeamFacts(context.tenantId)),
  });
  if (!decision.ok) return { error: decision.error };

  await prisma.user.update({ where: { id: target.id }, data: { isActive: false, deactivatedAt: new Date() } });
  await recordAuditEvent({
    action: "CABINET_USER_ACCESS_REMOVED",
    actorUserId: context.userId,
    actorRole: context.role,
    targetId: target.id,
    detail: target.role,
  });

  revalidatePath(TEAM_PATH);
  return null;
}
