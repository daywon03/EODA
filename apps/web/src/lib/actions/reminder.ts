"use server";

import { prisma } from "@eoda/database";
import { notFound } from "next/navigation";
import { requireEstablishmentInTenant } from "@/lib/auth/guards";
import { optionalString } from "@/lib/validation/form-parsers";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { sendDocumentReminderEmails } from "@/lib/email/notifications";
import { getEstablishmentChecklist } from "./checklist";
import {
  checkReminderEligibility,
  describeReminderOutcome,
} from "@/lib/services/reminder-service";
import {
  canDepositDocuments,
  deriveMissionAccessState,
} from "@/lib/services/mission-access-service";

// ─────────────────────────────────────────────────────────────────────────────
// RELANCE DES PIÈCES MANQUANTES — déclenchée par le cabinet, jamais par une horloge.
//
// §12.5 demande la relance ; §12.7 constate que sa cadence n'a jamais été spécifiée.
// On livre donc le geste, pas l'automate : le jour où Sandrine fixe un rythme, il
// appellera cette même action depuis une tâche planifiée — il n'y aura rien à
// réécrire, seulement un déclencheur à ajouter.
//
// La liste des pièces n'est PAS envoyée par le formulaire : elle est recalculée ici
// depuis la checklist. Un formulaire qui transporterait les intitulés permettrait de
// relancer une structure sur n'importe quoi, y compris sur des documents qui ne la
// concernent pas.
// ─────────────────────────────────────────────────────────────────────────────

export type ReminderResult = { ok: true; message: string } | { error: string };

export async function sendDocumentReminder(
  establishmentId: string,
  _prevState: ReminderResult | null,
  formData: FormData
): Promise<ReminderResult> {
  // Garde unique : identité + appartenance au tenant. Le cabinet uniquement — un
  // client ne se relance pas lui-même.
  const { userId, session } = await requireEstablishmentInTenant(establishmentId);

  const establishment = await prisma.establishment.findUnique({
    where: { id: establishmentId },
    select: { name: true },
  });
  if (!establishment) notFound();

  const message = optionalString(formData, "message", "Le message", 1000);
  if (!message.ok) return { error: message.error };

  const mission = await prisma.mission.findUnique({
    where: { establishmentId },
    select: { closedAt: true, clientAccessRevokedAt: true },
  });

  const checklist = await getEstablishmentChecklist(establishmentId);
  const eligibility = checkReminderEligibility({
    items: Object.values(checklist).flat(),
    depositOpen: canDepositDocuments(deriveMissionAccessState(mission)),
  });
  if (!eligibility.ok) return { error: eligibility.error };

  const outcome = await sendDocumentReminderEmails({
    establishmentId,
    establishmentName: establishment.name,
    missingLabels: eligibility.labels,
    message: message.value,
  });

  await recordAuditEvent({
    action: "DOCUMENT_REMINDER_SENT",
    actorUserId: userId,
    actorRole: session.user.role,
    establishmentId,
    // Des NOMBRES : pouvoir dire « trois relances en une semaine » sans qu'aucune
    // adresse n'entre dans le journal.
    detail: `${eligibility.labels.length} pièce(s) · ${outcome.sent}/${outcome.total} destinataire(s)`,
  });

  // Un envoi partiel n'est pas une erreur, mais ne doit pas se lire comme un succès
  // complet : la phrase dit exactement ce qui est parti.
  if (outcome.sent === 0) return { error: describeReminderOutcome(outcome) };
  return { ok: true, message: describeReminderOutcome(outcome) };
}
