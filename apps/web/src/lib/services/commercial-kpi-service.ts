import type { CommercialTier, DevisStatus, ProspectStatus } from "@eoda/database";
import { isDevisCountedInKpi } from "./devis-transition-service";

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

// Un devis ANNULE n'existe plus commercialement : sa ligne et son numéro restent en
// base (la série numérotée ne doit pas avoir de trou) mais il ne doit apparaître
// dans AUCUN indicateur. Le filtre est appliqué une fois, ici, en entrée de chaque
// agrégat — le laisser à chaque fonction, c'est l'oublier dans la prochaine.
function counted(devisList: KpiDevis[]): KpiDevis[] {
  return devisList.filter((d) => isDevisCountedInKpi(d.status));
}

// Nombre de devis « émis » affiché sur le tableau de bord. Un devis annulé n'est
// pas décompté : sinon l'annulation d'une erreur de saisie continue de gonfler
// l'activité commerciale affichée.
export function computeIssuedDevisCount(devisList: KpiDevis[]): number {
  return counted(devisList).length;
}

export function computeConversionRatePercent(devisList: KpiDevis[]): number {
  // Les devis annulés sortent du dénominateur ET du numérateur : les garder au
  // dénominateur écraserait le taux de conversion à chaque correction d'erreur.
  const active = counted(devisList);
  if (active.length === 0) return 0;
  const signedCount = active.filter((d) => d.status === "SIGNE").length;
  return Math.round((signedCount / active.length) * 100);
}

// Pipeline pondéré = Σ montant des devis au statut ENVOYE × 0,30
//                  + Σ montant des devis dont le prospect est en NEGOCIATION × 0,60
export function computeWeightedPipelineEuros(devisList: KpiDevis[]): number {
  const active = counted(devisList);
  const envoyeSum = active
    .filter((d) => d.status === "ENVOYE")
    .reduce((sum, d) => sum + d.totalAmountEuros, 0);
  // Ce second terme filtre sur le statut du PROSPECT, pas sur celui du devis :
  // sans `counted()` en amont, un devis annulé dont le prospect est encore en
  // négociation resterait pondéré à 60 %.
  const negociationSum = active
    .filter((d) => d.prospect.status === "NEGOCIATION")
    .reduce((sum, d) => sum + d.totalAmountEuros, 0);

  return Math.round(envoyeSum * 0.3 + negociationSum * 0.6);
}

export function computeSignedRevenueEuros(devisList: KpiDevis[]): number {
  return counted(devisList)
    .filter((d) => d.status === "SIGNE")
    .reduce((sum, d) => sum + d.totalAmountEuros, 0);
}

// Répartition des devis signés par formule — analogue, dans le périmètre actuel,
// au KPI "répartition des missions par formule" (hors scope, pas de modèle Mission).
export function groupSignedDevisByFormule(devisList: KpiDevis[]): Record<CommercialTier, number> {
  const result: Record<CommercialTier, number> = { BETA: 0, ESSENTIEL: 0, PERFORMANCE: 0, EXCELLENCE: 0 };
  for (const d of counted(devisList).filter((d) => d.status === "SIGNE")) {
    result[d.catalogueFormule.formule]++;
  }
  return result;
}
