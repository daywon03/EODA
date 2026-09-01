import type { PricingUnit } from "@eoda/database";
import { buildEodaFileName } from "./document-naming-service";
import { formatDate } from "./date-format-service";

// ─────────────────────────────────────────────────────────────────────────────
// AVENANT — « génération de contrat + avenant obligatoire pour toute option
// souscrite hors contrat initial » (§12.6, call du 16/08).
//
// Ce que « hors contrat initial » veut dire ici, très précisément :
// `MissionOption.priceIsFirm`. Une option issue d'un devis SIGNÉ est déjà au
// contrat — le devis EST le document contractuel (CLAUDE.md §7 : les DevisOption
// font contrat et ne se réécrivent jamais). Une option rattachée à la main au
// périmètre de la mission, elle, n'est couverte par aucun document signé : c'est
// exactement le cas que l'avenant existe pour régulariser.
//
// L'avenant ne réinvente aucune clause : il constate ce qui s'ajoute, à quel prix,
// et renvoie aux conditions du contrat initial. Écrire des clauses nouvelles serait
// produire du droit à la place de Sandrine.
//
// Règles PURES : ni Prisma, ni React.
// ─────────────────────────────────────────────────────────────────────────────

export type MissionOptionLine = {
  catalogueOptionId: string;
  labelSnapshot: string;
  priceSnapshotEuros: number;
  pricingUnitSnapshot: PricingUnit;
  priceMaxSnapshotEuros: number | null;
  minQuantitySnapshot: number | null;
  priceIsFirm: boolean;
  // Date de retour de l'avenant signé, quand il est revenu. Une option régularisée
  // n'a plus rien à faire sur un nouvel avenant : la refaire signer laisserait
  // croire que la première signature n'a pas compté.
  avenantSignedOn?: Date | null;
};

// Les seules lignes qu'un avenant doit porter. Y mettre aussi les options du devis
// signé ferait signer deux fois la même chose, et laisserait croire que le contrat
// initial est remis en cause.
// Générique sur la forme reçue : la page de suivi ne charge que trois colonnes par
// option, le document imprimable les charge toutes. Exiger partout la ligne complète
// obligerait la page à lire des montants dont elle n'a pas l'usage.
export function selectAvenantLines<
  T extends { priceIsFirm: boolean; avenantSignedOn?: Date | null },
>(options: T[]): T[] {
  return options.filter((option) => !option.priceIsFirm && !option.avenantSignedOn);
}

export function needsAvenant(
  options: { priceIsFirm: boolean; avenantSignedOn?: Date | null }[]
): boolean {
  return selectAvenantLines(options).length > 0;
}

// Une option régularisée par un avenant SIGNÉ ne se retire plus depuis l'écran de
// mission — un document signé ne s'annule pas en décochant une case. Même règle que
// pour une option issue d'un devis, pour la même raison, d'où une seule fonction :
// deux contrôles séparés, c'est un des deux qui finira par manquer.
export function isOptionContractuallyLocked(option: {
  priceIsFirm: boolean;
  avenantSignedOn?: Date | null;
}): boolean {
  return option.priceIsFirm || option.avenantSignedOn != null;
}

// Ce que l'écran affiche à côté d'une option rattachée hors devis. Trois états, et le
// deuxième est celui qui manquait : l'avenant existait, personne ne savait où il en
// était.
export function describeAvenantState(option: {
  priceIsFirm: boolean;
  avenantSignedOn?: Date | null;
}): string | null {
  if (option.priceIsFirm) return null;
  if (option.avenantSignedOn) {
    return `Avenant signé le ${formatDate(option.avenantSignedOn)}`;
  }
  return "Avenant à faire signer";
}

// Somme des montants catalogue des lignes de l'avenant. C'est un « à partir de » et
// il doit être rendu comme tel (`formatStartingPrice`) : ces prix viennent du
// catalogue, pas d'un devis signé — les afficher comme fermes inventerait un
// engagement que personne n'a chiffré.
export function avenantStartingTotalEuros(
  options: { priceIsFirm: boolean; priceSnapshotEuros: number }[]
): number {
  return selectAvenantLines(options).reduce(
    (total, option) => total + option.priceSnapshotEuros,
    0
  );
}

export function buildAvenantFileName(input: {
  structureName: string;
  issuedOn: Date;
  // Numéro du devis initial quand il existe — l'avenant se rattache à un contrat.
  contractReference: string | null;
}): string {
  return buildEodaFileName({
    issuedOn: input.issuedOn,
    type: "AVENANT",
    clientName: input.structureName,
    // Sans devis d'origine (fiche antérieure à l'entonnoir unique, bêta-test),
    // l'objet nomme la mission plutôt que d'inventer une référence contractuelle.
    objet: input.contractReference ?? "Perimetre-mission",
    audience: "Externe",
    extension: "pdf",
  });
}

// Phrase de rattachement, en tête de l'avenant. Deux formulations et pas une : dire
// « avenant au devis n° … » quand aucun devis n'existe serait faux, et un document
// contractuel faux est pire qu'un document absent.
export function describeContractReference(input: {
  contractReference: string | null;
  signedOn: Date | null;
}): string {
  if (!input.contractReference) {
    return "Le présent avenant complète le périmètre d'accompagnement convenu entre les parties.";
  }

  const signature = input.signedOn
    ? ` signé le ${formatDate(input.signedOn)}`
    : "";

  return `Le présent avenant complète le devis ${input.contractReference}${signature}, dont les conditions restent inchangées pour tout ce qui n'est pas expressément modifié ci-dessous.`;
}
