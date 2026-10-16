import { prisma } from "@eoda/database";
import { appUrl } from "@/lib/config/app-url";
import { getEmailPort } from "./index";
import {
  countDeliveries,
  type InvitationDelivery,
} from "@/lib/services/email-delivery-service";
import {
  buildCabinetInvitationEmail,
  buildClientInvitationEmail,
  buildDocumentAvailableEmail,
  buildDocumentReminderEmail,
  buildNewMessageEmail,
  buildOptionRequestEmail,
  buildStructureActivityEmail,
  type DocumentAvailableKind,
  type StructureActivityKind,
} from "./templates";
import { buildEmailConfirmationEmail } from "./commercial-templates";
import { EMAIL_VERIFICATION_TTL_HOURS } from "@/lib/services/email-verification-service";
import { CABINET_ROLES } from "@/lib/auth/capabilities";
import { selectStructureRecipients } from "@/lib/services/cabinet-recipients-service";

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

// Base des liens envoyés par e-mail : lib/config/app-url.ts (partagée avec le QR code
// des quiz).

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
// Les interlocuteurs d'UN établissement : les comptes rattachés par le lien
// `EstablishmentUser`, et eux seuls — jamais une adresse saisie. Partagé par la
// relance, le fil d'échange et l'annonce d'un document validé : trois copies de ce
// filtre finiraient par ne plus exclure la même chose.
async function findClientRecipients(
  establishmentId: string
): Promise<{ name: string | null; email: string }[]> {
  const links = await prisma.establishmentUser.findMany({
    // `revokedAt: null` : un lien retiré par la direction ne reçoit plus rien (N9).
    // Sans ce filtre, la déduplication aurait réintroduit ici ce que la relance
    // excluait déjà — trois copies d'un filtre finissent par diverger.
    where: { establishmentId, revokedAt: null },
    select: { user: { select: { name: true, email: true, isActive: true } } },
  });
  // Un compte désactivé ne reçoit rien : sa désactivation est précisément la décision
  // de couper le lien.
  return links
    .map((link) => link.user)
    .filter((user) => user.isActive)
    .map(({ name, email }) => ({ name, email }));
}

export async function sendDocumentReminderEmails(input: {
  establishmentId: string;
  establishmentName: string;
  missingLabels: readonly string[];
  message: string | null;
}): Promise<{ sent: number; total: number; notConfigured: boolean }> {
  const recipients = await findClientRecipients(input.establishmentId);
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
      await findClientRecipients(input.establishmentId)
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

// Lien de confirmation d'adresse d'un compte libre-service (tranche 11). Même contrat
// que les invitations : jamais d'exception vers l'appelant. Ni l'adresse ni le lien ne
// sont journalisés — le lien EST la preuve de possession de l'adresse.
export async function sendEmailConfirmationEmail(input: {
  email: string;
  firstName: string | null;
  structureName: string | null;
  confirmationPath: string;
}): Promise<InvitationDelivery> {
  const content = buildEmailConfirmationEmail({
    firstName: input.firstName,
    structureName: input.structureName,
    confirmUrl: appUrl(input.confirmationPath),
    validityHours: EMAIL_VERIFICATION_TTL_HOURS,
    brand: { logoUrl: appUrl("/logo-eoda.png") },
  });
  try {
    return await getEmailPort().send({ to: input.email, subject: content.subject, html: content.html });
  } catch (error) {
    console.error("Confirmation d'adresse — e-mail non envoyé :", error instanceof Error ? error.message : "erreur inconnue");
    return "FAILED";
  }
}

// Document validé par la consultante → chaque interlocuteur de l'établissement est
// prévenu, avec l'intitulé du document (cf. `buildDocumentAvailableEmail`).
//
// Rend le nombre d'envois réussis, comme la relance : l'écran de validation doit
// pouvoir dire « 2 personnes prévenues » ou « aucun compte client à prévenir ».
export async function notifyDocumentAvailable(input: {
  establishmentId: string;
  establishmentName: string;
  documentLabel: string;
  kind: DocumentAvailableKind;
}): Promise<{ sent: number; total: number }> {
  const recipients = await findClientRecipients(input.establishmentId);
  if (recipients.length === 0) return { sent: 0, total: 0 };

  const portalUrl = appUrl(
    input.kind === "DELIVERABLE" ? "/dashboard/client/livrables" : "/dashboard/client"
  );
  const port = getEmailPort();
  const results = await Promise.allSettled(
    recipients.map((recipient) => {
      const content = buildDocumentAvailableEmail({
        recipientName: recipient.name ?? "Madame, Monsieur",
        establishmentName: input.establishmentName,
        documentLabel: input.documentLabel,
        kind: input.kind,
        portalUrl,
        brand: { logoUrl: appUrl("/logo-eoda.png") },
      });
      return port.send({ to: recipient.email, subject: content.subject, html: content.html });
    })
  );

  const sent = results.filter((result) => result.status === "fulfilled").length;
  if (sent < recipients.length) {
    console.error(
      `Annonce de document validé — ${recipients.length - sent}/${recipients.length} envoi(s) échoué(s).`
    );
  }
  return { sent, total: recipients.length };
}

// Ce que la STRUCTURE vient de faire → le cabinet (16/10/2026).
//
// Le pendant cabinet de `notifyDocumentAvailable`, et le chaînon manquant : un dépôt
// de la structure, une acceptation, un « je ne l'ai pas » ne se voyaient que dans la
// plateforme, en rouvrant la fiche — donc jamais le jour même. Les deux parties
// suivent désormais la même conversation, chacune de son côté.
//
// Destinataires : les comptes du cabinet qui SUIVENT cette structure, résolus par le
// périmètre déjà en vigueur (`selectStructureRecipients` — consultante affectée,
// lecture seule, administrateur ; jamais un commercial, qui ne voit pas les
// documents d'une structure) et lus en base par le tenant de l'ÉTABLISSEMENT — jamais
// un tenant reçu en argument, jamais une adresse saisie.
//
// Ce qui décide de l'envoi n'est pas ici : l'appelant n'appelle cette fonction que du
// côté CLIENT. Un dépôt du cabinet ne s'annonce pas à lui-même, et « il arrive » ne
// commande rien à personne.
//
// Elle ne fait jamais échouer le geste (règle en tête de fichier) : le dépôt est
// enregistré, l'acceptation est posée, et si la messagerie est indisponible
// l'appelant reçoit {sent:0,total:0}. Cela compte d'autant plus ici que le geste vient
// d'un CLIENT : lui rendre une erreur parce qu'un e-mail n'est pas parti serait
// absurde.
export async function notifyStructureActivity(input: {
  establishmentId: string;
  documentLabel: string;
  kind: StructureActivityKind;
}): Promise<{ sent: number; total: number }> {
  try {
    // Le tenant vient de la STRUCTURE, pas d'un argument : un tenant reçu d'un
    // appelant serait une seconde source pour la même vérité.
    const establishment = await prisma.establishment.findUnique({
      where: { id: input.establishmentId },
      select: { name: true, tenantId: true },
    });
    if (!establishment) return { sent: 0, total: 0 };

    const candidates = await prisma.user.findMany({
      where: {
        tenantId: establishment.tenantId,
        isActive: true,
        // Les rôles cabinet seulement : un compte client du même tenant (il n'en
        // existe pas aujourd'hui, il en existera) ne reçoit pas l'activité des autres.
        role: { in: [...CABINET_ROLES] },
      },
      select: {
        name: true,
        email: true,
        role: true,
        isActive: true,
        establishmentAssignments: { select: { establishmentId: true } },
      },
    });

    const recipients = selectStructureRecipients(
      candidates.map((candidate) => ({
        name: candidate.name,
        email: candidate.email,
        role: candidate.role,
        isActive: candidate.isActive,
        assignedEstablishmentIds: candidate.establishmentAssignments.map(
          (assignment) => assignment.establishmentId
        ),
      })),
      input.establishmentId
    );
    if (recipients.length === 0) return { sent: 0, total: 0 };

    const structureUrl = appUrl(`/dashboard/cabinet/etablissements/${input.establishmentId}`);
    const port = getEmailPort();
    const results = await Promise.allSettled(
      recipients.map((recipient) => {
        const content = buildStructureActivityEmail({
          kind: input.kind,
          establishmentName: establishment.name,
          documentLabel: input.documentLabel,
          structureUrl,
          brand: { logoUrl: appUrl("/logo-eoda.png") },
        });
        return port.send({ to: recipient.email, subject: content.subject, html: content.html });
      })
    );

    const { sent, failed } = countDeliveries(results);
    if (failed > 0) {
      // Ni adresse ni nom dans le journal technique, comme partout : un envoi échoué
      // se diagnostique par son nombre.
      console.error(
        `Activité de la structure — ${failed}/${recipients.length} envoi(s) échoué(s).`
      );
    }
    return { sent, total: recipients.length };
  } catch (error) {
    console.error(
      "Activité de la structure — envoi impossible :",
      error instanceof Error ? error.message : "erreur inconnue"
    );
    return { sent: 0, total: 0 };
  }
}
