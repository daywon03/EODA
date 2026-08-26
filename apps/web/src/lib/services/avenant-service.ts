import type { PricingUnit } from "@eoda/database";
import { buildEodaFileName } from "./document-naming-service";

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
};

// Les seules lignes qu'un avenant doit porter. Y mettre aussi les options du devis
// signé ferait signer deux fois la même chose, et laisserait croire que le contrat
// initial est remis en cause.
// Générique sur la forme reçue : la page de suivi ne charge que trois colonnes par
// option, le document imprimable les charge toutes. Exiger partout la ligne complète
// obligerait la page à lire des montants dont elle n'a pas l'usage.
export function selectAvenantLines<T extends { priceIsFirm: boolean }>(options: T[]): T[] {
  return options.filter((option) => !option.priceIsFirm);
}

export function needsAvenant(options: { priceIsFirm: boolean }[]): boolean {
  return selectAvenantLines(options).length > 0;
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
    ? ` signé le ${new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(input.signedOn)}`
    : "";

  return `Le présent avenant complète le devis ${input.contractReference}${signature}, dont les conditions restent inchangées pour tout ce qui n'est pas expressément modifié ci-dessous.`;
}
