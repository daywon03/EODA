import type { DocumentCategory } from "@eoda/database";
import type { DocumentStep } from "./document-workflow-service";

// ─────────────────────────────────────────────────────────────────────────────
// RESTITUTIONS & LIVRABLES — « mise à disposition des livrables VALIDÉS,
// téléchargement sécurisé » (CDC §5).
//
// Aucun modèle nouveau, et c'est volontaire : un livrable n'est pas un objet de plus
// à créer et à maintenir, c'est une VERSION de document produite par EODA sur un
// document que la consultante a validé. Ajouter une table « livrable » obligerait à
// la remplir à la main, donc à l'oublier — et à faire diverger deux vérités sur le
// même fichier.
//
// Le mot « validés » du CDC est pris au sérieux : seule l'étape `VALIDE` ouvre la
// remise. `Document.validatedAt` est le seul fait stocké du parcours documentaire
// précisément parce que valider engage la parole de l'évaluatrice
// (document-workflow-service) — c'est donc le bon verrou, et le même que celui qui
// empêche une analyse non relue d'atteindre le client.
//
// Ce qui n'est pas encore validé n'est pas caché pour autant : on en donne le NOMBRE.
// Un écran vide se lit comme une panne ; « 4 documents en cours de finalisation » se
// lit comme un travail en cours.
//
// Règles PURES : ni Prisma, ni React.
// ─────────────────────────────────────────────────────────────────────────────

export type DeliverableSourceVersion = {
  id: string;
  versionNumber: number;
  originalFilename: string;
  uploadedAt: Date;
  producedByCabinet: boolean;
};

export type DeliverableSourceItem = {
  code: string;
  label: string;
  category: DocumentCategory;
  step: DocumentStep;
  // Date de validation par la consultante (Document.validatedAt). La remise a lieu
  // quand le document est À LA FOIS produit et validé : c'est la plus tardive des
  // deux dates qui dit quand le client l'a reçu.
  validatedAt: Date | null;
  versions: readonly DeliverableSourceVersion[];
};

export type Deliverable = {
  code: string;
  label: string;
  category: DocumentCategory;
  documentVersionId: string;
  filename: string;
  remittedOn: Date;
};

// La version remise est la DERNIÈRE produite par EODA, pas la dernière tout court :
// si le client a redéposé une pièce après la remise, c'est toujours le document
// d'EODA qui constitue le livrable.
function latestCabinetVersion(
  versions: readonly DeliverableSourceVersion[]
): DeliverableSourceVersion | null {
  const produced = versions
    .filter((version) => version.producedByCabinet)
    .sort((a, b) => b.versionNumber - a.versionNumber);
  return produced[0] ?? null;
}

// Un fichier déposé le 3 et validé le 10 est remis le 10 : c'est ce jour-là qu'il
// apparaît au client. À l'inverse, une nouvelle version déposée sur un document déjà
// validé est remise le jour de son dépôt.
function remittanceDate(uploadedAt: Date, validatedAt: Date | null): Date {
  if (validatedAt === null) return uploadedAt;
  return validatedAt.getTime() > uploadedAt.getTime() ? validatedAt : uploadedAt;
}

export function selectDeliverables(items: readonly DeliverableSourceItem[]): Deliverable[] {
  const deliverables: Deliverable[] = [];

  for (const item of items) {
    if (item.step !== "VALIDE") continue;

    const version = latestCabinetVersion(item.versions);
    // Un document validé sans version produite par EODA existe : la pièce du client
    // était conforme telle quelle. Ce n'est pas un livrable — EODA n'a rien remis —
    // et le compter comme tel gonflerait la valeur perçue de la prestation.
    if (!version) continue;

    deliverables.push({
      code: item.code,
      label: item.label,
      category: item.category,
      documentVersionId: version.id,
      filename: version.originalFilename,
      remittedOn: remittanceDate(version.uploadedAt, item.validatedAt),
    });
  }

  return deliverables.sort((a, b) => b.remittedOn.getTime() - a.remittedOn.getTime());
}

// Ce qu'EODA a produit mais n'a pas encore validé. Compté, jamais listé : annoncer
// « votre livret d'accueil arrive » avant que la consultante l'ait validé, c'est
// promettre à sa place.
export function countDeliverablesInProgress(items: readonly DeliverableSourceItem[]): number {
  return items.filter(
    (item) => item.step !== "VALIDE" && latestCabinetVersion(item.versions) !== null
  ).length;
}

export function groupDeliverablesByCategory(
  deliverables: readonly Deliverable[]
): Map<DocumentCategory, Deliverable[]> {
  const grouped = new Map<DocumentCategory, Deliverable[]>();
  for (const deliverable of deliverables) {
    const bucket = grouped.get(deliverable.category) ?? [];
    bucket.push(deliverable);
    grouped.set(deliverable.category, bucket);
  }
  return grouped;
}

// ── Nouveauté dans le portail ────────────────────────────────────────────────
//
// « Nouveau » n'est pas stocké par livrable : c'est ce qui a été remis après la
// dernière ouverture de « Mes livrables » par la personne
// (EstablishmentUser.deliverablesSeenAt). Jamais ouverte (null) : tout est nouveau
// — la personne n'a encore rien vu.
export function isNewDeliverable(deliverable: Deliverable, seenAt: Date | null): boolean {
  return seenAt === null || deliverable.remittedOn.getTime() > seenAt.getTime();
}

export function countNewDeliverables(
  deliverables: readonly Deliverable[],
  seenAt: Date | null
): number {
  return deliverables.filter((deliverable) => isNewDeliverable(deliverable, seenAt)).length;
}
