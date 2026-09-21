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
    select: {
      id: true,
      status: true,
      criterionId: true,
      templateDocument: { select: { id: true, tenantId: true } },
    },
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

  // « Coche les critères » (Damon, revue du 21/09/2026) : confirmer une suggestion
  // ne se limite pas à faire disparaître la ligne, ça RATTACHE réellement le
  // critère au gabarit — sinon TemplateCriteriaPicker et le futur écran « par
  // critère » ne le voient jamais. Une seule transaction : sans elle, un crash
  // entre les deux écritures laisserait une suggestion CONFIRMED sans son
  // rattachement, l'exact symptôme qu'on corrige ici.
  await prisma.$transaction([
    prisma.templateCriterionSuggestion.update({
      where: { id: suggestionId },
      data: { status: decision, reviewedByUserId: userId, reviewedAt: new Date() },
    }),
    ...(decision === "CONFIRMED"
      ? [
          prisma.templateDocumentCriterion.upsert({
            where: {
              templateDocumentId_criterionId: {
                templateDocumentId: templateId,
                criterionId: suggestion.criterionId,
              },
            },
            create: { templateDocumentId: templateId, criterionId: suggestion.criterionId },
            update: {},
          }),
        ]
      : []),
  ]);

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

// « Un bouton qui accepte tous les critères trouvés par l'IA » (Damon, 21/09/2026) —
// confirmer une par une une liste qui peut aller jusqu'à dix lignes est le point de
// friction qui fait que la revue humaine se fait à moitié. Même garde tenant que
// reviewTemplateSuggestion ; ne touche QUE les suggestions encore PENDING au moment
// de l'appel, jamais celles déjà REJECTED par un choix humain antérieur.
export async function confirmAllTemplateCriterionSuggestions(
  templateId: string
): Promise<{ error: string } | null> {
  const { tenantId, userId, session } = await requireCabinetAdminSession();

  const template = await prisma.templateDocument.findFirst({
    where: { id: templateId, tenantId },
    select: { id: true },
  });
  if (!template) notFound();

  const pending = await prisma.templateCriterionSuggestion.findMany({
    where: { templateDocumentId: templateId, status: "PENDING" },
    select: { id: true, criterionId: true },
  });
  if (pending.length === 0) return null;

  await prisma.$transaction([
    prisma.templateCriterionSuggestion.updateMany({
      where: { id: { in: pending.map((s) => s.id) } },
      data: { status: "CONFIRMED", reviewedByUserId: userId, reviewedAt: new Date() },
    }),
    ...pending.map((s) =>
      prisma.templateDocumentCriterion.upsert({
        where: {
          templateDocumentId_criterionId: { templateDocumentId: templateId, criterionId: s.criterionId },
        },
        create: { templateDocumentId: templateId, criterionId: s.criterionId },
        update: {},
      })
    ),
  ]);

  await Promise.all(
    pending.map((s) =>
      recordAuditEvent({
        action: "TEMPLATE_CRITERION_SUGGESTION_CONFIRMED",
        actorUserId: userId,
        actorRole: session.user.role,
        targetId: s.id,
      })
    )
  );

  revalidatePath(`/dashboard/cabinet/modeles/${templateId}`);
  return null;
}
