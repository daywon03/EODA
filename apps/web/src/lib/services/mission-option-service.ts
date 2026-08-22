import type { PricingUnit } from "@eoda/database";

// ─────────────────────────────────────────────────────────────────────────────
// OPTIONS RATTACHÉES AU PÉRIMÈTRE D'UNE MISSION — règles pures.
//
// Deux chemins mènent une option sur une mission, et ils n'ont pas la même valeur
// juridique :
//
//   1. Signature d'un devis (`convertDevisToClient`) — le snapshot est recopié du
//      devis, document commercial qui fait contrat. Montant FERME.
//   2. Rattachement à la main par le cabinet, ici — il n'existe aucun devis. Le
//      snapshot est recopié du CATALOGUE, où le prix est un « à partir de ».
//      Montant NON ferme.
//
// Confondre les deux afficherait une estimation comme un engagement sur le portail
// client (CLAUDE.md §7). D'où `priceIsFirm`, porté par la donnée et pas par la vue :
// un composant ne peut pas se tromper sur une information qu'il n'a pas à deviner.
//
// Service PUR : ni Prisma, ni session. Il reçoit des lignes déjà lues et cloisonnées
// par la couche d'autorisation.
// ─────────────────────────────────────────────────────────────────────────────

// Ligne de catalogue telle que lue en base, réduite à ce qui part en snapshot.
export type CatalogueOptionForMission = {
  id: string;
  label: string;
  priceEuros: number;
  pricingUnit: PricingUnit;
  priceMaxEuros: number | null;
  minQuantity: number | null;
};

export type MissionOptionSnapshot = {
  catalogueOptionId: string;
  labelSnapshot: string;
  priceSnapshotEuros: number;
  pricingUnitSnapshot: PricingUnit;
  priceMaxSnapshotEuros: number | null;
  minQuantitySnapshot: number | null;
  priceIsFirm: boolean;
};

// Fige les lignes de catalogue choisies. Le prix vient de la BASE, jamais du
// formulaire : un `<input hidden name="price">` est une entrée non fiable, et rien
// n'empêche un POST direct sur l'action serveur d'y mettre ce qu'il veut.
//
// `priceIsFirm: false` sans exception : cette fonction ne sert qu'au rattachement
// manuel. Le chemin « signature » a le sien (`toMissionOptionSnapshots`), qui recopie
// le devis — les deux ne doivent pas être fusionnés « puisque c'est le même objet ».
export function toMissionOptionSnapshotsFromCatalogue(
  options: readonly CatalogueOptionForMission[]
): MissionOptionSnapshot[] {
  return options.map((option) => ({
    catalogueOptionId: option.id,
    labelSnapshot: option.label,
    priceSnapshotEuros: option.priceEuros,
    pricingUnitSnapshot: option.pricingUnit,
    priceMaxSnapshotEuros: option.priceMaxEuros,
    minQuantitySnapshot: option.minQuantity,
    priceIsFirm: false,
  }));
}

export type MissionOptionReconciliation = {
  toAdd: string[];
  toRemove: string[];
  // Options déjà rattachées ET toujours sélectionnées : on n'y touche PAS. Réécrire
  // leur snapshot au passage ferait dériver un montant ferme vers le prix courant du
  // catalogue, c'est-à-dire réécrire un contrat signé sans que personne ne l'ait
  // demandé.
  unchanged: string[];
};

// Différence entre le périmètre actuel et celui demandé, exprimée en identifiants de
// catalogue. Comparer par `catalogueOptionId` et jamais par l'identifiant de la ligne
// `MissionOption` : c'est le premier qui porte l'unicité en base
// (`@@unique([missionId, catalogueOptionId])`).
export function reconcileMissionOptions(input: {
  current: readonly string[];
  selected: readonly string[];
}): MissionOptionReconciliation {
  const current = new Set(input.current);
  // Le formulaire peut renvoyer deux fois la même case si le DOM a été bricolé ;
  // dédupliquer ici évite de compter sur `skipDuplicates` pour rattraper une entrée
  // malformée.
  const selected = new Set(input.selected);

  return {
    toAdd: [...selected].filter((id) => !current.has(id)),
    toRemove: [...current].filter((id) => !selected.has(id)),
    unchanged: [...selected].filter((id) => current.has(id)),
  };
}

// Résumé non nominatif du périmètre, destiné au champ `detail` du journal d'audit :
// formule et nombre d'options. Aucune donnée personnelle, aucun nom de structure
// (CLAUDE.md §5 bis).
export function summariseMissionScopeForAudit(input: {
  formule: string;
  gratuit: boolean;
  optionCount: number;
}): string {
  const parts = [input.formule, `${input.optionCount} option(s)`];
  if (input.gratuit) parts.push("gratuit");
  return parts.join(" · ");
}
