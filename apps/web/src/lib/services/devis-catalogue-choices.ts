import type { CommercialTier, PricingUnit } from "@eoda/database";

// Ce que le formulaire de devis reçoit du catalogue — une seule projection, lue par
// « Nouveau devis », « Corriger un devis » et « Évaluation des besoins » (D1 : trois
// recopies du même `map` finissaient par oublier une colonne, ici le prix mensuel).
// Seules les lignes EN VENTE sont proposées ; le serveur le revérifie (resolveDevisLines).

export type DevisFormuleChoice = {
  formule: CommercialTier;
  label: string;
  priceEuros: number;
  monthlyPriceEuros: number | null;
  modulesLabel: string | null;
  description: string | null;
};

export type DevisOptionChoice = {
  id: string;
  // L'appariement de l'abonnement portail (dégressif selon l'offre) se fait par
  // code, jamais par libellé (CLAUDE.md §7).
  code: string;
  label: string;
  audienceLabel: string | null;
  priceEuros: number;
  pricingUnit: PricingUnit;
  priceMaxEuros: number | null;
  minQuantity: number | null;
};

type CatalogueRows = {
  formules: readonly (DevisFormuleChoice & { id: string; active: boolean })[];
  options: readonly (Omit<DevisOptionChoice, "audienceLabel"> & { active: boolean; audienceLabel?: string | null })[];
};

export function toDevisCatalogueChoices(catalogue: CatalogueRows): {
  formules: DevisFormuleChoice[];
  options: DevisOptionChoice[];
} {
  return {
    formules: catalogue.formules
      .filter((f) => f.active)
      .map((f) => ({
        formule: f.formule,
        label: f.label,
        priceEuros: f.priceEuros,
        monthlyPriceEuros: f.monthlyPriceEuros,
        modulesLabel: f.modulesLabel,
        description: f.description,
      })),
    options: catalogue.options
      .filter((o) => o.active)
      .map((o) => ({
        id: o.id,
        code: o.code,
        label: o.label,
        audienceLabel: o.audienceLabel ?? null,
        priceEuros: o.priceEuros,
        pricingUnit: o.pricingUnit,
        priceMaxEuros: o.priceMaxEuros,
        minQuantity: o.minQuantity,
      })),
  };
}
