"use server";

import { prisma, Prisma } from "@eoda/database";
import { headers } from "next/headers";
import { consumeThrottledAttempt } from "@/lib/security/attempt-throttle";
import { clientIpFromHeaders } from "@/lib/security/login-throttle";
import { hashPassword } from "@/lib/security/password-hashing";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { getEmailPort } from "@/lib/email";
import { buildSelfServiceExistingAccountEmail, buildSelfServiceWelcomeEmail } from "@/lib/email/commercial-templates";
import { appUrl } from "@/lib/config/app-url";
import {
  resolveSignupTenant,
  SIGNUP_CLOSED_MESSAGE,
  SIGNUP_EMAIL_RATE_LIMIT,
  SIGNUP_IP_RATE_LIMIT,
  SIGNUP_NEUTRAL_MESSAGE,
  SIGNUP_RATE_LIMITED_MESSAGE,
  signupThrottleKeys,
  validateSignupInput,
  type SignupInput,
} from "@/lib/services/self-service-service";

// ─────────────────────────────────────────────────────────────────────────────
// INSCRIPTION EN LIBRE-SERVICE — route PUBLIQUE (D5, 13/10/2026).
//
// Toute entrée non authentifiée est hostile (S8) : limitation de débit sur l'IP ET
// sur l'adresse demandée, validation stricte des trois étapes côté serveur, aucune
// énumération des comptes (même réponse que l'adresse existe ou non, même coût bcrypt
// dans les deux cas). Ce qui est créé : un PROSPECT (canal LIBRE_SERVICE) et un
// compte PROSPECT_USER rattaché — JAMAIS un établissement (CLAUDE.md §7 : une fiche
// ne naît que de la signature d'un devis).
// ─────────────────────────────────────────────────────────────────────────────

export type SignupState = { status: "IDLE" } | { status: "ERROR"; error: string } | { status: "DONE"; message: string };

const BRAND = () => ({ logoUrl: appUrl("/logo-eoda.png") });

async function sendQuietly(to: string, content: { subject: string; html: string }): Promise<void> {
  try {
    await getEmailPort().send({ to, subject: content.subject, html: content.html });
  } catch (error) {
    // L'inscription est faite (ou refusée sans le dire) : un e-mail manqué ne la défait
    // pas. L'adresse n'est pas journalisée.
    console.error("Inscription libre-service — e-mail non envoyé :", error);
  }
}

async function createSelfServiceProspect(tenantId: string, input: SignupInput, passwordHash: string): Promise<string | null> {
  try {
    return await prisma.$transaction(async (tx) => {
      const prospect = await tx.prospect.create({
        data: {
          tenantId,
          structureName: input.structureName,
          structureType: input.structureType,
          establishmentType: input.establishmentType,
          finessNumber: input.finessNumber,
          envisagedFormule: input.formule,
          channel: "LIBRE_SERVICE",
          contactName: input.firstName,
          contactEmail: input.email,
          firstContactDate: new Date(),
        },
        select: { id: true },
      });
      const user = await tx.user.create({
        data: {
          email: input.email,
          name: input.firstName,
          passwordHash,
          role: "PROSPECT_USER",
          // Le mot de passe a été CHOISI par la personne : aucune rotation imposée.
          mustChangePassword: false,
          tenantId: null,
        },
        select: { id: true },
      });
      await tx.prospectAccount.create({ data: { prospectId: prospect.id, userId: user.id } });
      return prospect.id;
    });
  } catch (error) {
    // Course sur l'unicité de l'e-mail : traité comme « compte existant ».
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null;
    throw error;
  }
}

export async function signUpSelfService(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const fields = Object.fromEntries(
    ["structureName", "structureType", "establishmentType", "finessNumber", "formule", "firstName", "email", "password"].map(
      (name) => [name, formData.get(name)]
    )
  );
  const ip = clientIpFromHeaders(await headers());
  const emailForKey = typeof fields.email === "string" ? fields.email : "";
  const keys = signupThrottleKeys(ip, emailForKey);
  const allowed =
    (await consumeThrottledAttempt({ key: keys.ip, policy: SIGNUP_IP_RATE_LIMIT, auditAction: "SELF_SERVICE_SIGNUP_RATE_LIMITED" })) &&
    (await consumeThrottledAttempt({ key: keys.email, policy: SIGNUP_EMAIL_RATE_LIMIT, auditAction: "SELF_SERVICE_SIGNUP_RATE_LIMITED" }));
  if (!allowed) return { status: "ERROR", error: SIGNUP_RATE_LIMITED_MESSAGE };

  const checked = validateSignupInput(fields);
  if (!checked.ok) return { status: "ERROR", error: checked.error };
  const input = checked.value;

  const tenants = await prisma.tenant.findMany({ take: 2, select: { id: true } });
  const tenantId = resolveSignupTenant(tenants.map((t) => t.id));
  if (!tenantId) return { status: "ERROR", error: SIGNUP_CLOSED_MESSAGE };

  // Empreinte calculée AVANT de savoir si l'adresse existe : même coût dans les deux
  // branches, la latence ne dit rien du compte.
  const passwordHash = await hashPassword(input.password);
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  const prospectId = existing ? null : await createSelfServiceProspect(tenantId, input, passwordHash);

  const loginUrl = appUrl("/login");
  if (prospectId) {
    await recordAuditEvent({ action: "SELF_SERVICE_SIGNUP", actorRole: "PROSPECT_USER", targetId: prospectId, detail: input.formule });
    await sendQuietly(input.email, buildSelfServiceWelcomeEmail({ firstName: input.firstName, structureName: input.structureName, loginUrl, brand: BRAND() }));
  } else {
    await sendQuietly(input.email, buildSelfServiceExistingAccountEmail({ loginUrl, brand: BRAND() }));
  }

  return { status: "DONE", message: SIGNUP_NEUTRAL_MESSAGE };
}
