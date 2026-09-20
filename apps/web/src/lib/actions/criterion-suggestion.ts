"use server";

import { prisma } from "@eoda/database";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { requireEstablishmentAccess } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/services/audit-log-service";

// ─────────────────────────────────────────────────────────────────────────────
// REVUE D'UNE SUGGESTION DE CRITÈRE — décision humaine sur un critère HAS
// détecté par l'IA en plus de ceux déjà rattachés au type de document. Fichier
// séparé de document.ts (déjà volumineux, D4) : une seule responsabilité, la
// même que setDocumentValidated pour la validation d'un document.
//
// Réservée au CABINET, jamais au client : la même barrière que le reste de la
// revue d'analyse (CDC §5, §7) — une suggestion non tranchée n'a rien à faire
// sous les yeux d'un client.
// ─────────────────────────────────────────────────────────────────────────────

async function reviewSuggestion(
  establishmentId: string,
  suggestionId: string,
  decision: "CONFIRMED" | "REJECTED"
): Promise<{ error: string } | null> {
  const access = await requireEstablishmentAccess(establishmentId);
  if (access.isClient) notFound();

  // `suggestionId` vient d'une action serveur : une entrée non fiable (S8). Elle
  // n'est acceptée que si elle appartient réellement à un document de CET
  // établissement — sinon un identifiant deviné confirmerait un critère sur la
  // fiche d'un autre client (IDOR).
  const suggestion = await prisma.documentCriterionSuggestion.findUnique({
    where: { id: suggestionId },
    select: { id: true, status: true, document: { select: { establishmentId: true } } },
  });
  if (!suggestion || suggestion.document.establishmentId !== establishmentId) notFound();

  // Déjà tranchée : on ne réécrit pas une décision humaine, on le dit simplement.
  if (suggestion.status !== "PENDING") return null;

  await prisma.documentCriterionSuggestion.update({
    where: { id: suggestionId },
    data: { status: decision, reviewedByUserId: access.userId, reviewedAt: new Date() },
  });

  await recordAuditEvent({
    action: decision === "CONFIRMED" ? "CRITERION_SUGGESTION_CONFIRMED" : "CRITERION_SUGGESTION_REJECTED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId,
    targetId: suggestion.id,
  });

  revalidatePath(`/dashboard/cabinet/etablissements/${establishmentId}`);
  return null;
}

export async function confirmCriterionSuggestion(
  establishmentId: string,
  suggestionId: string
): Promise<{ error: string } | null> {
  return reviewSuggestion(establishmentId, suggestionId, "CONFIRMED");
}

export async function rejectCriterionSuggestion(
  establishmentId: string,
  suggestionId: string
): Promise<{ error: string } | null> {
  return reviewSuggestion(establishmentId, suggestionId, "REJECTED");
}
