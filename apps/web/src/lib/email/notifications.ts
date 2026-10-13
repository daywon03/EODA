import { prisma } from "@eoda/database";
import { getEnv } from "@/lib/config/env";
import { getEmailPort } from "./index";
import {
  countDeliveries,
  type InvitationDelivery,
} from "@/lib/services/email-delivery-service";
import {
  buildCabinetInvitationEmail,
  buildClientInvitationEmail,
  buildDocumentReminderEmail,
  buildNewMessageEmail,
  buildOptionRequestEmail,
} from "./templates";

// ─────────────────────────────────────────────────────────────────────────────
// ENVOI DES NOTIFICATIONS — la couche qui a le droit de parler au monde extérieur.
//
// Une règle traverse ce fichier : **un envoi d'e-mail ne fait jamais échouer
// l'action métier**. Le compte client est créé, la demande d'option est
// enregistrée ; si la messagerie est indisponible, on le SIGNALE à l'appelant et le
// travail reste fait. L'inverse — perdre un compte parce qu'un SMTP a hoqueté —
// serait une régression déguisée en robustesse.
//
// L'appelant reçoit donc un état d'envoi, pas une exception, et l'écran dit la
// vérité : « mot de passe envoyé par e-mail », « e-mail non envoyé en local » ou
// « e-mail non parti, communiquez-le vous-même ». Un envoi NON CONFIGURÉ
// (adaptateur console) ne compte jamais comme un envoi réussi.
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
}): Promise<InvitationDelivery> {
  const content = buildClientInvitationEmail({
    recipientName: input.recipientName,
    email: input.email,
    temporaryPassword: input.temporaryPassword,
    establishmentName: input.establishmentName,
    loginUrl: appUrl("/login"),
    brand: { logoUrl: appUrl("/logo-eoda.png") },
  });

  try {
    return await getEmailPort().send({
      to: input.email,
      subject: content.subject,
      html: content.html,
    });
  } catch (error) {
    // Le mot de passe temporaire n'est JAMAIS journalisé, même en cas d'échec : il
    // est encore affiché à l'écran, c'est là qu'il doit être lu.
    console.error("Invitation client — envoi d'e-mail échoué, compte créé malgré tout :", error);
    return "FAILED";
  }
}

// Invitation d'une personne dans l'équipe EODA (N9). Même contrat que l'invitation
// client : jamais d'exception vers l'appelant, le résultat d'envoi est RENDU pour
// que l'écran dise si le mot de passe doit être transmis autrement.
export async function sendCabinetInvitationEmail(input: {
  recipientName: string;
  email: string;
  temporaryPassword: string;
  roleLabel: string;
}): Promise<InvitationDelivery> {
  const content = buildCabinetInvitationEmail({
    ...input,
    loginUrl: appUrl("/login"),
    brand: { logoUrl: appUrl("/logo-eoda.png") },
  });
  try {
    return await getEmailPort().send({ to: input.email, subject: content.subject, html: content.html });
  } catch (error) {
    console.error("Invitation équipe EODA — envoi d'e-mail échoué, compte créé malgré tout :", error);
    return "FAILED";
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
    brand: { logoUrl: appUrl("/logo-eoda.png") },
  });

  const port = getEmailPort();
  const results = await Promise.allSettled(
    admins.map((admin) => port.send({ to: admin.email, subject: content.subject, html: content.html }))
  );

  const { sent, failed } = countDeliveries(results);
  if (failed > 0) {
    console.error(`Alerte demande d'option — ${failed}/${admins.length} envoi(s) échoué(s).`);
  }
  return sent > 0;
}

// Relance des pièces manquantes, vers les interlocuteurs du client.
//
// Destinataires lus en base depuis le lien `EstablishmentUser` : on ne relance que
// des comptes réellement rattachés à CET établissement, et jamais une adresse saisie
// à la main dans un formulaire — ce serait le meilleur moyen d'envoyer la liste des
// manques d'une structure à quelqu'un d'autre.
//
// Rend le nombre d'envois réussis : l'écran doit pouvoir dire « relance envoyée à
// 2 personnes » ou « aucune adresse joignable », jamais un succès muet.
export async function sendDocumentReminderEmails(input: {
  establishmentId: string;
  establishmentName: string;
  missingLabels: readonly string[];
  message: string | null;
}): Promise<{ sent: number; total: number; notConfigured: boolean }> {
  const links = await prisma.establishmentUser.findMany({
    where: { establishmentId: input.establishmentId },
    select: { user: { select: { name: true, email: true, isActive: true } } },
  });
  // Un compte désactivé ne reçoit rien : sa désactivation est précisément la décision
  // de couper le lien.
  const recipients = links.map((link) => link.user).filter((user) => user.isActive);
  if (recipients.length === 0) return { sent: 0, total: 0, notConfigured: false };

  const port = getEmailPort();
  const results = await Promise.allSettled(
    recipients.map((recipient) => {
      const content = buildDocumentReminderEmail({
        recipientName: recipient.name ?? "Madame, Monsieur",
        establishmentName: input.establishmentName,
        missingLabels: input.missingLabels,
        message: input.message,
        portalUrl: appUrl("/dashboard/client"),
        brand: { logoUrl: appUrl("/logo-eoda.png") },
      });
      return port.send({ to: recipient.email, subject: content.subject, html: content.html });
    })
  );

  const { sent, notConfigured, failed } = countDeliveries(results);
  if (failed > 0) {
    // Ni adresse ni nom dans le journal technique : un envoi échoué se diagnostique
    // par son nombre, pas par la liste de ses destinataires.
    console.error(
      `Relance documentaire — ${failed}/${recipients.length} envoi(s) échoué(s).`
    );
  }

  return { sent, total: recipients.length, notConfigured: notConfigured > 0 };
}

// Nouveau message dans le fil d'échange : on prévient l'AUTRE côté.
//
// Le contenu du message ne part pas par e-mail (cf. `buildNewMessageEmail`) : le fil
// existe pour garder les échanges dans la plateforme. L'e-mail sert uniquement à
// faire revenir quelqu'un.
export async function notifyNewMessage(input: {
  tenantId: string;
  establishmentId: string;
  establishmentName: string;
  authorSide: "CABINET" | "CLIENT";
}): Promise<boolean> {
  const fromCabinet = input.authorSide === "CABINET";

  const recipients = fromCabinet
    ? // Message du cabinet → les interlocuteurs de CET établissement, lus par le lien
      // EstablishmentUser (jamais une adresse saisie).
      (
        await prisma.establishmentUser.findMany({
          where: { establishmentId: input.establishmentId },
          select: { user: { select: { email: true, isActive: true } } },
        })
      )
        .map((link) => link.user)
        .filter((user) => user.isActive)
    : // Message du client → les comptes CABINET_ADMIN du tenant. Même choix que les
      // demandes d'option : la personne reçoit les alertes parce qu'elle a un compte,
      // pas parce qu'on a pensé à modifier une variable d'environnement.
      await prisma.user.findMany({
        where: { tenantId: input.tenantId, role: "CABINET_ADMIN", isActive: true },
        select: { email: true, isActive: true },
      });

  if (recipients.length === 0) return false;

  const content = buildNewMessageEmail({
    establishmentName: input.establishmentName,
    fromCabinet,
    threadUrl: appUrl(
      fromCabinet
        ? "/dashboard/client/echanges"
        : `/dashboard/cabinet/etablissements/${input.establishmentId}/echanges`
    ),
    brand: { logoUrl: appUrl("/logo-eoda.png") },
  });

  const port = getEmailPort();
  const results = await Promise.allSettled(
    recipients.map((recipient) =>
      port.send({ to: recipient.email, subject: content.subject, html: content.html })
    )
  );

  const { sent, failed } = countDeliveries(results);
  if (failed > 0) {
    console.error(`Notification de message — ${failed}/${recipients.length} envoi(s) échoué(s).`);
  }
  return sent > 0;
}
