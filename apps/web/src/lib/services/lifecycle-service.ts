import type { ProspectStatus } from "@eoda/database";

// ─────────────────────────────────────────────────────────────────────────────
// CYCLE DE VIE — de la prospection à la fin de mission.
//
// Règles PURES : ni Prisma, ni session. Mêmes contraintes que
// client-contract-service.ts et mission-progress-service.ts.
//
// ⚠️ L'état d'une fiche client est DÉRIVÉ, jamais stocké. Ce n'est pas une
// préférence de style, c'est une réaction à un défaut constaté dans ce dépôt :
// `Establishment.commercialTier` a été ajouté comme état, puis plus rien ne l'a mis
// à jour — il vaut `BETA` pour tout le monde et sa propre documentation le déclare
// « affichage/historique uniquement ». Un état stocké qu'aucune écriture ne
// maintient est pire qu'un état absent : il a l'air d'une réponse.
//
// Le dépôt porte déjà quatre sources d'état (Prospect.status, Devis.status,
// Mission.formule/gratuit, Establishment.commercialTier). On n'en ajoute pas une
// cinquième. On calcule.
//
// Une seule exception, `Mission.closedAt` : la clôture est une DÉCISION de
// l'évaluatrice, pas un calcul. Voir MISSION_CLOSURE_IS_NOT_COMPLETION plus bas.
// ─────────────────────────────────────────────────────────────────────────────

// ── Étape d'une fiche client ─────────────────────────────────────────────────

export const ESTABLISHMENT_STAGES = ["SIGNE", "EN_COURS", "TERMINE"] as const;
export type EstablishmentStage = (typeof ESTABLISHMENT_STAGES)[number];

// Ce dont la dérivation a besoin — volontairement étroit, pour que l'appelant ne
// puisse pas croire que d'autres champs entrent dans le calcul.
export type MissionLifecycleFacts = {
  closedAt: Date | null;
  gratuit: boolean;
  // Nombre d'items de diagnostic effectivement cochés.
  completedChecklistCount: number;
  // Dates de phases posées (début ou fin, toutes phases confondues).
  scheduledPhaseDateCount: number;
};

// MISSION_CLOSURE_IS_NOT_COMPLETION
//
// Pourquoi `TERMINE` ne se déduit PAS d'une checklist à 100 % : une mission dont
// toutes les actions sont cochées reste ouverte jusqu'à la visite des évaluateurs
// HAS. La cotation peut encore bouger, un document peut encore être corrigé. Clore
// une mission parce qu'une case a été cochée fermerait le portail du client avant
// l'échéance pour laquelle il a payé.
//
// Inversement, une mission peut être close alors que la checklist est incomplète —
// abandon, report, rupture. Les deux dimensions sont indépendantes, et c'est
// `closedAt` qui tranche, jamais la progression.
export function deriveEstablishmentStage(
  mission: MissionLifecycleFacts | null
): EstablishmentStage | null {
  // Pas de mission : la fiche n'existe pas encore côté cycle de vie. Renvoyer une
  // étape par défaut ferait apparaître comme « signée » une fiche qui ne l'est pas.
  if (!mission) return null;

  if (mission.closedAt !== null) return "TERMINE";

  const started = mission.completedChecklistCount > 0 || mission.scheduledPhaseDateCount > 0;
  return started ? "EN_COURS" : "SIGNE";
}

// Le bêta-test est un ATTRIBUT, pas une étape : une mission gratuite peut être
// signée, en cours ou terminée. En faire une valeur de l'énumération d'étapes
// obligerait à choisir entre « bêta » et « en cours », alors que les deux sont vrais
// en même temps — et le badge disparaîtrait dès que la mission avance.
export function isBetaMission(mission: MissionLifecycleFacts | null): boolean {
  return mission?.gratuit === true;
}

// ── Échelle unifiée prospect → client ────────────────────────────────────────
//
// Le liant qui manquait entre les deux moitiés de l'outil : le pipeline commercial
// s'arrêtait à `SIGNE` et le suivi de mission commençait ailleurs, sans échelle
// commune. Un CRM doit pouvoir répondre « où en est cette structure ? » d'une seule
// lecture, du premier contact à la fin d'accompagnement.

export const FUNNEL_STAGES = [
  "NOUVEAU",
  "RDV",
  "DEVIS_ENVOYE",
  "NEGOCIATION",
  "SIGNE",
  "EN_COURS",
  "TERMINE",
  "PERDU",
] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

// L'établissement fait autorité dès qu'il existe.
//
// Raison : `Prospect.status` reste figé à `SIGNE` après la conversion — c'est le
// dernier état commercial, et il est correct comme tel. Mais il ne dit plus rien de
// l'accompagnement qui a commencé derrière. Lire le prospect en priorité afficherait
// « Signé » à une structure dont la mission est terminée depuis six mois.
//
// Cas sans prospect (fiches créées avant l'entonnoir unique, ASSAD BENOIT) : la
// mission suffit. Cas sans mission ET sans prospect : on ne sait rien, `null` — et
// surtout pas une étape inventée.
export function deriveFunnelStage(input: {
  prospectStatus: ProspectStatus | null;
  mission: MissionLifecycleFacts | null;
}): FunnelStage | null {
  const stage = deriveEstablishmentStage(input.mission);
  if (stage) return stage;
  return input.prospectStatus ?? null;
}

// ── Libellés ─────────────────────────────────────────────────────────────────
// Source unique, comme PROSPECT_STATUS_LABELS. Le Record exhaustif cesse de compiler
// si une valeur est ajoutée sans être traduite — l'étape ne peut pas apparaître à
// l'écran sous son nom technique.

export const FUNNEL_STAGE_LABELS: Record<FunnelStage, string> = {
  NOUVEAU: "Nouveau contact",
  RDV: "RDV programmé",
  DEVIS_ENVOYE: "Devis envoyé",
  NEGOCIATION: "Négociation",
  SIGNE: "Signé",
  EN_COURS: "Accompagnement en cours",
  TERMINE: "Mission terminée",
  PERDU: "Perdu",
};

// Une fiche signée n'est pas encore un accompagnement : le diagnostic n'a pas
// commencé. La distinction gouverne ce qui est proposé à l'écran.
export function isAccompanimentStarted(stage: FunnelStage | null): boolean {
  return stage === "EN_COURS" || stage === "TERMINE";
}
