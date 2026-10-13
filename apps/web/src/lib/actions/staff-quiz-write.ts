"use server";

import { prisma } from "@eoda/database";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireEstablishmentAccess, type EstablishmentAccessContext } from "@/lib/auth/guards";
import { NEED } from "@/lib/auth/capabilities";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { canDepositDocuments } from "@/lib/services/mission-access-service";
import { firstError, optionalString, requiredString } from "@/lib/validation/form-parsers";
import { findQuizModule, QUIZ_MODULES } from "@/content/quiz";
import { describeImportResult, planStaffImport } from "@/lib/services/staff-import-service";
import { buildSignoffCsv } from "@/lib/services/quiz-signoff-service";
import { buildEodaFileName } from "@/lib/services/document-naming-service";
import { qrPathData } from "@/lib/services/quiz-qr-service";
import { appUrl } from "@/lib/config/app-url";
import { generateQuizToken, hashQuizToken, quizInvitationExpiry } from "@/lib/security/quiz-token";

// ─────────────────────────────────────────────────────────────────────────────
// ÉQUIPE ET QUIZ — ÉCRITURES (N10). Garde : requireEstablishmentAccess(id,
// TEAM_WRITE) ; un intervenant (OWN) n'ajoute personne et n'envoie aucun quiz ; une
// structure dont l'accompagnement est clos n'écrit plus. Journalisé, sans nom dans
// le détail.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_IMPORT_BYTES = 100_000;
type Result = { error: string } | null;

function paths(establishmentId: string): void {
  revalidatePath(`/dashboard/cabinet/etablissements/${establishmentId}/equipe`);
  revalidatePath("/dashboard/client/equipe");
}

async function requireTeamWriter(establishmentId: unknown): Promise<EstablishmentAccessContext | { error: string }> {
  if (typeof establishmentId !== "string" || establishmentId.length === 0) notFound();
  const access = await requireEstablishmentAccess(establishmentId, NEED.TEAM_WRITE);
  if (access.ownOnly) return { error: "Votre accès ne permet pas de gérer l'équipe." };
  if (access.isClient && !canDepositDocuments(access.missionAccess)) {
    return { error: "Votre accompagnement est clos : l'équipe est en lecture seule." };
  }
  return access;
}

async function tenantOf(establishmentId: string): Promise<string> {
  const row = await prisma.establishment.findUniqueOrThrow({ where: { id: establishmentId }, select: { tenantId: true } });
  return row.tenantId;
}

export async function addStaffMember(formData: FormData): Promise<Result> {
  const access = await requireTeamWriter(formData.get("establishmentId"));
  if ("error" in access) return access;
  const name = requiredString(formData, "displayName", "Le nom", 120);
  const job = requiredString(formData, "jobTitle", "Le métier", 120);
  const email = optionalString(formData, "email", "L'e-mail", 200);
  const phone = optionalString(formData, "phone", "Le téléphone", 30);
  const error = firstError(name, job, email, phone);
  if (error) return { error };
  if (!name.ok || !job.ok || !email.ok || !phone.ok) return { error: "Formulaire invalide." };

  const created = await prisma.staffMember.create({
    data: {
      tenantId: await tenantOf(access.establishmentId),
      establishmentId: access.establishmentId,
      displayName: name.value,
      jobTitle: job.value,
      email: email.value,
      phone: phone.value,
    },
    select: { id: true },
  });
  await recordAuditEvent({
    action: "STAFF_MEMBER_CREATED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId: access.establishmentId,
    targetId: created.id,
  });
  paths(access.establishmentId);
  return null;
}

export async function importStaffMembers(formData: FormData): Promise<{ error: string } | { message: string }> {
  const access = await requireTeamWriter(formData.get("establishmentId"));
  if ("error" in access) return access;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisissez un fichier CSV." };
  if (file.size > MAX_IMPORT_BYTES) return { error: "Fichier trop gros (100 Ko au plus)." };

  const existing = await prisma.staffMember.findMany({
    where: { establishmentId: access.establishmentId, active: true },
    select: { displayName: true },
  });
  const plan = planStaffImport(await file.text(), existing.map((e) => e.displayName));
  if (plan.rows.length > 0) {
    const tenantId = await tenantOf(access.establishmentId);
    await prisma.staffMember.createMany({
      data: plan.rows.map((row) => ({ ...row, tenantId, establishmentId: access.establishmentId })),
    });
    await recordAuditEvent({
      action: "STAFF_MEMBERS_IMPORTED",
      actorUserId: access.userId,
      actorRole: access.session.user.role,
      establishmentId: access.establishmentId,
      detail: `${plan.rows.length} ligne(s) importée(s), ${plan.issues.length} refusée(s)`,
    });
    paths(access.establishmentId);
  }
  return { message: describeImportResult(plan.rows.length, plan.issues) };
}

// Départ d'une personne : la fiche reste (ses quiz réussis sont une preuve), elle
// sort de la matrice.
export async function markStaffMemberLeft(establishmentId: string, staffMemberId: string): Promise<Result> {
  const access = await requireTeamWriter(establishmentId);
  if ("error" in access) return access;
  const staff = await prisma.staffMember.findFirst({
    where: { id: staffMemberId, establishmentId: access.establishmentId, active: true },
    select: { id: true },
  });
  if (!staff) notFound();
  await prisma.staffMember.update({ where: { id: staff.id }, data: { active: false, leftAt: new Date() } });
  await recordAuditEvent({
    action: "STAFF_MEMBER_UPDATED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId: access.establishmentId,
    targetId: staff.id,
    detail: "départ",
  });
  paths(access.establishmentId);
  return null;
}

export type CampaignInvitationView = {
  staffName: string;
  url: string;
  qr: { size: number; d: string };
  expiresAt: Date;
};

// « Envoyer un quiz » : une campagne, une invitation personnelle par salarié. Les
// jetons sont rendus EN CLAIR une seule fois, pour être imprimés ou montrés ; seule
// leur empreinte est écrite. Pas de SMS (décision 8).
export async function sendQuizCampaign(
  formData: FormData
): Promise<{ error: string } | { moduleTitle: string; invitations: CampaignInvitationView[] }> {
  const access = await requireTeamWriter(formData.get("establishmentId"));
  if ("error" in access) return access;
  const moduleCode = formData.get("moduleCode");
  const quiz = typeof moduleCode === "string" ? findQuizModule(moduleCode) : null;
  if (!quiz) return { error: "Choisissez un quiz." };
  const requested = formData.getAll("staffMemberIds").filter((v): v is string => typeof v === "string");
  if (requested.length === 0) return { error: "Choisissez au moins une personne." };

  // Les identifiants reçus sont relus DANS la structure gardée : un salarié d'une
  // autre structure est simplement ignoré.
  const staff = await prisma.staffMember.findMany({
    where: { id: { in: requested }, establishmentId: access.establishmentId, active: true },
    select: { id: true, displayName: true },
    orderBy: { displayName: "asc" },
  });
  if (staff.length === 0) return { error: "Aucune des personnes choisies n'est dans l'équipe." };

  const now = new Date();
  const expiresAt = quizInvitationExpiry(now);
  const tokens = staff.map((member) => ({ member, token: generateQuizToken() }));
  const tenantId = await tenantOf(access.establishmentId);
  const campaign = await prisma.$transaction(async (tx) => {
    const created = await tx.quizCampaign.create({
      data: {
        tenantId,
        establishmentId: access.establishmentId,
        moduleCode: quiz.code,
        moduleVersion: quiz.version,
        sentByUserId: access.userId,
      },
      select: { id: true },
    });
    await tx.quizInvitation.createMany({
      data: tokens.map(({ member, token }) => ({
        campaignId: created.id,
        staffMemberId: member.id,
        tokenHash: hashQuizToken(token),
        expiresAt,
      })),
    });
    return created;
  });

  await recordAuditEvent({
    action: "QUIZ_CAMPAIGN_SENT",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId: access.establishmentId,
    targetId: campaign.id,
    detail: `${quiz.code} v${quiz.version} · ${staff.length} invitation(s)`,
  });
  paths(access.establishmentId);

  return {
    moduleTitle: quiz.title,
    invitations: tokens.map(({ member, token }) => {
      const url = appUrl(`/quiz/${token}`);
      return { staffName: member.displayName, url, qr: qrPathData(url), expiresAt };
    }),
  };
}

// « Exporter l'émargement » : CSV des tentatives RÉUSSIES (preuve de
// sensibilisation). Lecture, mais journalisée : les données SORTENT de la plateforme.
export async function exportQuizSignoff(
  establishmentId: string
): Promise<{ fileName: string; content: string }> {
  const access = await requireEstablishmentAccess(establishmentId, NEED.TEAM_READ);
  const [establishment, attempts] = await Promise.all([
    prisma.establishment.findUniqueOrThrow({ where: { id: access.establishmentId }, select: { name: true } }),
    prisma.quizAttempt.findMany({
      where: {
        establishmentId: access.establishmentId,
        passed: true,
        ...(access.ownOnly ? { staffMember: { userId: access.userId } } : {}),
      },
      select: {
        moduleCode: true,
        moduleVersion: true,
        score: true,
        total: true,
        completedAt: true,
        staffMember: { select: { displayName: true, jobTitle: true } },
      },
    }),
  ]);
  const titles = new Map<string, string>(QUIZ_MODULES.map((m) => [m.code, m.title]));
  const content = buildSignoffCsv(
    attempts.map((a) => ({
      displayName: a.staffMember.displayName,
      jobTitle: a.staffMember.jobTitle,
      moduleTitle: titles.get(a.moduleCode) ?? a.moduleCode,
      moduleVersion: a.moduleVersion,
      score: a.score,
      total: a.total,
      completedAt: a.completedAt,
    }))
  );
  await recordAuditEvent({
    action: "QUIZ_SIGNOFF_EXPORTED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId: access.establishmentId,
    detail: `${attempts.length} réussite(s)`,
  });
  const fileName = buildEodaFileName({
    issuedOn: new Date(),
    type: "EMARGEMENT",
    clientName: establishment.name,
    objet: "Sensibilisation-quiz",
    audience: "Externe",
    extension: "csv",
  });
  return { fileName, content };
}
