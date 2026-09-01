import type { CommercialTier } from "@eoda/database";

// ─────────────────────────────────────────────────────────────────────────────
// ABONNEMENT PORTAIL EODA — 400 €/mois, engagement 1 an, dégressif selon l'offre.
//
// Décisions du call du 16/08 (§12.2, [3:44:02]) : 400 €/mois, **engagement 1 an à
// reconduction tacite** ([4:09:00]), et une dégressivité chiffrée — **-10 % en
// Performance, -30 % en Excellence**. La plaquette v10 écrit seulement « à partir de
// 400 € (dégressif selon l'abonnement) » : « le taux n'y figure pas, **le calcul doit
// vivre dans l'outil** ». C'est ce fichier.
//
// Pourquoi ici et pas dans le catalogue : la remise ne dépend pas de la ligne de
// catalogue, elle dépend de l'OFFRE souscrite à côté. Une colonne `discount` sur
// l'option serait fausse dès qu'un second devis choisit une autre formule.
//
// Le montant reste un « à partir de » comme tout le reste (§12.3) : c'est un point de
// départ de négociation, pas un tarif public opposable.
//
// Règles PURES : ni Prisma, ni React.
// ─────────────────────────────────────────────────────────────────────────────

// Code catalogue de l'abonnement (seed : packages/database/prisma/seed.ts).
// L'appariement se fait par CODE et non par libellé : un libellé se réécrit depuis
// l'écran catalogue, un code non.
export const SUBSCRIPTION_OPTION_CODE = "VEILLE_PORTAIL_EODA";

// Engagement minimal, en mois. Porté aussi par `minQuantity` au catalogue — la valeur
// ici sert à l'expliquer à l'écran, pas à recalculer le devis.
export const SUBSCRIPTION_MINIMUM_MONTHS = 12;

export const SUBSCRIPTION_COMMITMENT_NOTICE =
  "Engagement de 12 mois, à reconduction tacite.";

// -10 % en Performance, -30 % en Excellence. Essentiel ne donne aucune remise : c'est
// l'offre d'entrée, la dégressivité est précisément ce qui récompense les deux autres.
// `BETA` est traité comme Excellence : le bêta-test reçoit le périmètre Excellence
// complet (§7.5), et lui annoncer un tarif d'entrée de gamme serait incohérent avec
// tout le reste de son portail.
export function subscriptionDiscountPercent(formule: CommercialTier): number {
  switch (formule) {
    case "ESSENTIEL":
      return 0;
    case "PERFORMANCE":
      return 10;
    case "EXCELLENCE":
    case "BETA":
      return 30;
  }
}

export function isSubscriptionOption(code: string): boolean {
  return code === SUBSCRIPTION_OPTION_CODE;
}

// Prix mensuel après dégressivité, arrondi à l'euro. Arrondi et non centimes : tous
// les montants du dépôt sont des entiers d'euros, et un devis au centime près
// prétendrait à une précision que le mot « à partir de » démentit.
export function subscriptionMonthlyPriceEuros(
  basePriceEuros: number,
  formule: CommercialTier
): number {
  const discount = subscriptionDiscountPercent(formule);
  if (discount === 0) return basePriceEuros;
  return Math.round((basePriceEuros * (100 - discount)) / 100);
}

// Prix unitaire à retenir pour une option donnée, compte tenu de l'offre du devis.
// Seul l'abonnement est dégressif ; toute autre option passe inchangée. Une fonction
// unique appelée par le devis, son aperçu et le portail client : trois calculs de
// remise finiraient par afficher trois prix pour le même abonnement (D1).
export function optionUnitPriceForFormule(
  option: { code: string; priceEuros: number },
  formule: CommercialTier | null
): number {
  if (formule === null) return option.priceEuros;
  if (!isSubscriptionOption(option.code)) return option.priceEuros;
  return subscriptionMonthlyPriceEuros(option.priceEuros, formule);
}

// Phrase de dégressivité, à afficher à côté du prix. `null` quand il n'y a rien à
// annoncer : écrire « remise de 0 % » attire l'attention sur une absence.
export function describeSubscriptionDiscount(formule: CommercialTier | null): string | null {
  if (formule === null) return null;
  const discount = subscriptionDiscountPercent(formule);
  if (discount === 0) return null;
  return `Tarif dégressif appliqué : -${discount} % au titre de votre offre.`;
}
