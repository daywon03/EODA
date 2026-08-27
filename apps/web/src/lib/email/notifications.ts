import { prisma } from "@eoda/database";
import { getEnv } from "@/lib/config/env";
import { getEmailPort } from "./index";
import { buildClientInvitationEmail, buildOptionRequestEmail } from "./templates";

// ─────────────────────────────────────────────────────────────────────────────
// ENVOI DES NOTIFICATIONS — la couche qui a le droit de parler au monde extérieur.
//
// Une règle traverse ce fichier : **un envoi d'e-mail ne fait jamais échouer
// l'action métier**. Le compte client est créé, la demande d'option est
// enregistrée ; si la messagerie est indisponible, on le SIGNALE à l'appelant et le
// travail reste fait. L'inverse — perdre un compte parce qu'un SMTP a hoqueté —
// serait une régression déguisée en robustesse.
//
// L'appelant reçoit donc un booléen, pas une exception, et l'écran dit la vérité :
// « mot de passe envoyé par e-mail » ou « e-mail non parti, communiquez-le
// vous-même ».
// ─────────────────────────────────────────────────────────────────────────────

// Base des liens envoyés par e-mail. En production, `NEXTAUTH_URL` est exigée par le
// profil de démarrage : un lien relatif dans un e-mail ne mène nulle part.
function appUrl(path: string): string {
  const base = getEnv().nextAuthUrl ?? "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}${path}`;
}

export async function sendClientInvitationEmail(input: {
  recipientName: string;
  email: string;
  temporaryPassword: string;
  establishmentName: string;
}): Promise<boolean> {
  const content = buildClientInvitationEmail({
    recipientName: input.recipientName,
    email: input.email,
    temporaryPassword: input.temporaryPassword,
    establishmentName: input.establishmentName,
    loginUrl: appUrl("/login"),
  });

  try {
    await getEmailPort().send({ to: input.email, subject: content.subject, html: content.html });
    return true;
  } catch (error) {
    // Le mot de passe temporaire n'est JAMAIS journalisé, même en cas d'échec : il
    // est encore affiché à l'écran, c'est là qu'il doit être lu.
    console.error("Invitation client — envoi d'e-mail échoué, compte créé malgré tout :", error);
    return false;
  }
}

// Alerte interne sur demande de prestation complémentaire.
//
// Destinataires : les comptes CABINET_ADMIN du tenant, lus en base. Pas d'adresse en
// dur ni de variable d'environnement de plus — le jour où EODA recrute, la personne
// reçoit les alertes parce qu'elle a un compte, pas parce qu'on a pensé à modifier la
// configuration.
export async function notifyOptionRequest(input: {
  tenantId: string;
  establishmentName: string;
  optionLabel: string;
  message: string | null;
  requestedByName: string;
}): Promise<boolean> {
  const admins = await prisma.user.findMany({
    where: { tenantId: input.tenantId, role: "CABINET_ADMIN", isActive: true },
    select: { email: true },
  });
  if (admins.length === 0) return false;

  const content = buildOptionRequestEmail({
    establishmentName: input.establishmentName,
    optionLabel: input.optionLabel,
    message: input.message,
    requestedByName: input.requestedByName,
    requestUrl: appUrl("/dashboard/cabinet/commercial"),
  });

  const port = getEmailPort();
  const results = await Promise.allSettled(
    admins.map((admin) => port.send({ to: admin.email, subject: content.subject, html: content.html }))
  );

  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length > 0) {
    console.error(
      `Alerte demande d'option — ${failures.length}/${admins.length} envoi(s) échoué(s).`
    );
  }
  return failures.length < admins.length;
}
