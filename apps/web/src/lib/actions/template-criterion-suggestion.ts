"use server";

import { prisma } from "@eoda/database";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { requireCabinetAdminSession } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/services/audit-log-service";

// ─────────────────────────────────────────────────────────────────────────────
// REVUE D'UNE SUGGESTION DE CRITÈRE SUR UN GABARIT — pendant de
// criterion-suggestion.ts (documents client), pour la bibliothèque de modèles.
//
// Un gabarit n'appartient à aucun établissement (CLAUDE.md §7) : la garde n'est
// donc pas `requireEstablishmentAccess` mais `requireCabinetAdminSession`, la
// même que le reste de l'écriture sur la bibliothèque (CLAUDE.md §0, tableau
// storeVersion). `suggestionId` reste une entrée non fiable (S8) : elle n'est
// acceptée que si elle appartient à un gabarit du TENANT de l'appelant.
// ─────────────────────────────────────────────────────────────────────────────

async function reviewTemplateSuggestion(
  templateId: string,
  suggestionId: string,
  decision: "CONFIRMED" | "REJECTED"
): Promise<{ error: string } | null> {
  const { tenantId, userId, session } = await requireCabinetAdminSession();

  const suggestion = await prisma.templateCriterionSuggestion.findUnique({
    where: { id: suggestionId },
    select: { id: true, status: true, templateDocument: { select: { id: true, tenantId: true } } },
  });
  if (
    !suggestion ||
    suggestion.templateDocument.id !== templateId ||
    suggestion.templateDocument.tenantId !== tenantId
  ) {
    notFound();
  }

  // Déjà tranchée : on ne réécrit pas une décision humaine, on le dit simplement.
  if (suggestion.status !== "PENDING") return null;

  await prisma.templateCriterionSuggestion.update({
    where: { id: suggestionId },
    data: { status: decision, reviewedByUserId: userId, reviewedAt: new Date() },
  });

  await recordAuditEvent({
    action:
      decision === "CONFIRMED"
        ? "TEMPLATE_CRITERION_SUGGESTION_CONFIRMED"
        : "TEMPLATE_CRITERION_SUGGESTION_REJECTED",
    actorUserId: userId,
    actorRole: session.user.role,
    targetId: suggestion.id,
  });

  revalidatePath(`/dashboard/cabinet/modeles/${templateId}`);
  return null;
}

export async function confirmTemplateCriterionSuggestion(
  templateId: string,
  suggestionId: string
): Promise<{ error: string } | null> {
  return reviewTemplateSuggestion(templateId, suggestionId, "CONFIRMED");
}

export async function rejectTemplateCriterionSuggestion(
  templateId: string,
  suggestionId: string
): Promise<{ error: string } | null> {
  return reviewTemplateSuggestion(templateId, suggestionId, "REJECTED");
}
