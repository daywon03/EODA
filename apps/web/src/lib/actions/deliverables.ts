"use server";

import { prisma } from "@eoda/database";
import { requireClientEstablishment } from "@/lib/auth/guards";
import { getEstablishmentCoveredCategories } from "@/lib/services/establishment-offer-service";
import {
  countNewDeliverables,
  selectDeliverables,
  type DeliverableSourceItem,
} from "@/lib/services/deliverables-service";

// ─────────────────────────────────────────────────────────────────────────────
// NOUVEAUX LIVRABLES dans le portail client — la notification « dans l'app »
// (27/09/2026), pendant de l'e-mail envoyé à la validation (document.ts).
//
// Aucune table de notifications : le seul fait stocké est la date à laquelle la
// personne a ouvert « Mes livrables » (EstablishmentUser.deliverablesSeenAt). Ce
// qui est nouveau se DÉRIVE de cette date et des livrables eux-mêmes, par les
// mêmes règles pures que la page (deliverables-service) — une pastille qui
// calculerait à sa façon finirait par annoncer un livrable que la page ne montre pas.
//
// Toutes ces actions passent par `requireClientEstablishment` : l'établissement et
// la personne sont ceux de la SESSION. Aucune n'accepte d'identifiant, il n'y a
// donc rien à falsifier.
// ─────────────────────────────────────────────────────────────────────────────

// Pastille de l'onglet « Mes livrables », affichée sur chaque écran du portail :
// lecture volontairement légère — seulement les documents validés et leur dernière
// version produite par EODA, pas toute la checklist et ses analyses.
export async function getClientNewDeliverablesCount(): Promise<number> {
  const { establishment, userId } = await requireClientEstablishment();
  if (!establishment) return 0;

  const [link, covered, documents] = await Promise.all([
    prisma.establishmentUser.findUnique({
      where: { userId_establishmentId: { userId, establishmentId: establishment.id } },
      select: { deliverablesSeenAt: true },
    }),
    // Même périmètre que la checklist : un document hors offre n'apparaît pas dans
    // « Mes livrables », il ne doit pas non plus allumer la pastille.
    getEstablishmentCoveredCategories(establishment.id),
    prisma.document.findMany({
      where: { establishmentId: establishment.id, validatedAt: { not: null } },
      select: {
        validatedAt: true,
        documentType: { select: { code: true, label: true, category: true } },
        versions: {
          where: { uploadedBy: { role: { not: "CLIENT_USER" } } },
          orderBy: { versionNumber: "desc" },
          take: 1,
          select: { id: true, versionNumber: true, originalFilename: true, uploadedAt: true },
        },
      },
    }),
  ]);

  const items: DeliverableSourceItem[] = documents.flatMap((document) => {
    const type = document.documentType;
    if (!type || (covered && !covered.includes(type.category))) return [];
    return [
      {
        code: type.code,
        label: type.label,
        category: type.category,
        step: "VALIDE" as const,
        validatedAt: document.validatedAt,
        versions: document.versions.map((version) => ({ ...version, producedByCabinet: true })),
      },
    ];
  });

  return countNewDeliverables(selectDeliverables(items), link?.deliverablesSeenAt ?? null);
}

// Date de la précédente ouverture, lue par la page AVANT qu'elle ne soit remplacée :
// c'est elle qui dit quelles lignes marquer « Nouveau ».
export async function getClientDeliverablesSeenAt(): Promise<Date | null> {
  const { establishment, userId } = await requireClientEstablishment();
  if (!establishment) return null;

  const link = await prisma.establishmentUser.findUnique({
    where: { userId_establishmentId: { userId, establishmentId: establishment.id } },
    select: { deliverablesSeenAt: true },
  });
  return link?.deliverablesSeenAt ?? null;
}

// Appelée par la page « Mes livrables » une fois affichée. Pas de revalidatePath :
// la page en cours perdrait sinon ses marques « Nouveau » sous les yeux de la
// personne qui venait les lire.
export async function markDeliverablesSeen(): Promise<void> {
  const { establishment, userId } = await requireClientEstablishment();
  if (!establishment) return;

  await prisma.establishmentUser.update({
    where: { userId_establishmentId: { userId, establishmentId: establishment.id } },
    data: { deliverablesSeenAt: new Date() },
  });
}
