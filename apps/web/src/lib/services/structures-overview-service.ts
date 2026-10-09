import type { EstablishmentType } from "@eoda/database";
import { calendarDaysBetween, formatAgo } from "./elapsed-time-service";
import type { FunnelStage } from "./lifecycle-service";

// ─────────────────────────────────────────────────────────────────────────────
// LISTE DES STRUCTURES ET « À SURVEILLER » — règles pures.
//
// Tout ce qui s'affiche ici est DÉRIVÉ de faits déjà en base : l'étape vient de
// lifecycle-service (la même que le badge de la fiche et que les KPI de
// portefeuille), l'activité du journal d'audit, les documents à relire de la file
// « À relire », le message sans réponse du fil d'échange. Aucun motif n'est stocké,
// aucun n'est saisi : un motif qu'il faudrait tenir à jour à la main serait faux
// dès la première semaine chargée.
//
// `now` est toujours un paramètre (D7).
// ─────────────────────────────────────────────────────────────────────────────

// Une évaluation à moins de trois mois appelle une action cette semaine.
export const EVALUATION_ALERT_DAYS = 90;
// Trois semaines sans aucune trace : la structure a décroché, ou on l'a oubliée.
export const INACTIVITY_ALERT_DAYS = 21;

export type StructureFacts = {
  id: string;
  name: string;
  type: EstablishmentType;
  stage: FunnelStage | null;
  isBeta: boolean;
  hasEvaluationTargetDate: Date | null;
  lastActivityAt: Date | null;
  documentsAwaitingReview: number;
  hasUnansweredMessage: boolean;
  // Couverture documentaire loi 2002-2 : types de la catégorie dont une version
  // courante existe, sur le nombre de types de la catégorie.
  loi2002Deposited: number;
  loi2002Total: number;
};

export type WatchReasonKind = "ECHEANCE_DEPASSEE" | "ECHEANCE_PROCHE" | "A_RELIRE" | "MESSAGE" | "INACTIVITE";

export type WatchReason = { kind: WatchReasonKind; label: string };

// Ordre de gravité : une échéance passée sans clôture d'abord, l'inactivité en
// dernier (elle peut être normale entre deux phases).
const REASON_WEIGHT: Record<WatchReasonKind, number> = {
  ECHEANCE_DEPASSEE: 5,
  ECHEANCE_PROCHE: 4,
  A_RELIRE: 3,
  MESSAGE: 2,
  INACTIVITE: 1,
};

// Une mission terminée ne se surveille plus : elle est en bibliothèque.
export function isFollowed(row: Pick<StructureFacts, "stage">): boolean {
  return row.stage !== "TERMINE";
}

export function daysUntilEvaluation(row: Pick<StructureFacts, "hasEvaluationTargetDate">, now: Date): number | null {
  return row.hasEvaluationTargetDate ? calendarDaysBetween(now, row.hasEvaluationTargetDate) : null;
}

function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n > 1 ? pluralForm : singular}`;
}

export function deriveWatchReasons(row: StructureFacts, now: Date): WatchReason[] {
  if (!isFollowed(row)) return [];
  const reasons: WatchReason[] = [];

  const days = daysUntilEvaluation(row, now);
  if (days !== null && days < 0) {
    reasons.push({ kind: "ECHEANCE_DEPASSEE", label: "Échéance HAS dépassée, mission non close" });
  } else if (days !== null && days <= EVALUATION_ALERT_DAYS) {
    reasons.push({ kind: "ECHEANCE_PROCHE", label: `Évaluation HAS dans ${plural(days, "jour", "jours")}` });
  }

  if (row.documentsAwaitingReview > 0) {
    reasons.push({
      kind: "A_RELIRE",
      label: plural(row.documentsAwaitingReview, "document à relire", "documents à relire"),
    });
  }

  if (row.hasUnansweredMessage) reasons.push({ kind: "MESSAGE", label: "Message sans réponse" });

  if (row.lastActivityAt === null) {
    reasons.push({ kind: "INACTIVITE", label: "Aucune activité enregistrée" });
  } else {
    const idle = calendarDaysBetween(row.lastActivityAt, now);
    if (idle >= INACTIVITY_ALERT_DAYS) {
      reasons.push({ kind: "INACTIVITE", label: `Aucune activité depuis ${idle} jours` });
    }
  }

  return reasons.sort((a, b) => REASON_WEIGHT[b.kind] - REASON_WEIGHT[a.kind]);
}

// Tri par URGENCE de la liste des structures : les structures suivies d'abord ;
// parmi elles, l'évaluation la plus proche en tête (une date dépassée est la plus
// urgente de toutes) ; sans date, après ; puis par nom. Les missions terminées
// ferment la liste.
export function sortByUrgency<T extends StructureFacts>(rows: readonly T[], now: Date): T[] {
  return [...rows].sort((a, b) => {
    const followed = Number(isFollowed(b)) - Number(isFollowed(a));
    if (followed !== 0) return followed;
    const da = daysUntilEvaluation(a, now);
    const db = daysUntilEvaluation(b, now);
    if (da !== db) {
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    }
    return a.name.localeCompare(b.name, "fr");
  });
}

export type WatchItem<T extends StructureFacts = StructureFacts> = { row: T; reasons: WatchReason[] };

// Bloc « À surveiller » de l'accueil : les structures qui ont au moins un motif,
// la plus grave d'abord, puis par urgence d'échéance.
export function selectWatchList<T extends StructureFacts>(rows: readonly T[], now: Date, limit = 6): WatchItem<T>[] {
  const urgencyRank = new Map(sortByUrgency(rows, now).map((row, index) => [row.id, index]));
  return rows
    .map((row) => ({ row, reasons: deriveWatchReasons(row, now) }))
    .filter((item) => item.reasons.length > 0)
    .sort(
      (a, b) =>
        REASON_WEIGHT[b.reasons[0]!.kind] - REASON_WEIGHT[a.reasons[0]!.kind] ||
        b.reasons.length - a.reasons.length ||
        (urgencyRank.get(a.row.id) ?? 0) - (urgencyRank.get(b.row.id) ?? 0)
    )
    .slice(0, limit);
}

// « Dernière activité » = la dernière action de la STRUCTURE (décision Damon,
// 09/10/2026) : une entrée du journal dont l'acteur est un compte client RATTACHÉ à
// cet établissement. Les consultations du cabinet n'en sont pas — sinon ouvrir la
// fiche d'une structure qui a décroché la ferait paraître active, et l'alerte
// d'inactivité ne se déclencherait jamais.
//
// Le rattachement est revérifié ici, paire par paire : un compte client lié à une
// autre structure (ou plus lié du tout) ne compte pas, même si une entrée du
// journal porte cet établissement.
export type ActorActivity = { establishmentId: string | null; actorUserId: string | null; lastAt: Date | null };
export type ClientLink = { establishmentId: string; userId: string };

export function latestClientActivityByEstablishment(
  activity: readonly ActorActivity[],
  links: readonly ClientLink[]
): Map<string, Date> {
  const linked = new Set(links.map((l) => `${l.establishmentId}\u0000${l.userId}`));
  const latest = new Map<string, Date>();
  for (const { establishmentId, actorUserId, lastAt } of activity) {
    if (!establishmentId || !actorUserId || !lastAt) continue;
    if (!linked.has(`${establishmentId}\u0000${actorUserId}`)) continue;
    const current = latest.get(establishmentId);
    if (!current || lastAt > current) latest.set(establishmentId, lastAt);
  }
  return latest;
}

export function describeLastActivity(lastActivityAt: Date | null, now: Date): string {
  if (lastActivityAt === null) return "Aucune activité enregistrée";
  const ago = formatAgo(lastActivityAt, now);
  return ago.charAt(0).toUpperCase() + ago.slice(1);
}

export function describeLoi2002Coverage(row: Pick<StructureFacts, "loi2002Deposited" | "loi2002Total">): string {
  return `${row.loi2002Deposited} / ${row.loi2002Total}`;
}

// Phrase de synthèse sous « Bonjour … ». Ne dit que ce qui est compté.
export function buildGreetingSummary(input: { awaitingReview: number; watchCount: number }): string {
  const review =
    input.awaitingReview === 0
      ? "Tout est relu."
      : `${plural(input.awaitingReview, "document attend", "documents attendent")} votre relecture.`;
  const watch =
    input.watchCount === 0
      ? "Aucune structure ne demande d'attention particulière."
      : `${plural(input.watchCount, "structure est", "structures sont")} à surveiller.`;
  return `${review} ${watch}`;
}

// Prénom pour « Bonjour … ». Le nom du compte est libre (« Marie Dupont », ou
// vide) : on prend le premier mot, et rien plutôt qu'un e-mail.
export function firstNameOf(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first : null;
}
