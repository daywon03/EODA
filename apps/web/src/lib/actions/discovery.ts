"use server";

import { prisma, type EstablishmentType, type StructureType } from "@eoda/database";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCabinetAdminSession } from "@/lib/auth/guards";
import {
  isDiscoveryStarted,
  normaliseDiscoveryAnswers,
  parseDiscoverySubmission,
  type DiscoveryAnswers,
} from "@/lib/services/discovery-grid-service";

// ─────────────────────────────────────────────────────────────────────────────
// GRILLE D'ENTRETIEN DÉCOUVERTE — lecture et enregistrement des réponses.
//
// `CABINET_ADMIN` uniquement, comme tout le pipeline commercial (CLAUDE.md §7) :
// une découverte contient ce que la structure dit de ses moyens, de son budget et de
// ses failles documentaires. C'est de la donnée de prospection.
//
// ⚠️ L'ouverture de cette grille au CLIENT n'est pas tranchée (« SRE n'est pas sûre
// de cela »). Rien ici ne l'ouvre, et l'ouvrir demandera une décision explicite plus
// une garde côté client — pas seulement un lien de plus dans un menu.
// ─────────────────────────────────────────────────────────────────────────────

const PROSPECT_LIST_PATH = "/dashboard/cabinet/commercial/prospects";

export type DiscoveryReadResult = {
  structureName: string;
  answers: DiscoveryAnswers;
  updatedAt: Date | null;
  // Identité administrative, éditable sur le même écran : elle se recueille pendant
  // le même appel que la grille.
  structureType: StructureType;
  finessNumber: string | null;
  siretNumber: string | null;
  address: string | null;
  establishmentType: EstablishmentType | null;
  hasEvaluationTargetDate: Date | null;
};

export async function getDiscoveryAnswers(prospectId: string): Promise<DiscoveryReadResult> {
  const { tenantId } = await requireCabinetAdminSession();

  const prospect = await prisma.prospect.findFirst({
    where: { id: prospectId, tenantId },
    select: {
      structureName: true,
      discoveryAnswersJson: true,
      discoveryUpdatedAt: true,
      structureType: true,
      finessNumber: true,
      siretNumber: true,
      address: true,
      establishmentType: true,
      hasEvaluationTargetDate: true,
    },
  });
  if (!prospect) notFound();

  return {
    structureName: prospect.structureName,
    // Colonne `Json` : normalisée à la lecture, jamais rendue telle quelle. Une
    // réponse écrite sous une version antérieure de la grille ne doit pas casser
    // l'écran (même règle que l'analyse documentaire).
    answers: normaliseDiscoveryAnswers(prospect.discoveryAnswersJson),
    updatedAt: prospect.discoveryUpdatedAt,
    structureType: prospect.structureType,
    finessNumber: prospect.finessNumber,
    siretNumber: prospect.siretNumber,
    address: prospect.address,
    establishmentType: prospect.establishmentType,
    hasEvaluationTargetDate: prospect.hasEvaluationTargetDate,
  };
}

export async function saveDiscoveryAnswers(
  prospectId: string,
  _prevState: { error: string } | { ok: true } | null,
  formData: FormData
): Promise<{ error: string } | { ok: true }> {
  const { tenantId, userId } = await requireCabinetAdminSession();

  // `prospectId` vient d'une route HTTP publique : l'appartenance au tenant se
  // vérifie en base, elle ne se déduit pas du fait que l'écran l'a affiché.
  const existing = await prisma.prospect.findFirst({
    where: { id: prospectId, tenantId },
    select: { id: true, status: true },
  });
  if (!existing) notFound();

  // Le formulaire ne décide de rien : c'est la grille qui borne les clés et les
  // valeurs acceptées, et la même fonction que la lecture qui l'applique.
  const answers = parseDiscoverySubmission(
    [...formData.entries()].filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  );

  // « On a bien fait la réunion découverte, donc on n'en est plus à la préparer » —
  // demande explicite du 07/09/2026. Sans ce passage, le statut restait bloqué sur
  // NOUVEAU et l'action suivante affichée sur la fiche continuait de proposer de
  // préparer une réunion déjà tenue. RDV existe déjà dans l'entonnoir (« Rendez-vous
  // découverte ») : aucun nouvel état, juste le déclencheur qui manquait.
  const shouldAdvanceToRdv = existing.status === "NOUVEAU" && isDiscoveryStarted(answers);

  await prisma.$transaction([
    prisma.prospect.update({
      where: { id: prospectId },
      data: {
        discoveryAnswersJson: answers,
        discoveryUpdatedAt: new Date(),
        ...(shouldAdvanceToRdv && { status: "RDV" }),
      },
    }),
    ...(shouldAdvanceToRdv
      ? [
          prisma.prospectTimelineEntry.create({
            data: {
              tenantId,
              prospectId,
              kind: "CHANGEMENT_STATUT",
              authorUserId: userId,
              statusFrom: existing.status,
              statusTo: "RDV",
            },
          }),
        ]
      : []),
  ]);

  revalidatePath(`${PROSPECT_LIST_PATH}/${prospectId}`);
  revalidatePath(`${PROSPECT_LIST_PATH}/${prospectId}/decouverte`);
  return { ok: true };
}
