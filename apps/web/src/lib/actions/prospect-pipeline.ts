"use server";

import { prisma } from "@eoda/database";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCommercialSession } from "@/lib/auth/guards";
import { readPipelineFacts, type PipelineFacts } from "@/lib/db/read-prospect-pipeline";
import {
  countPipelineTabs,
  filterPipeline,
  parseOriginFilter,
  parsePipelineTab,
  type OriginFilter,
  type PipelineTab,
} from "@/lib/services/prospect-pipeline-service";
import { getEmailPort, type EmailDelivery } from "@/lib/email";
import { buildProspectReminderEmail } from "@/lib/email/commercial-templates";
import { appUrl } from "@/lib/config/app-url";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { reminderNotSentMessage } from "@/lib/services/email-delivery-service";

// ─────────────────────────────────────────────────────────────────────────────
// PIPELINE PROSPECTS côté cabinet (maquette v2 « Prospects », fiche « en autonomie »)
// — capacité COMMERCIAL. Tout identifiant reçu est relu dans le tenant de l'appelant.
// ─────────────────────────────────────────────────────────────────────────────

const PROSPECTS_PATH = "/dashboard/cabinet/commercial/prospects";

export type ProspectPipelinePage = {
  rows: PipelineFacts[];
  counts: Record<PipelineTab, number>;
  tab: PipelineTab;
  origin: OriginFilter;
};

export async function listProspectPipeline(input: { tab?: string | undefined; origin?: string | undefined }): Promise<ProspectPipelinePage> {
  const { tenantId } = await requireCommercialSession();
  const tab = parsePipelineTab(input.tab);
  const origin = parseOriginFilter(input.origin);
  const facts = await readPipelineFacts(tenantId, new Date());
  return { rows: filterPipeline(facts, tab, origin), counts: countPipelineTabs(facts, origin), tab, origin };
}

// Encart « en autonomie » de la fiche prospect : null pour un prospect démarché.
export async function getSelfServiceSummary(prospectId: string): Promise<PipelineFacts | null> {
  const { tenantId } = await requireCommercialSession();
  const [facts] = await readPipelineFacts(tenantId, new Date(), prospectId);
  if (!facts || facts.origin !== "LIBRE_SERVICE") return null;
  return facts;
}

// Relance d'une structure inscrite seule qui n'avance plus : un rappel aux comptes
// de SA structure (jamais une adresse saisie), journalisé. Un geste, pas un automate.
export async function remindSelfServiceProspect(prospectId: string): Promise<{ error: string } | null> {
  const { tenantId, userId, role } = await requireCommercialSession();
  const prospect = await prisma.prospect.findFirst({
    where: { id: prospectId, tenantId, channel: "LIBRE_SERVICE", establishmentId: null },
    select: {
      id: true,
      structureName: true,
      accounts: { where: { user: { isActive: true } }, select: { user: { select: { email: true, name: true } } } },
    },
  });
  if (!prospect) notFound();
  if (prospect.accounts.length === 0) return { error: "Cette structure n'a plus de compte actif." };

  let delivered: EmailDelivery = "NOT_CONFIGURED";
  try {
    for (const { user } of prospect.accounts) {
      const content = buildProspectReminderEmail({
        firstName: user.name,
        structureName: prospect.structureName,
        loginUrl: appUrl("/login"),
        brand: { logoUrl: appUrl("/logo-eoda.png") },
      });
      delivered = await getEmailPort().send({ to: user.email, subject: content.subject, html: content.html });
    }
  } catch (error) {
    console.error("Relance d'une structure inscrite — envoi échoué :", error);
    return { error: "La relance n'a pas pu être envoyée. Réessayez dans un instant." };
  }
  if (delivered === "NOT_CONFIGURED") return { error: reminderNotSentMessage() };

  await recordAuditEvent({ action: "PROSPECT_REMINDER_SENT", actorUserId: userId, actorRole: role, targetId: prospect.id });
  revalidatePath(PROSPECTS_PATH);
  return null;
}
