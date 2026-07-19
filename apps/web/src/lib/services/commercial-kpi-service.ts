import type { CommercialTier, DevisStatus, ProspectStatus, ProspectType } from "@eoda/database";

// Agrégations KPI pures — context/07-outil-pilotage-missions.md §8. Consomment des
// tableaux déjà chargés par l'action (pas d'accès Prisma ici). Les KPI liés au
// suivi de mission (missions bêta-test, répartition par formule de mission) sont
// hors périmètre de cette itération — non implémentés ici.

export type KpiDevis = {
  status: DevisStatus;
  totalAmountEuros: number;
  catalogueFormule: { formule: CommercialTier };
  prospect: { status: ProspectStatus };
};

export type KpiProspect = {
  status: ProspectStatus;
  structureType: ProspectType;
};

export function computeConversionRatePercent(devisList: KpiDevis[]): number {
  if (devisList.length === 0) return 0;
  const signedCount = devisList.filter((d) => d.status === "SIGNE").length;
  return Math.round((signedCount / devisList.length) * 100);
}

// Pipeline pondéré = Σ montant des devis au statut ENVOYE × 0,30
//                  + Σ montant des devis dont le prospect est en NEGOCIATION × 0,60
export function computeWeightedPipelineEuros(devisList: KpiDevis[]): number {
  const envoyeSum = devisList
    .filter((d) => d.status === "ENVOYE")
    .reduce((sum, d) => sum + d.totalAmountEuros, 0);
  const negociationSum = devisList
    .filter((d) => d.prospect.status === "NEGOCIATION")
    .reduce((sum, d) => sum + d.totalAmountEuros, 0);

  return Math.round(envoyeSum * 0.3 + negociationSum * 0.6);
}

export function computeSignedRevenueEuros(devisList: KpiDevis[]): number {
  return devisList
    .filter((d) => d.status === "SIGNE")
    .reduce((sum, d) => sum + d.totalAmountEuros, 0);
}

export function groupProspectsByStructureType(
  prospects: KpiProspect[]
): Record<ProspectType, number> {
  const result: Record<ProspectType, number> = { ASSOCIATION: 0, PRIVE: 0, PUBLIC: 0 };
  for (const p of prospects) result[p.structureType]++;
  return result;
}

export function groupProspectsByStatus(prospects: KpiProspect[]): Record<ProspectStatus, number> {
  const result: Record<ProspectStatus, number> = {
    NOUVEAU: 0,
    RDV: 0,
    DEVIS_ENVOYE: 0,
    NEGOCIATION: 0,
    SIGNE: 0,
    PERDU: 0,
  };
  for (const p of prospects) result[p.status]++;
  return result;
}

// Répartition des devis signés par formule — analogue, dans le périmètre actuel,
// au KPI "répartition des missions par formule" (hors scope, pas de modèle Mission).
export function groupSignedDevisByFormule(devisList: KpiDevis[]): Record<CommercialTier, number> {
  const result: Record<CommercialTier, number> = { BETA: 0, ESSENTIEL: 0, PERFORMANCE: 0, EXCELLENCE: 0 };
  for (const d of devisList.filter((d) => d.status === "SIGNE")) {
    result[d.catalogueFormule.formule]++;
  }
  return result;
}
