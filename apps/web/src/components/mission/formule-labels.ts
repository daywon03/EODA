import type { CommercialTier } from "@eoda/database";

// Source unique des libellés de formule, comme PROSPECT_STATUS_LABELS et
// FUNNEL_STAGE_LABELS. Extrait de MissionSummaryCard le jour où les KPI de
// portefeuille ont eu besoin des mêmes libellés : une seconde copie aurait suffi à
// ce que deux écrans nomment différemment la même formule.
export const FORMULE_LABELS: Record<CommercialTier, string> = {
  BETA: "Bêta",
  ESSENTIEL: "Essentiel",
  PERFORMANCE: "Performance",
  EXCELLENCE: "Excellence",
};

// Mission ou devis SANS offre (prestations à la carte seules, 11/10/2026) : la formule
// est nulle. Libellé unique pour ce cas, au même endroit que les autres.
export const NO_FORMULE_LABEL = "Prestations à la carte";

export function formuleLabel(formule: CommercialTier | null): string {
  return formule === null ? NO_FORMULE_LABEL : FORMULE_LABELS[formule];
}
