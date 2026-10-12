"use server";

import { prisma } from "@eoda/database";
import { revalidatePath } from "next/cache";
import { requireEstablishmentInTenant } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { readPacInputs } from "@/lib/db/read-pac-inputs";
import { proposePacActions, type PacProposal } from "@/lib/services/pac-proposal-service";

// ─────────────────────────────────────────────────────────────────────────────
// « Générer depuis l'auto-évaluation » (N5, context/10 §6) — CABINET seul.
// Deux temps, jamais un : la PROPOSITION (lecture, rien n'est écrit), puis la
// CRÉATION des seules actions cochées. À la création, les propositions sont
// RECALCULÉES côté serveur : un identifiant de critère reçu qui n'est pas proposé
// (critère coté 4, déjà doté d'une action PAC ouverte, autre profil) est ignoré.
// ─────────────────────────────────────────────────────────────────────────────

async function currentProposals(establishmentId: string, establishmentType: "SAD_AIDE" | "SAD_MIXTE"): Promise<PacProposal[]> {
  const [inputs, open] = await Promise.all([
    readPacInputs(establishmentId, establishmentType),
    prisma.actionItem.findMany({
      where: { establishmentId, source: "PAC", doneAt: null, linkedCriterionId: { not: null } },
      select: { linkedCriterionId: true },
    }),
  ]);
  return proposePacActions(
    inputs,
    new Set(open.flatMap((o) => (o.linkedCriterionId ? [o.linkedCriterionId] : [])))
  );
}

export async function proposePacFromEvaluation(establishmentId: string): Promise<PacProposal[]> {
  const { establishmentId: id, establishmentType } = await requireEstablishmentInTenant(establishmentId);
  return currentProposals(id, establishmentType);
}

export async function createPacActions(formData: FormData): Promise<{ error: string } | { created: number }> {
  const establishmentIdRaw = formData.get("establishmentId");
  if (typeof establishmentIdRaw !== "string" || establishmentIdRaw.length === 0) return { error: "Structure manquante." };
  const { establishmentId, establishmentType, tenantId, userId, session } =
    await requireEstablishmentInTenant(establishmentIdRaw);

  const selected = new Set(formData.getAll("criterionId").filter((v): v is string => typeof v === "string"));
  if (selected.size === 0) return { error: "Cochez au moins une action à créer." };

  const proposals = (await currentProposals(establishmentId, establishmentType)).filter((p) => selected.has(p.criterionId));
  if (proposals.length === 0) return { error: "Ces actions ne sont plus à proposer (déjà créées ou critère remonté à 4)." };

  const created = await prisma.$transaction(
    proposals.map((p) =>
      prisma.actionItem.create({
        data: {
          tenantId,
          establishmentId,
          title: p.title,
          ownerKind: "STRUCTURE",
          ownerFunction: p.ownerFunction,
          source: "PAC",
          linkedDocumentId: p.linkedDocumentId,
          linkedCriterionId: p.criterionId,
          createdByUserId: userId,
        },
        select: { id: true },
      })
    )
  );

  await Promise.all(
    created.map((c) =>
      recordAuditEvent({
        action: "ACTION_ITEM_CREATED",
        actorUserId: userId,
        actorRole: session.user.role,
        establishmentId,
        targetId: c.id,
        detail: "PAC · STRUCTURE",
      })
    )
  );

  revalidatePath(`/dashboard/cabinet/etablissements/${establishmentId}/plan-action`);
  revalidatePath(`/dashboard/cabinet/etablissements/${establishmentId}`);
  return { created: created.length };
}
