"use server";

import { prisma } from "@eoda/database";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireCommercialSession } from "@/lib/auth/guards";
import { getEmailPort, type EmailDelivery } from "@/lib/email";
import { buildDevisEmail } from "@/lib/email/templates";
import { buildDevisReminderEmail } from "@/lib/email/commercial-templates";
import { appUrl } from "@/lib/config/app-url";
import { devisEmailNotSentMessage, reminderNotSentMessage } from "@/lib/services/email-delivery-service";
import { devisPdfFailureMessage } from "@/lib/services/devis-pdf-failure";
import { renderDevisPdf } from "@/lib/services/devis-pdf-service";
import { buildDevisFileName } from "@/lib/services/devis-sharing-service";
import { canRemindDevis } from "@/lib/services/devis-recap-service";
import { recordAuditEvent } from "@/lib/services/audit-log-service";

// ─────────────────────────────────────────────────────────────────────────────
// E-MAILS D'UN DEVIS — envoi (PDF joint) et relance (maquette v2). Deux gestes
// manuels, journalisés ; jamais un automate (CLAUDE.md §7 « les relances sont un
// geste »). Un envoi NON CONFIGURÉ (poste local) n'est jamais compté comme parti.
// ─────────────────────────────────────────────────────────────────────────────

const DEVIS_LIST_PATH = "/dashboard/cabinet/commercial/devis";
const COMMERCIAL_DASHBOARD_PATH = "/dashboard/cabinet/commercial";

// Envoi réel du devis par e-mail (22/09/2026, retour du call Sandrine et le client
// pilote : « Préparer l'e-mail n'envoie pas l'e-mail »). Remplace le brouillon
// `mailto:` — voir devis-sharing-service.ts pour l'historique de la décision.
//
// Sandrine (ou qui envoie) est mise en COPIE, jamais en expéditrice : le mail
// part d'EODA (adresse Resend configurée), pas de sa boîte personnelle — c'est
// le prix du PDF en pièce jointe, qu'un `mailto:` ne sait pas produire.
export async function sendDevisEmail(id: string): Promise<{ error: string } | null> {
  const { tenantId, session, role } = await requireCommercialSession();

  const devis = await prisma.devis.findFirst({
    where: { id, tenantId },
    include: { prospect: { select: { structureName: true, contactEmail: true } } },
  });
  if (!devis) notFound();

  if (!devis.prospect.contactEmail) {
    return { error: "Ce prospect n'a pas d'adresse e-mail renseignée." };
  }

  // Seuls un brouillon ou un devis déjà envoyé peuvent repartir par e-mail — un
  // devis signé, refusé ou annulé est une décision déjà prise, le renvoyer
  // laisserait croire à une nouvelle proposition.
  if (devis.status !== "BROUILLON" && devis.status !== "ENVOYE") {
    return { error: "Ce devis n'est plus à l'étape de l'envoi." };
  }

  const senderName = session.user.name ?? "EODA Conseil";
  const senderEmail = session.user.email;

  let pdf: Buffer;
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
    pdf = await renderDevisPdf(id, cookieHeader);
  } catch (err) {
    console.error("Génération du PDF du devis échouée :", err);
    // Message selon la cause : « réessayez » seulement quand réessayer peut aboutir.
    return { error: devisPdfFailureMessage(err) };
  }

  const content = buildDevisEmail({
    structureName: devis.prospect.structureName,
    devisNumber: devis.number,
    senderName,
    validUntil: devis.validUntil,
    clientNote: devis.clientNote,
    brand: { logoUrl: appUrl("/logo-eoda.png") },
  });

  const fileName = buildDevisFileName({
    number: devis.number,
    structureName: devis.prospect.structureName,
    issuedOn: devis.createdAt,
  });

  let delivery: EmailDelivery;
  try {
    delivery = await getEmailPort().send({
      to: devis.prospect.contactEmail,
      ...(senderEmail && { cc: senderEmail }),
      subject: content.subject,
      html: content.html,
      attachments: [{ filename: fileName, content: pdf, contentType: "application/pdf" }],
    });
  } catch (err) {
    console.error("Envoi de l'e-mail du devis échoué :", err);
    return { error: "L'e-mail n'a pas pu être envoyé. Réessayez dans un instant." };
  }

  // Envoi non configuré (poste local, pas de RESEND_API_KEY) : rien n'est parti. Le
  // devis ne passe PAS à ENVOYE et aucun DEVIS_EMAIL_SENT n'est journalisé — sinon
  // la plateforme affirmerait avoir envoyé un devis que personne n'a reçu.
  if (delivery === "NOT_CONFIGURED") {
    return { error: devisEmailNotSentMessage() };
  }

  if (devis.status === "BROUILLON") {
    await prisma.devis.update({ where: { id }, data: { status: "ENVOYE" } });
  }

  await recordAuditEvent({
    action: "DEVIS_EMAIL_SENT",
    actorUserId: session.user.id,
    actorRole: role,
    targetId: id,
    detail: devis.number,
  });

  revalidatePath(DEVIS_LIST_PATH);
  revalidatePath(`${DEVIS_LIST_PATH}/${id}`);
  return null;
}

// Relance d'un devis ENVOYÉ : un rappel court, sans pièce jointe (le PDF est déjà
// dans la boîte du destinataire) et sans montant (le PDF fait foi). L'expéditeur est
// en copie. Journalisé DEVIS_REMINDER_SENT — c'est ce fait qui dit, à la vue
// d'ensemble, quand le devis a été relancé pour la dernière fois.
export async function remindDevis(id: string): Promise<{ error: string } | null> {
  const { tenantId, session, role } = await requireCommercialSession();

  const devis = await prisma.devis.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      number: true,
      status: true,
      validUntil: true,
      prospect: { select: { structureName: true, contactEmail: true } },
    },
  });
  if (!devis) notFound();
  const to = devis.prospect.contactEmail;
  if (!to || !canRemindDevis(devis.status, to)) {
    return { error: "Seul un devis envoyé, à un prospect qui a une adresse e-mail, se relance." };
  }

  const content = buildDevisReminderEmail({
    structureName: devis.prospect.structureName,
    devisNumber: devis.number,
    senderName: session.user.name ?? "EODA Conseil",
    validUntil: devis.validUntil,
    brand: { logoUrl: appUrl("/logo-eoda.png") },
  });

  let delivery: EmailDelivery;
  try {
    delivery = await getEmailPort().send({
      to,
      ...(session.user.email && { cc: session.user.email }),
      subject: content.subject,
      html: content.html,
    });
  } catch (err) {
    console.error("Relance du devis — envoi échoué :", err);
    return { error: "La relance n'a pas pu être envoyée. Réessayez dans un instant." };
  }
  if (delivery === "NOT_CONFIGURED") return { error: reminderNotSentMessage() };

  await recordAuditEvent({
    action: "DEVIS_REMINDER_SENT",
    actorUserId: session.user.id,
    actorRole: role,
    targetId: devis.id,
    detail: devis.number,
  });

  revalidatePath(DEVIS_LIST_PATH);
  revalidatePath(COMMERCIAL_DASHBOARD_PATH);
  return null;
}
