import type { CommercialTier, ProspectStatus } from "@eoda/database";
import {
  deriveEstablishmentStage,
  deriveFunnelStage,
  type FunnelStage,
  type MissionLifecycleFacts,
} from "./lifecycle-service";

// ─────────────────────────────────────────────────────────────────────────────
// KPI DE PORTEFEUILLE — la moitié qui manquait aux indicateurs commerciaux.
//
// `commercial-kpi-service.ts` agrège des DEVIS : combien émis, combien signés, quel
// chiffre d'affaires. Il s'arrête à la signature. Après elle, l'outil ne savait plus
// compter : « combien de clients accompagnons-nous en ce moment ? » n'avait aucune
// réponse à l'écran, et le tableau de bord Cabinet comptait des « établissements
// suivis » qui incluaient les missions terminées depuis un an.
//
// Ce service compte l'autre moitié, à partir des mêmes faits que les badges d'étape
// (lifecycle-service) — jamais d'un statut stocké, et jamais d'un second calcul :
// une fiche affichée « Accompagnement en cours » DOIT être celle qui est comptée ici.
//
// Règles PURES : ni Prisma, ni session, ni horloge. `now` est un paramètre — un test
// qui dépend de l'heure réelle est un test instable (D7).
// ─────────────────────────────────────────────────────────────────────────────

// Ce dont les agrégats ont besoin, fiche par fiche. Étroit volontairement : ramener
// l'entité entière laisserait croire que d'autres champs entrent dans le calcul.
export type PortfolioRow = {
  prospectStatus: ProspectStatus | null;
  mission: MissionLifecycleFacts | null;
  // Formule réellement contractée. Portée par la mission et non par
  // `Establishment.commercialTier`, qui vaut `BETA` pour tout le monde (CLAUDE.md §7).
  missionFormule: CommercialTier | null;
  hasEvaluationTargetDate: Date | null;
};

// Une fiche est « active » tant que sa mission n'est pas close. `SIGNE` (signée, rien
// n'a démarré) compte autant que `EN_COURS` : le client a payé, l'engagement court.
function isActive(row: PortfolioRow): boolean {
  const stage = deriveEstablishmentStage(row.mission);
  return stage === "SIGNE" || stage === "EN_COURS";
}

export function countActiveClients(rows: PortfolioRow[]): number {
  return rows.filter(isActive).length;
}

// Accompagnements réellement engagés — le diagnostic a commencé. Distinct du compte
// ci-dessus : une structure qui vient de signer n'occupe pas encore de temps de
// travail, et les confondre fait croire à une charge qui n'existe pas.
export function countOngoingAccompaniments(rows: PortfolioRow[]): number {
  return rows.filter((row) => deriveEstablishmentStage(row.mission) === "EN_COURS").length;
}

// Missions gratuites encore actives. Le bêta-test est un attribut orthogonal à
// l'étape (lifecycle-service) : il se compte donc à part, et une mission gratuite
// close n'a plus à figurer dans la charge en cours.
export function countActiveBetaMissions(rows: PortfolioRow[]): number {
  return rows.filter((row) => isActive(row) && row.mission?.gratuit === true).length;
}

// Échéances HAS à venir dans un horizon donné, sur les seules missions actives.
//
// Remplace un indicateur devenu vide de sens : il comptait les fiches dont la date
// d'évaluation était renseignée, or elle est EXIGÉE depuis la refonte de l'entonnoir
// — il affichait donc le nombre total de fiches sous une autre étiquette. Une
// échéance déjà passée ou appartenant à une mission close ne dit rien non plus de ce
// qu'il reste à préparer.
export function countUpcomingHasEvaluations(
  rows: PortfolioRow[],
  options: { now: Date; withinDays: number }
): number {
  const horizon = new Date(options.now.getTime() + options.withinDays * 24 * 60 * 60 * 1000);

  return rows.filter((row) => {
    if (!isActive(row)) return false;
    const target = row.hasEvaluationTargetDate;
    if (target === null) return false;
    return target >= options.now && target <= horizon;
  }).length;
}

// Répartition des missions ACTIVES par formule — la charge d'accompagnement du
// moment. À ne pas confondre avec `groupSignedDevisByFormule`, qui compte des
// documents commerciaux signés depuis toujours : l'un dit ce qui a été vendu,
// l'autre ce qui est à livrer.
export function groupActiveMissionsByFormule(
  rows: PortfolioRow[]
): Record<CommercialTier, number> {
  const result: Record<CommercialTier, number> = {
    BETA: 0,
    ESSENTIEL: 0,
    PERFORMANCE: 0,
    EXCELLENCE: 0,
  };

  for (const row of rows) {
    if (!isActive(row) || row.missionFormule === null) continue;
    result[row.missionFormule]++;
  }

  return result;
}

// ── Entonnoir unifié ─────────────────────────────────────────────────────────

export type FunnelBreakdown = {
  byStage: Record<FunnelStage, number>;
  // Fiches dont on ne sait rien dire : ni prospect, ni mission. Comptées à part
  // plutôt que rangées d'office dans « Signé » — un entonnoir qui invente une étape
  // pour ne pas avoir de trou ment sur son total.
  indetermine: number;
};

// Prospects NON CONVERTIS + fiches clients, projetés sur une seule échelle.
//
// Les prospects convertis sont exclus en amont (l'appelant ne les charge pas) et
// non filtrés ici : leur `status` reste figé à `SIGNE` après la conversion, si bien
// que les compter des deux côtés afficherait deux fois la même structure — une fois
// en « Signé » et une fois à l'étape réelle de sa mission.
export function computeFunnelBreakdown(input: {
  unconvertedProspectsByStatus: Record<ProspectStatus, number>;
  establishments: PortfolioRow[];
}): FunnelBreakdown {
  const byStage: Record<FunnelStage, number> = {
    NOUVEAU: 0,
    RDV: 0,
    DEVIS_ENVOYE: 0,
    NEGOCIATION: 0,
    SIGNE: 0,
    EN_COURS: 0,
    TERMINE: 0,
    PERDU: 0,
  };

  for (const [status, count] of Object.entries(input.unconvertedProspectsByStatus)) {
    byStage[status as ProspectStatus] += count;
  }

  let indetermine = 0;
  for (const row of input.establishments) {
    const stage = deriveFunnelStage({
      prospectStatus: row.prospectStatus,
      mission: row.mission,
    });
    if (stage === null) {
      indetermine++;
      continue;
    }
    byStage[stage]++;
  }

  return { byStage, indetermine };
}
