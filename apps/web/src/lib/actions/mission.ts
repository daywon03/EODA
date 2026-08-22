"use server";

import {
  prisma,
  CommercialTier,
  type CatalogueOption,
  type MissionChecklistScope,
} from "@eoda/database";
import { requireCabinetSession, requireEstablishmentInTenant } from "@/lib/auth/guards";
import { notFound } from "next/navigation";
import { requiredEnum } from "@/lib/validation/form-parsers";
import { revalidatePath } from "next/cache";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import {
  reconcileMissionOptions,
  summariseMissionScopeForAudit,
  toMissionOptionSnapshotsFromCatalogue,
} from "@/lib/services/mission-option-service";
import {
  computeMissionProgress,
  isChecklistItemApplicable,
  type MissionProgress,
} from "@/lib/services/mission-progress-service";
import { readMissionDocumentCounters } from "@/lib/db/read-mission-document-counters";
import type { MissionDocumentCounters } from "@/lib/services/mission-document-counters-service";

// Plus de résolution de tenant locale : requireCabinetSession() la fait déjà et
// refuse un compte Cabinet sans tenant (fail-closed, cf. lib/auth/guards.ts).

// Vérifie qu'une formule reçue est bien active au catalogue du tenant — un
// identifiant de formule n'est pas une donnée de confiance même dans un <select>.
async function assertFormuleAvailable(
  tenantId: string,
  formule: CommercialTier
): Promise<boolean> {
  const available = await prisma.catalogueFormule.findFirst({
    where: { tenantId, formule, active: true },
    select: { id: true },
  });
  return available !== null;
}

// Résout les options cochées en lignes de catalogue RÉELLES du tenant appelant.
//
// Trois choses se jouent ici, et aucune n'est décorative :
//   - un identifiant d'option vient d'un formulaire, donc d'une route HTTP publique :
//     son appartenance au tenant est vérifiée en base, jamais supposée depuis le
//     `<select>` qui l'a affiché ;
//   - une option retirée du catalogue (`active: false`) ne peut plus être souscrite ;
//   - le PRIX est relu en base. Le formulaire ne transporte que des identifiants :
//     un montant posté par le client serait une entrée non fiable sur une donnée qui
//     finit affichée au client comme un prix.
//
// Retourne null si un seul identifiant ne correspond pas — refus global plutôt que
// silencieux partiel : enregistrer 2 options sur 3 sans le dire est pire qu'échouer.
async function resolveSelectedOptions(
  tenantId: string,
  optionIds: readonly string[]
): Promise<CatalogueOption[] | null> {
  const unique = [...new Set(optionIds)];
  if (unique.length === 0) return [];

  const options = await prisma.catalogueOption.findMany({
    where: { id: { in: unique }, tenantId, active: true },
  });

  return options.length === unique.length ? options : null;
}

// Les cases cochées d'un même nom arrivent en valeurs multiples. `getAll` plutôt que
// `get` : avec `get`, une seule option sur N serait enregistrée, en silence.
function selectedOptionIds(formData: FormData): string[] {
  return formData
    .getAll("optionIds")
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

function missionPaths(establishmentId: string) {
  return [
    `/dashboard/cabinet/etablissements/${establishmentId}`,
    `/dashboard/cabinet/etablissements/${establishmentId}/mission`,
  ];
}

// Lecture seule des offres actives du catalogue — accessible aux deux rôles
// Cabinet (contrairement à listCatalogue() qui gère l'édition du catalogue et
// reste réservée à CABINET_ADMIN) : un CABINET_EVALUATOR doit pouvoir voir les
// prix pour choisir l'offre à la création d'une mission.
export async function listFormulesForMissionSetup() {
  const { tenantId } = await requireCabinetSession();

  return prisma.catalogueFormule.findMany({
    where: { tenantId, active: true },
    orderBy: { priceEuros: "asc" },
  });
}

// Options actives du catalogue, pour le choix du périmètre d'une mission. Même
// raisonnement que listFormulesForMissionSetup() : lecture seule ouverte aux deux
// rôles Cabinet, alors que l'ÉDITION du catalogue reste CABINET_ADMIN.
export async function listOptionsForMissionSetup(): Promise<CatalogueOption[]> {
  const { tenantId } = await requireCabinetSession();

  return prisma.catalogueOption.findMany({
    where: { tenantId, active: true },
    orderBy: { priceEuros: "asc" },
  });
}

export async function createMission(
  establishmentId: string,
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const { tenantId, userId } = await requireEstablishmentInTenant(establishmentId);

  const existing = await prisma.mission.findUnique({ where: { establishmentId } });
  if (existing) return { error: "Une mission existe déjà pour cet établissement." };

  const formule = requiredEnum(formData, "formule", "La formule", CommercialTier);
  if (!formule.ok) return { error: formule.error };
  const gratuit = formData.get("gratuit") === "on";

  if (!(await assertFormuleAvailable(tenantId, formule.value))) {
    return { error: "Cette formule n'est pas disponible dans le catalogue." };
  }

  const options = await resolveSelectedOptions(tenantId, selectedOptionIds(formData));
  if (options === null) {
    return { error: "Une des options choisies n'est plus disponible au catalogue." };
  }
  const snapshots = toMissionOptionSnapshotsFromCatalogue(options);

  // Mission et options dans la MÊME transaction : une mission créée sans ses options
  // ouvrirait un périmètre faux au client jusqu'à ce que quelqu'un s'en aperçoive.
  const mission = await prisma.$transaction(async (tx) => {
    const created = await tx.mission.create({
      data: { tenantId, establishmentId, formule: formule.value, gratuit },
    });
    if (snapshots.length > 0) {
      await tx.missionOption.createMany({
        data: snapshots.map((snapshot) => ({ missionId: created.id, ...snapshot })),
      });
    }
    return created;
  });

  await recordAuditEvent({
    action: "MISSION_SCOPE_UPDATED",
    actorUserId: userId,
    establishmentId,
    targetId: mission.id,
    detail: summariseMissionScopeForAudit({
      formule: formule.value,
      gratuit,
      optionCount: snapshots.length,
    }),
  });

  for (const path of missionPaths(establishmentId)) revalidatePath(path);
  revalidatePath("/dashboard/client/accompagnement");
  return null;
}

export async function updateMissionScope(
  missionId: string,
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const { tenantId, userId } = await requireCabinetSession();

  const mission = await prisma.mission.findFirst({
    where: { id: missionId, tenantId },
    include: { options: { select: { catalogueOptionId: true, priceIsFirm: true } } },
  });
  if (!mission) notFound();

  const formule = requiredEnum(formData, "formule", "La formule", CommercialTier);
  if (!formule.ok) return { error: formule.error };
  const gratuit = formData.get("gratuit") === "on";

  if (!(await assertFormuleAvailable(tenantId, formule.value))) {
    return { error: "Cette formule n'est pas disponible dans le catalogue." };
  }

  const selected = selectedOptionIds(formData);
  const reconciliation = reconcileMissionOptions({
    current: mission.options.map((option) => option.catalogueOptionId),
    selected,
  });

  // Une option issue d'un devis SIGNÉ ne se retire pas depuis cet écran. Le devis
  // fait contrat : la retirer du périmètre fermerait au client un accès qu'il a payé,
  // sans trace côté commercial. La correction passe par un avenant, dans le module
  // devis — c'est-à-dire là où le client est engagé.
  const firmByOptionId = new Map(
    mission.options.map((option) => [option.catalogueOptionId, option.priceIsFirm])
  );
  if (reconciliation.toRemove.some((id) => firmByOptionId.get(id) === true)) {
    return {
      error:
        "Une option issue d'un devis signé ne peut pas être retirée ici. Passer par un avenant.",
    };
  }

  const added = await resolveSelectedOptions(tenantId, reconciliation.toAdd);
  if (added === null) {
    return { error: "Une des options choisies n'est plus disponible au catalogue." };
  }
  const snapshots = toMissionOptionSnapshotsFromCatalogue(added);

  await prisma.$transaction(async (tx) => {
    // Ne touche jamais aux statuts de checklist déjà cochés — une régression
    // Excellence → Essentiel masque seulement les phases hors scope, sans
    // détruire la progression déjà enregistrée (cf. plan §7 edge cases).
    await tx.mission.update({
      where: { id: missionId },
      data: { formule: formule.value, gratuit },
    });

    if (reconciliation.toRemove.length > 0) {
      await tx.missionOption.deleteMany({
        where: { missionId, catalogueOptionId: { in: reconciliation.toRemove } },
      });
    }
    if (snapshots.length > 0) {
      await tx.missionOption.createMany({
        data: snapshots.map((snapshot) => ({ missionId, ...snapshot })),
      });
    }
  });

  await recordAuditEvent({
    action: "MISSION_SCOPE_UPDATED",
    actorUserId: userId,
    establishmentId: mission.establishmentId,
    targetId: missionId,
    detail: summariseMissionScopeForAudit({
      formule: formule.value,
      gratuit,
      optionCount: reconciliation.unchanged.length + snapshots.length,
    }),
  });

  for (const path of missionPaths(mission.establishmentId)) revalidatePath(path);
  revalidatePath("/dashboard/client/accompagnement");
  return null;
}

export async function toggleChecklistItem(
  missionId: string,
  itemCode: string,
  completed: boolean
): Promise<{ error: string } | null> {
  const { tenantId } = await requireCabinetSession();

  const mission = await prisma.mission.findFirst({ where: { id: missionId, tenantId } });
  if (!mission) notFound();

  const item = await prisma.missionChecklistItem.findUnique({ where: { code: itemCode } });
  if (!item) notFound();

  // Garde serveur : un item hors offre (phase réservée OU item de diagnostic non
  // couvert, §12.4) n'est pas cochable. L'attribut `disabled` de l'UI ne prouve
  // rien — cette action est une route HTTP publique.
  if (!isChecklistItemApplicable(item.minFormule, mission.formule, mission.gratuit)) {
    return { error: "Cet item n'est pas disponible pour le périmètre de cette mission." };
  }

  await prisma.missionChecklistItemStatus.upsert({
    where: { missionId_itemId: { missionId, itemId: item.id } },
    update: { completed, completedAt: completed ? new Date() : null },
    create: { missionId, itemId: item.id, completed, completedAt: completed ? new Date() : null },
  });

  for (const path of missionPaths(mission.establishmentId)) revalidatePath(path);
  return null;
}

const PHASE_DATE_FIELDS: Record<
  Exclude<MissionChecklistScope, "DIAGNOSTIC">,
  { start: "fondationsStartDate" | "deploiementStartDate" | "consolidationStartDate" | "preparationFinaleStartDate"; end: "fondationsEndDate" | "deploiementEndDate" | "consolidationEndDate" | "preparationFinaleEndDate" }
> = {
  FONDATIONS: { start: "fondationsStartDate", end: "fondationsEndDate" },
  DEPLOIEMENT: { start: "deploiementStartDate", end: "deploiementEndDate" },
  CONSOLIDATION: { start: "consolidationStartDate", end: "consolidationEndDate" },
  PREPARATION_FINALE: { start: "preparationFinaleStartDate", end: "preparationFinaleEndDate" },
};

export async function updatePhaseDates(
  missionId: string,
  phase: Exclude<MissionChecklistScope, "DIAGNOSTIC">,
  startDate: string | null,
  endDate: string | null
): Promise<{ error: string } | null> {
  const { tenantId } = await requireCabinetSession();

  // `phase` est un argument d'action serveur, donc une entrée non fiable : sans
  // ce contrôle, une valeur inconnue produit `fields === undefined` et un accès
  // sur undefined.
  if (!(phase in PHASE_DATE_FIELDS)) return { error: "Phase inconnue." };

  const mission = await prisma.mission.findFirst({ where: { id: missionId, tenantId } });
  if (!mission) notFound();

  const fields = PHASE_DATE_FIELDS[phase];
  await prisma.mission.update({
    where: { id: missionId },
    data: {
      [fields.start]: startDate ? new Date(startDate) : null,
      [fields.end]: endDate ? new Date(endDate) : null,
    },
  });

  for (const path of missionPaths(mission.establishmentId)) revalidatePath(path);
  return null;
}

export type MissionWithProgress = {
  id: string;
  formule: CommercialTier;
  gratuit: boolean;
  fondationsStartDate: Date | null;
  fondationsEndDate: Date | null;
  deploiementStartDate: Date | null;
  deploiementEndDate: Date | null;
  consolidationStartDate: Date | null;
  consolidationEndDate: Date | null;
  preparationFinaleStartDate: Date | null;
  preparationFinaleEndDate: Date | null;
  items: {
    code: string;
    scope: MissionChecklistScope;
    label: string;
    order: number;
    completed: boolean;
    applicable: boolean;
  }[];
  // Options rattachées au périmètre. `priceIsFirm` distingue celles qui viennent
  // d'un devis signé (verrouillées ici) de celles rattachées à la main.
  options: {
    catalogueOptionId: string;
    labelSnapshot: string;
    priceIsFirm: boolean;
  }[];
  progress: MissionProgress;
};

export async function getMission(establishmentId: string): Promise<MissionWithProgress | null> {
  const { tenantId } = await requireCabinetSession();

  const mission = await prisma.mission.findFirst({
    where: { establishmentId, tenantId },
    include: {
      itemStatuses: true,
      options: {
        select: { catalogueOptionId: true, labelSnapshot: true, priceIsFirm: true },
        orderBy: { labelSnapshot: "asc" },
      },
    },
  });
  if (!mission) return null;

  const catalogItems = await prisma.missionChecklistItem.findMany({
    orderBy: [{ scope: "asc" }, { order: "asc" }],
  });

  const completedByItemId = new Map(mission.itemStatuses.map((s) => [s.itemId, s.completed]));

  const items = catalogItems.map((ci) => ({
    code: ci.code,
    scope: ci.scope,
    label: ci.label,
    order: ci.order,
    completed: completedByItemId.get(ci.id) ?? false,
    // Visible mais verrouillé quand l'offre ne le couvre pas : Sandrine doit voir
    // ce qu'un passage à l'offre supérieure débloquerait (§12.4).
    applicable: isChecklistItemApplicable(ci.minFormule, mission.formule, mission.gratuit),
  }));

  const progress = computeMissionProgress(
    catalogItems.map((ci) => ({
      scope: ci.scope,
      minFormule: ci.minFormule,
      completed: completedByItemId.get(ci.id) ?? false,
    })),
    mission.formule,
    mission.gratuit
  );

  return {
    id: mission.id,
    formule: mission.formule,
    gratuit: mission.gratuit,
    fondationsStartDate: mission.fondationsStartDate,
    fondationsEndDate: mission.fondationsEndDate,
    deploiementStartDate: mission.deploiementStartDate,
    deploiementEndDate: mission.deploiementEndDate,
    consolidationStartDate: mission.consolidationStartDate,
    consolidationEndDate: mission.consolidationEndDate,
    preparationFinaleStartDate: mission.preparationFinaleStartDate,
    preparationFinaleEndDate: mission.preparationFinaleEndDate,
    items,
    options: mission.options,
    progress,
  };
}

// Reflet en compteurs du portail client dans le portail interne de suivi — §12.4.
// Lecture seule : cette page ne propose aucun dépôt, le dépôt reste sur le portail
// client opérationnel. Le périmètre documentaire suit l'offre de la mission
// (Mission.formule + gratuit), jamais Establishment.commercialTier.
export async function getMissionDocumentCounters(
  establishmentId: string
): Promise<MissionDocumentCounters | null> {
  const { tenantId } = await requireEstablishmentInTenant(establishmentId);

  const mission = await prisma.mission.findFirst({ where: { establishmentId, tenantId } });
  if (!mission) return null;

  // Lecture partagée avec le portail client (« Mon accompagnement ») — les deux
  // portails affichent les MÊMES compteurs, ils ne peuvent pas les calculer
  // séparément sans finir par diverger (D1).
  return readMissionDocumentCounters(establishmentId, mission.formule, mission.gratuit);
}
