"use server";

import { prisma, Prisma } from "@eoda/database";
import { headers } from "next/headers";
import { after } from "next/server";
import { consumeThrottledAttempt } from "@/lib/security/attempt-throttle";
import { clientIpFromHeaders } from "@/lib/security/login-throttle";
import { hashPassword } from "@/lib/security/password-hashing";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { getEmailPort } from "@/lib/email";
import { buildSelfServiceExistingAccountEmail } from "@/lib/email/commercial-templates";
import { sendEmailConfirmationEmail } from "@/lib/email/notifications";
import { appUrl } from "@/lib/config/app-url";
import { getEnv } from "@/lib/config/env";
import { issueEmailVerificationToken } from "@/lib/db/email-verification-tokens";
import {
  confirmationLinkDisclosure,
  confirmationPathFor,
  type LinkDisclosure,
} from "@/lib/services/email-verification-service";
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
// ne naît que de la signature d'un devis). Le compte n'ouvre rien tant que l'adresse
// n'est pas CONFIRMÉE par le lien reçu (tranche 11, email-verification-service.ts).
// ─────────────────────────────────────────────────────────────────────────────

export type SignupState =
  | { status: "IDLE" }
  | { status: "ERROR"; error: string }
  | { status: "DONE"; message: string; email: string; disclosure: LinkDisclosure };

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

type CreatedSignup = { prospectId: string; userId: string; token: string };

async function createSelfServiceProspect(tenantId: string, input: SignupInput, passwordHash: string): Promise<CreatedSignup | null> {
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
          // Adresse NON confirmée : le compte n'ouvre rien avant le clic sur le lien.
          emailVerifiedAt: null,
        },
        select: { id: true },
      });
      await tx.prospectAccount.create({ data: { prospectId: prospect.id, userId: user.id } });
      const token = await issueEmailVerificationToken(tx, user.id, new Date());
      return { prospectId: prospect.id, userId: user.id, token };
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
  const env = getEnv();
  const finish = existing ? () => notifyExistingAccount(input.email) : () => completeNewSignup(tenantId, input, passwordHash);

  // FUITE DE DURÉE (recette du 14/10) : créer le compte et envoyer l'e-mail prenait
  // plus longtemps qu'avertir le titulaire d'un compte existant — la latence disait
  // si l'adresse avait un compte. Les deux branches répondent donc AVANT leur travail
  // lourd, déféré par `after()` : même chemin synchrone, même réponse.
  // Seule exception : le développement local sans service d'e-mail, où le lien de
  // confirmation doit s'afficher à l'écran (jamais en production).
  if (shouldDiscloseLinkInline(env)) {
    const confirmationPath = (await finish()) ?? null;
    return signupDone(input.email, env, confirmationPath);
  }
  after(() => runQuietly(finish));
  return signupDone(input.email, env, null);
}

function shouldDiscloseLinkInline(env: { isDevelopment: boolean; resend: unknown }): boolean {
  return env.isDevelopment && env.resend === null;
}

function signupDone(email: string, env: { isDevelopment: boolean; resend: unknown }, confirmationPath: string | null): SignupState {
  return {
    status: "DONE",
    message: SIGNUP_NEUTRAL_MESSAGE,
    email,
    disclosure: confirmationLinkDisclosure({ isDevelopment: env.isDevelopment, isEmailConfigured: env.resend !== null, confirmationPath }),
  };
}

// Travail déféré : une erreur ici n'a plus de requête à faire échouer — elle est
// journalisée, jamais avalée en silence.
async function runQuietly(work: () => Promise<unknown>): Promise<void> {
  try {
    await work();
  } catch (error) {
    console.error("[EODA] Inscription libre-service : travail différé en échec", error);
  }
}

async function notifyExistingAccount(email: string): Promise<null> {
  await sendQuietly(email, buildSelfServiceExistingAccountEmail({ loginUrl: appUrl("/login"), brand: BRAND() }));
  return null;
}

async function completeNewSignup(tenantId: string, input: SignupInput, passwordHash: string): Promise<string | null> {
  const created = await createSelfServiceProspect(tenantId, input, passwordHash);
  if (!created) return null;
  const confirmationPath = confirmationPathFor(created.token);
  await recordAuditEvent({ action: "SELF_SERVICE_SIGNUP", actorRole: "PROSPECT_USER", targetId: created.prospectId, detail: input.formule });
  await sendEmailConfirmationEmail({
    email: input.email,
    firstName: input.firstName,
    structureName: input.structureName,
    confirmationPath,
  });
  await recordAuditEvent({ action: "EMAIL_VERIFICATION_SENT", actorUserId: created.userId, targetId: created.userId, detail: "inscription" });
  return confirmationPath;
}
