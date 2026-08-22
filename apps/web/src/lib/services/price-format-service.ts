import type { PricingUnit } from "@eoda/database";

// ─────────────────────────────────────────────────────────────────────────────
// FORMATAGE DES MONTANTS — point unique de rendu d'un prix dans l'application.
//
// Existait auparavant sous forme de `toLocaleString("fr-FR")` recopié dans huit
// composants : chaque évolution de règle d'affichage devait donc être appliquée
// huit fois, et l'était sept (D1).
//
// Deux règles métier sont encodées ici, et nulle part ailleurs :
//  1. Un prix du catalogue s'affiche « À partir de … », jamais comme un prix fixe
//     (context/07-outil-pilotage-missions.md §12.3 — c'est Sandrine qui coche les
//     options pendant la réunion d'évaluation des besoins, le client ne
//     s'auto-configure pas).
//  2. Le montant seul ne suffit pas : une prestation peut être tarifée à l'heure
//     (avec fourchette et minimum facturable), au document, au support ou au mois
//     (abonnement à engagement d'un an) — cf. .claude/context/08-offre-commerciale-v10.md §04.
//
// Le groupement des milliers est fait à la main plutôt que par Intl : un runtime
// Node compilé en small-icu rendrait `toLocaleString("fr-FR")` en séparateur
// anglo-saxon sans le signaler, sur un document envoyé au client.
// ─────────────────────────────────────────────────────────────────────────────

// Espace fine insécable (U+202F) entre les milliers, espace insécable (U+00A0)
// avant le symbole € — typographie française.
const THOUSANDS_SEPARATOR = "\u202F";
const NO_BREAK_SPACE = "\u00A0";

export const STARTING_PRICE_PREFIX = "À partir de";

export type PricedItem = {
  priceEuros: number;
  pricingUnit?: PricingUnit | null;
  priceMaxEuros?: number | null;
  minQuantity?: number | null;
};

// Suffixe d'unité affiché après le montant. FORFAIT n'en a pas : le montant est
// global, écrire « / forfait » n'apporterait rien.
const UNIT_SUFFIX: Record<PricingUnit, string> = {
  FORFAIT: "",
  HEURE: "/ h",
  JOUR: "/ jour",
  DOCUMENT: "/ document",
  SUPPORT: "/ support",
  MOIS: "/ mois",
};

// Libellé de la quantité minimale, accordé en nombre. FORFAIT en est exclu par le
// type : un forfait est indivisible, il n'a pas de quantité minimale.
const UNIT_QUANTITY_LABEL: Record<Exclude<PricingUnit, "FORFAIT">, (quantity: number) => string> = {
  HEURE: () => "h",
  JOUR: (quantity) => (quantity > 1 ? "jours" : "jour"),
  DOCUMENT: (quantity) => (quantity > 1 ? "documents" : "document"),
  SUPPORT: (quantity) => (quantity > 1 ? "supports" : "support"),
  MOIS: () => "mois",
};

function groupThousands(amountEuros: number): string {
  return Math.round(Math.abs(amountEuros))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS_SEPARATOR);
}

// Montant nu, sans unité ni préfixe : « 15 000 € ». Réservé aux montants qui ne
// sont pas une offre de prix (KPI internes, montant estimé d'un prospect, solde
// et échéances d'un devis, déjà dérivés d'un total « à partir de »).
export function formatEuros(amountEuros: number): string {
  const sign = Math.round(amountEuros) < 0 ? "-" : "";
  return `${sign}${groupThousands(amountEuros)}${NO_BREAK_SPACE}€`;
}

// Fourchette éventuelle, sans préfixe ni unité : « 95 à 120 € ».
function formatAmountRange(item: PricedItem): string {
  const { priceEuros, priceMaxEuros } = item;
  if (priceMaxEuros === null || priceMaxEuros === undefined || priceMaxEuros <= priceEuros) {
    return formatEuros(priceEuros);
  }
  return `${groupThousands(priceEuros)} à ${formatEuros(priceMaxEuros)}`;
}

// Mention de quantité minimale : « (mini. 2 h) », « (engagement 12 mois minimum) ».
// Vide si aucun minimum, si le minimum vaut 1, ou sur un FORFAIT (un forfait est
// indivisible : un minimum n'y a pas de sens).
function formatMinQuantity(item: PricedItem): string {
  const unit = item.pricingUnit ?? "FORFAIT";
  const quantity = item.minQuantity;
  if (unit === "FORFAIT") return "";
  if (quantity === null || quantity === undefined || quantity <= 1) return "";
  if (unit === "MOIS") return `(engagement ${quantity} ${UNIT_QUANTITY_LABEL.MOIS(quantity)} minimum)`;
  return `(mini. ${quantity} ${UNIT_QUANTITY_LABEL[unit](quantity)})`;
}

// Prix nu avec son unité et son minimum, sans le préfixe « À partir de » —
// utile là où le préfixe est déjà porté par le libellé de la colonne.
export function formatPriceWithUnit(item: PricedItem): string {
  const unit = item.pricingUnit ?? "FORFAIT";
  return [formatAmountRange(item), UNIT_SUFFIX[unit], formatMinQuantity(item)]
    .filter((part) => part.length > 0)
    .join(" ");
}

// Rendu canonique d'un prix du catalogue : « À partir de 95 à 120 € / h (mini. 2 h) ».
export function formatStartingPrice(item: PricedItem): string {
  return `${STARTING_PRICE_PREFIX} ${formatPriceWithUnit(item)}`;
}
