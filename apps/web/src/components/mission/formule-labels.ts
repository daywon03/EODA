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
