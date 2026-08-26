"use server";

import { prisma, type Prisma, EstablishmentType, StructureType } from "@eoda/database";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCabinetSession, requireEstablishmentInTenant } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import type { PortfolioRow } from "@/lib/services/portfolio-kpi-service";
import { toPortfolioRow } from "@/lib/db/to-portfolio-row";
import {
  firstError,
  requiredDate,
  requiredEnum,
  requiredString,
} from "@/lib/validation/form-parsers";

// Tous les champs de la fiche sont EXIGÉS.
//
// Ce parseur ne sert plus qu'à la correction d'une fiche existante : la création
// passe exclusivement par la signature d'un devis (`convertDevisToClient`). À ce
// stade, la structure est cliente — son statut juridique, son FINESS et son adresse
// sont connus, et les laisser vides produirait des livrables incomplets.
//
// Conséquence assumée : une fiche antérieure sans FINESS ne peut plus être
// enregistrée tant qu'il n'est pas saisi. C'est le but — un champ facultatif qu'on
// ne remplit jamais est un champ qui manquera le jour de l'évaluation.
function parseEstablishmentInput(formData: FormData): { error: string } | {
  name: string;
  type: EstablishmentType;
  structureType: StructureType;
  finessNumber: string;
  address: string;
  hasEvaluationTargetDate: Date;
} {
  const name = requiredString(formData, "name", "Le nom de l'établissement", 200);
  // Deux axes distincts, jamais fusionnés (CLAUDE.md §7) : le type dit ce que la
  // structure FAIT (aide seule ou aide + soins), le statut juridique dit ce qu'elle
  // EST (association loi 1901, CCAS/CIAS, secteur privé).
  const type = requiredEnum(formData, "type", "Le type de SAD", EstablishmentType);
  const structureType = requiredEnum(
    formData,
    "structureType",
    "Le statut juridique",
    StructureType
  );
  // FINESS = 9 chiffres. Validé ici plutôt que laissé libre : c'est la clé
  // d'identification de l'ESSMS auprès de la HAS, une saisie approximative se
  // retrouverait dans un livrable.
  const finessNumber = requiredString(formData, "finessNumber", "Le numéro FINESS", 20);
  const address = requiredString(formData, "address", "L'adresse", 300);
  const hasEvaluationTargetDate = requiredDate(
    formData,
    "hasEvaluationTargetDate",
    "La date d'évaluation visée"
  );

  const error = firstError(
    name,
    type,
    structureType,
    finessNumber,
    address,
    hasEvaluationTargetDate
  );
  if (error) return { error };
  if (
    !name.ok ||
    !type.ok ||
    !structureType.ok ||
    !finessNumber.ok ||
    !address.ok ||
    !hasEvaluationTargetDate.ok
  ) {
    return { error: "Formulaire invalide." };
  }

  if (!/^\d{9}$/.test(finessNumber.value)) {
    return { error: "Le numéro FINESS doit comporter exactement 9 chiffres." };
  }

  return {
    name: name.value,
    type: type.value,
    structureType: structureType.value,
    finessNumber: finessNumber.value,
    address: address.value,
    hasEvaluationTargetDate: hasEvaluationTargetDate.value,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Il n'existe volontairement PAS de `createEstablishment`.
//
// Une fiche client naît d'un seul endroit : la signature d'un devis
// (`lib/actions/conversion.ts`), qui crée d'un même mouvement la fiche, la mission
// et les options souscrites. Une création manuelle produisait un établissement sans
// prospect, sans devis et sans chiffre d'affaires — donc absent de tous les
// indicateurs commerciaux, et redemandait le FINESS avant qu'aucune relation
// commerciale n'existe.
//
// Un seul chemin, donc des KPI qui ne peuvent pas se tromper. Si le besoin
// « client déjà signé hors plateforme » revient, il passe par un prospect et un
// devis — pas par une seconde porte.
// ─────────────────────────────────────────────────────────────────────────────

export async function updateEstablishment(
  id: string,
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  await requireEstablishmentInTenant(id);

  const parsed = parseEstablishmentInput(formData);
  if ("error" in parsed) return parsed;

  await prisma.establishment.update({
    where: { id },
    data: parsed,
  });

  revalidatePath("/dashboard/cabinet");
  revalidatePath(`/dashboard/cabinet/etablissements/${id}`);
  redirect(`/dashboard/cabinet/etablissements/${id}`);
}

export async function deleteEstablishment(id: string): Promise<{ error: string } | void> {
  const { session, userId } = await requireEstablishmentInTenant(id);

  // Comptes clients devenus orphelins — désactivés (jamais supprimés, la piste
  // d'audit doit survivre), calculés DANS la transaction, journalisés après elle.
  const deactivatedUserIds = await prisma.$transaction(async (tx) => {
    await tx.elementRating.deleteMany({
      where: { evaluationSession: { establishmentId: id } },
    });
    await tx.evaluationSession.deleteMany({ where: { establishmentId: id } });
    await tx.document.updateMany({
      where: { establishmentId: id },
      data: { currentVersionId: null },
    });
    await tx.documentVersion.deleteMany({ where: { document: { establishmentId: id } } });
    await tx.document.deleteMany({ where: { establishmentId: id } });

    // ── Comptes orphelins ────────────────────────────────────────────────────
    // Jusqu'ici, seuls les liens EstablishmentUser étaient supprimés : les lignes
    // `users` survivaient, et un compte client d'un établissement disparu POUVAIT
    // ENCORE S'AUTHENTIFIER. C'est une fuite d'accès, pas un résidu cosmétique.
    // Un compte encore rattaché à un autre établissement est évidemment conservé ;
    // seul le CLIENT_USER qui ne l'est plus à rien est désactivé, dans la même
    // transaction que l'établissement.
    const linkedUserIds = (
      await tx.establishmentUser.findMany({ where: { establishmentId: id }, select: { userId: true } })
    ).map((link) => link.userId);

    await tx.establishmentUser.deleteMany({ where: { establishmentId: id } });

    let orphanIds: string[] = [];
    if (linkedUserIds.length > 0) {
      const stillLinked = new Set(
        (
          await tx.establishmentUser.findMany({
            where: { userId: { in: linkedUserIds } },
            select: { userId: true },
          })
        ).map((link) => link.userId)
      );
      const clientAccounts = await tx.user.findMany({
        where: { id: { in: linkedUserIds }, role: "CLIENT_USER" },
        select: { id: true },
      });
      orphanIds = clientAccounts.map((u) => u.id).filter((userId) => !stillLinked.has(userId));
      if (orphanIds.length > 0) {
        // Désactivation et non suppression. Supprimer la ligne `users` fermait bien
        // l'accès, mais emportait avec elle la lisibilité du journal d'audit : les
        // entrées de ce compte ne correspondaient plus ni à un établissement du
        // périmètre ni à un acteur connu, donc plus personne ne pouvait répondre à
        // « qui a consulté les documents de l'établissement fermé l'an dernier ? ».
        // C'est précisément l'exigence de traçabilité du secteur médico-social
        // (CLAUDE.md §5 bis). Un compte désactivé est refusé à la connexion et par
        // toutes les gardes — l'accès est fermé aussi sûrement, la trace subsiste.
        await tx.user.updateMany({
          where: { id: { in: orphanIds } },
          data: { isActive: false, deactivatedAt: new Date() },
        });
      }
    }

    // La mission, ses options souscrites, ses statuts de checklist et les demandes
    // d'option du client tombent par CASCADE déclarée dans le schéma ; le prospect
    // est détaché par SET NULL et garde son historique commercial. Migration
    // 20260821090000_establishment_delete_cascade — cette transaction n'a plus à
    // énumérer ces tables, et une relation ajoutée demain ne la fera plus échouer.
    await tx.establishment.delete({ where: { id } });

    return orphanIds;
  });

  // Journalisé après coup, hors transaction : la trace de suppression ne doit pas
  // être annulée avec la transaction si celle-ci échoue, ni la faire échouer.
  await recordAuditEvent({
    action: "ESTABLISHMENT_DELETED",
    actorUserId: userId,
    actorRole: session.user.role,
    establishmentId: id,
    detail: `${deactivatedUserIds.length} compte(s) client désactivé(s)`,
  });

  // Une ligne par compte désactivé : le journal doit permettre de répondre « quel
  // accès a disparu, quand », pas seulement « un établissement a été supprimé ».
  for (const deactivatedUserId of deactivatedUserIds) {
    await recordAuditEvent({
      action: "USER_DELETED_WITH_ESTABLISHMENT",
      actorUserId: userId,
      actorRole: session.user.role,
      establishmentId: id,
      targetId: deactivatedUserId,
    });
  }

  revalidatePath("/dashboard/cabinet");
  redirect("/dashboard/cabinet");
}

// Même sélection de faits de cycle de vie que `listEstablishments` — l'étape affichée
// sur la fiche doit être calculée à partir des mêmes données que celle du tableau de
// bord, sinon les deux écrans se contredisent sur la même structure.
const LIFECYCLE_INCLUDE = {
  prospect: { select: { status: true } },
  mission: {
    select: {
      closedAt: true,
      gratuit: true,
      fondationsStartDate: true,
      fondationsEndDate: true,
      deploiementStartDate: true,
      deploiementEndDate: true,
      consolidationStartDate: true,
      consolidationEndDate: true,
      preparationFinaleStartDate: true,
      preparationFinaleEndDate: true,
      // Formule contractée — lue avec les faits de cycle de vie parce que les
      // agrégats de portefeuille en ont besoin en même temps qu'eux, et parce que
      // c'est la mission qui en porte la vérité, jamais `Establishment.commercialTier`
      // (CLAUDE.md §7).
      formule: true,
      itemStatuses: { where: { completed: true }, select: { id: true } },
    },
  },
} satisfies Prisma.EstablishmentInclude;

// Liste des fiches, avec de quoi DÉRIVER l'étape de chacune (cf.
// lib/services/lifecycle-service.ts). On ramène des faits — clôture, gratuité, items
// cochés, dates de phases posées — et jamais un statut stocké, qui finirait par ne
// plus correspondre à rien.
//
// `_count` sur les items cochés plutôt que la liste : on n'a besoin que de savoir si
// le diagnostic a commencé, pas de quoi il est fait.
export async function listEstablishments() {
  const { tenantId } = await requireCabinetSession();

  return prisma.establishment.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { documents: true } }, ...LIFECYCLE_INCLUDE },
  });
}

// Portefeuille client agrégé (cf. lib/services/portfolio-kpi-service.ts) — la
// moitié des indicateurs qui vit APRÈS la signature. Même sélection que la liste
// des fiches : deux requêtes jumelles finiraient par diverger, et deux écrans
// compteraient alors des choses différentes sous le même nom.
//
// Converti en `PortfolioRow` ici et pas dans la page : la couche de présentation
// n'a pas à connaître la forme Prisma (huit colonnes de dates, items filtrés).
export async function listPortfolioRowsForKpi(): Promise<PortfolioRow[]> {
  const { tenantId } = await requireCabinetSession();

  const rows = await prisma.establishment.findMany({
    where: { tenantId },
    include: LIFECYCLE_INCLUDE,
  });

  return rows.map(toPortfolioRow);
}

export type EstablishmentWithUsers = Prisma.EstablishmentGetPayload<{
  include: {
    establishmentUsers: {
      include: {
        user: { select: { id: true; name: true; email: true; role: true; isActive: true } };
      };
    };
    prospect: { select: { status: true } };
    mission: {
      select: {
        closedAt: true;
        gratuit: true;
        fondationsStartDate: true;
        fondationsEndDate: true;
        deploiementStartDate: true;
        deploiementEndDate: true;
        consolidationStartDate: true;
        consolidationEndDate: true;
        preparationFinaleStartDate: true;
        preparationFinaleEndDate: true;
        itemStatuses: { select: { id: true } };
      };
    };
  };
}>;

export async function getEstablishment(id: string): Promise<EstablishmentWithUsers> {
  const { tenantId } = await requireCabinetSession();

  const establishment = await prisma.establishment.findFirst({
    where: { id, tenantId },
    include: {
      establishmentUsers: {
        include: {
          user: { select: { id: true, name: true, email: true, role: true, isActive: true } },
        },
      },
      ...LIFECYCLE_INCLUDE,
    },
  });

  // notFound() et non redirect() — ne jamais révéler qu'un identifiant existe dans
  // un autre tenant.
  if (!establishment) notFound();
  return establishment;
}
