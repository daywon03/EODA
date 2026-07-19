import type { DevisStatus, ProspectStatus } from "@eoda/database";

// Moteur de calcul devis — pur, sans dépendance Prisma, réutilisable côté
// client pour une prévisualisation live. Règles : context/07-outil-pilotage-missions.md §6.1 et §6.3

export type DevisAmountsInput = {
  formulePriceEuros: number;
  optionPricesEuros: number[];
  depositPercent: number;
  installmentCount: number;
};

export type DevisAmounts = {
  totalAmountEuros: number;
  depositAmountEuros: number;
  balanceAmountEuros: number;
  installmentAmountEuros: number;
};

export function computeDevisAmounts({
  formulePriceEuros,
  optionPricesEuros,
  depositPercent,
  installmentCount,
}: DevisAmountsInput): DevisAmounts {
  const totalAmountEuros =
    formulePriceEuros + optionPricesEuros.reduce((sum, price) => sum + price, 0);
  const depositAmountEuros = Math.round((totalAmountEuros * depositPercent) / 100);
  const balanceAmountEuros = totalAmountEuros - depositAmountEuros;
  const installmentAmountEuros = Math.round(balanceAmountEuros / installmentCount);

  return { totalAmountEuros, depositAmountEuros, balanceAmountEuros, installmentAmountEuros };
}

export function computeValidUntil(createdAt: Date, validityDays: number): Date {
  const validUntil = new Date(createdAt);
  validUntil.setDate(validUntil.getDate() + validityDays);
  return validUntil;
}

// Effet de bord devis → prospect (§6.3, règle exacte implémentée dans saveDevis()
// du prototype) :
// - devis → SIGNE : le prospect passe à SIGNE, quel que soit son statut précédent.
// - devis → ENVOYE : le prospect passe à DEVIS_ENVOYE, mais seulement s'il est
//   actuellement NOUVEAU ou RDV (pas de rétrogradation depuis NEGOCIATION/SIGNE).
// - BROUILLON / REFUSE : aucun effet de bord.
export function nextProspectStatusForDevisTransition(
  devisStatus: DevisStatus,
  currentProspectStatus: ProspectStatus
): ProspectStatus | null {
  if (devisStatus === "SIGNE") return "SIGNE";

  if (devisStatus === "ENVOYE") {
    if (currentProspectStatus === "NOUVEAU" || currentProspectStatus === "RDV") {
      return "DEVIS_ENVOYE";
    }
    return null;
  }

  return null;
}
