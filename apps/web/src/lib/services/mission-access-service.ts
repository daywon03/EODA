// ─────────────────────────────────────────────────────────────────────────────
// FIN DE MISSION — trois états d'accès, aucune suppression.
//
// §12.5 du mode opératoire, position finale du call du 16/08/2026 (prononcée,
// rétractée, puis renversée explicitement) : « à la fin de l'accompagnement, on ne
// coupe pas leur accès. Ils auront accès à la bibliothèque des documents générés,
// mais nous leur préconisons de s'abonner. »
//
//   ACTIVE   — mission en cours : dépôt et lecture ouverts.
//   LIBRARY  — mission close : bibliothèque en LECTURE SEULE. Le client garde ses
//              documents, il ne peut plus en déposer.
//   REVOKED  — accès client coupé. Les données restent en base, la rétention est
//              côté cabinet. Réversible.
//
// Deux faits stockés, deux décisions humaines : `closedAt` (la clôture) et
// `clientAccessRevokedAt` (la coupure). Le reste se dérive — même règle que
// lifecycle-service.ts, et pour la même raison : un état stocké que rien ne
// maintient finit par mentir.
//
// Règles PURES : ni Prisma, ni session, ni horloge (`now` est un paramètre).
// ─────────────────────────────────────────────────────────────────────────────

export const MISSION_ACCESS_STATES = ["ACTIVE", "LIBRARY", "REVOKED"] as const;
export type MissionAccessState = (typeof MISSION_ACCESS_STATES)[number];

export type MissionAccessFacts = {
  closedAt: Date | null;
  clientAccessRevokedAt: Date | null;
};

// Pas de mission : la fiche est en avant-vente ou antérieure à l'entonnoir unique
// (ASSAD BENOIT). Rien n'est clos, donc rien n'est fermé — refuser ici couperait
// l'accès d'un client dont l'accompagnement n'a même pas commencé.
export function deriveMissionAccessState(mission: MissionAccessFacts | null): MissionAccessState {
  if (!mission) return "ACTIVE";
  // La révocation l'emporte : elle peut être posée sur une mission encore ouverte
  // (rupture, impayé) et doit alors trancher.
  if (mission.clientAccessRevokedAt !== null) return "REVOKED";
  if (mission.closedAt !== null) return "LIBRARY";
  return "ACTIVE";
}

// Le dépôt s'arrête à la clôture — c'est ce qui distingue une bibliothèque d'un
// accompagnement. Vaut pour les deux côtés : Sandrine garde son droit d'écriture
// dans le portail client (§12.4) tant que la mission vit, pas après.
export function canDepositDocuments(state: MissionAccessState): boolean {
  return state === "ACTIVE";
}

// Lecture client. Le cabinet, lui, conserve l'accès dans TOUS les états : « rétention
// côté cabinet, zéro accès client » — c'est l'appelant (les gardes) qui n'applique
// cette règle qu'aux comptes CLIENT_USER.
export function canClientRead(state: MissionAccessState): boolean {
  return state !== "REVOKED";
}

export const MISSION_ACCESS_LABELS: Record<MissionAccessState, string> = {
  ACTIVE: "Accompagnement en cours",
  LIBRARY: "Bibliothèque — lecture seule",
  REVOKED: "Accès client révoqué",
};

// ── Alerte de mise à jour ────────────────────────────────────────────────────
//
// « Alerte de mise à jour au 5ᵉ mois » ([3:30:23] du call). Ce n'est pas une
// expiration : rien ne se ferme au 5ᵉ mois. C'est le moment où des documents figés
// commencent à dater — le référentiel HAS évolue, les documents obligatoires aussi —
// et où l'abonnement se justifie. Le calcul se fait donc à l'affichage, à partir de
// la date de clôture, et rien n'est écrit en base : un drapeau « alerte envoyée »
// serait un cinquième état à maintenir.

export const LIBRARY_UPDATE_ALERT_MONTHS = 5;

export function isLibraryUpdateAlertDue(
  mission: MissionAccessFacts | null,
  now: Date,
  monthsThreshold: number = LIBRARY_UPDATE_ALERT_MONTHS
): boolean {
  if (deriveMissionAccessState(mission) !== "LIBRARY") return false;
  const closedAt = mission?.closedAt;
  if (!closedAt) return false;

  return monthsElapsed(closedAt, now) >= monthsThreshold;
}

// Mois pleins écoulés. Calculé en calendrier et non en jours : « 5 mois » se compte
// comme Sandrine le compte, et une addition de 30 jours dériverait d'un mois par an.
export function monthsElapsed(from: Date, to: Date): number {
  const months =
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  // Le mois n'est plein que si le jour du mois est atteint.
  return to.getDate() >= from.getDate() ? months : months - 1;
}
