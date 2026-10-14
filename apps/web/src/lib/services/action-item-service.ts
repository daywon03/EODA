import type { ActionOwnerKind, ActionSource, EstablishmentUserRole } from "@eoda/database";
import type { PillSpec } from "@/lib/design/status-vocabulary";

// ─────────────────────────────────────────────────────────────────────────────
// TÂCHES = PLAN D'ACTION — règles PURES (tranche N5). Ni Prisma (types), ni horloge
// (`now` entre en paramètre).
//
// « En retard » est DÉRIVÉ : échéance passée (au jour), tâche pas faite. Les droits
// se décident ici et sont appliqués par les actions (task.ts) : le cabinet agit sur
// toute tâche de son tenant ; un compte client n'agit que sur les tâches de SA
// structure confiées à la structure (sans personne) ou à lui-même.
// ─────────────────────────────────────────────────────────────────────────────

export type ActionItemFacts = {
  id: string;
  title: string;
  ownerKind: ActionOwnerKind;
  ownerUserId: string | null;
  ownerFunction: EstablishmentUserRole | null;
  dueOn: Date | null;
  doneAt: Date | null;
  source: ActionSource;
};

export const MAX_ACTION_TITLE_LENGTH = 200;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// `dueOn` est une date sans heure (colonne DATE) : relue à minuit UTC. On compare
// donc ses composantes UTC au jour local de `now`.
function dueDay(dueOn: Date): Date {
  return new Date(dueOn.getUTCFullYear(), dueOn.getUTCMonth(), dueOn.getUTCDate());
}

export function isOverdue(item: Pick<ActionItemFacts, "dueOn" | "doneAt">, now: Date): boolean {
  return item.doneAt === null && item.dueOn !== null && dueDay(item.dueOn) < startOfDay(now);
}

export function isDueTodayOrLate(item: Pick<ActionItemFacts, "dueOn" | "doneAt">, now: Date): boolean {
  return item.doneAt === null && item.dueOn !== null && dueDay(item.dueOn) <= startOfDay(now);
}

// ── Filtres de la liste (maquette « Plan d'action ») ─────────────────────────

export const ACTION_FILTERS = ["EN_COURS", "MIENNES", "EODA", "EN_RETARD", "TERMINEES"] as const;
export type ActionFilter = (typeof ACTION_FILTERS)[number];

export const ACTION_FILTER_LABELS: Record<ActionFilter, string> = {
  EN_COURS: "En cours",
  MIENNES: "Les miennes",
  EODA: "Confiées à EODA",
  EN_RETARD: "En retard",
  TERMINEES: "Terminées",
};

// Phrase d'une liste VIDE, selon le filtre et ce que la personne voit (recette du
// 14/10). « Aucune tâche dans cette liste. » se lisait pareil pour un intervenant à
// qui rien n'est encore confié et pour une direction dont tout est fait : la phrase
// doit dire laquelle des deux situations on regarde. Phrases courtes (FALC).
export function describeEmptyTaskList(filter: ActionFilter, viewer: { ownOnly: boolean }): string {
  if (viewer.ownOnly && (filter === "EN_COURS" || filter === "MIENNES")) {
    return "Aucune tâche ne vous est confiée pour l'instant. Quand on vous en confie une, elle apparaît ici.";
  }
  switch (filter) {
    case "EN_COURS":
      return "Aucune tâche en cours : tout ce qui était prévu est fait.";
    case "MIENNES":
      return "Aucune tâche ne vous est confiée en ce moment.";
    case "EODA":
      return "Aucune tâche confiée à EODA en ce moment.";
    case "EN_RETARD":
      return "Aucune tâche en retard.";
    case "TERMINEES":
      return "Aucune tâche terminée pour l'instant.";
  }
}

export function parseActionFilter(raw: string | string[] | undefined): ActionFilter {
  return typeof raw === "string" && (ACTION_FILTERS as readonly string[]).includes(raw)
    ? (raw as ActionFilter)
    : "EN_COURS";
}

export function matchesActionFilter(item: ActionItemFacts, filter: ActionFilter, viewerId: string, now: Date): boolean {
  switch (filter) {
    case "EN_COURS":
      return item.doneAt === null;
    case "MIENNES":
      return item.doneAt === null && item.ownerUserId === viewerId;
    case "EODA":
      return item.doneAt === null && item.ownerKind === "CABINET";
    case "EN_RETARD":
      return isOverdue(item, now);
    case "TERMINEES":
      return item.doneAt !== null;
  }
}

export function countActionFilters(
  items: readonly ActionItemFacts[],
  viewerId: string,
  now: Date
): Record<ActionFilter, number> {
  const counts = { EN_COURS: 0, MIENNES: 0, EODA: 0, EN_RETARD: 0, TERMINEES: 0 };
  for (const item of items) {
    for (const filter of ACTION_FILTERS) if (matchesActionFilter(item, filter, viewerId, now)) counts[filter]++;
  }
  return counts;
}

// Ordre : en retard d'abord, puis par échéance (sans échéance à la fin), puis titre.
export function sortActionItems<T extends ActionItemFacts>(items: readonly T[], now: Date): T[] {
  return [...items].sort((a, b) => {
    const late = Number(isOverdue(b, now)) - Number(isOverdue(a, now));
    if (late !== 0) return late;
    const da = a.dueOn?.getTime() ?? Number.POSITIVE_INFINITY;
    const db = b.dueOn?.getTime() ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return a.title.localeCompare(b.title, "fr");
  });
}

export function actionPill(item: Pick<ActionItemFacts, "dueOn" | "doneAt">, now: Date): PillSpec {
  if (item.doneAt !== null) return { label: "Fait", glyph: "✓", tone: "ok" };
  if (isOverdue(item, now)) return { label: "En retard", glyph: "!", tone: "fix" };
  return { label: "À faire", glyph: "○", tone: "progress" };
}

// ── Droits ────────────────────────────────────────────────────────────────────

export type ActionActor = { side: "CABINET" } | { side: "CLIENT"; userId: string };

export function canActorActOnItem(actor: ActionActor, item: Pick<ActionItemFacts, "ownerKind" | "ownerUserId">): boolean {
  if (actor.side === "CABINET") return true;
  return item.ownerKind === "STRUCTURE" && (item.ownerUserId === null || item.ownerUserId === actor.userId);
}

// Ce qu'un client VOIT : les tâches confiées à sa structure (jamais celles d'EODA,
// qui relèvent du suivi interne du cabinet).
export function isVisibleToClient(item: Pick<ActionItemFacts, "ownerKind">): boolean {
  return item.ownerKind === "STRUCTURE";
}

export type Assignment = { ownerKind: ActionOwnerKind; ownerUserId: string | null };

// Une personne désignée doit appartenir au bon côté : un compte du cabinet (même
// tenant) pour EODA, un interlocuteur rattaché à la structure pour la structure.
// Un client ne confie qu'à sa structure ou à un de ses collègues — jamais à EODA
// (il le demande par « Écrire à EODA »).
export function assignmentError(
  actor: ActionActor,
  target: Assignment,
  eligible: { cabinetUserIds: ReadonlySet<string>; structureUserIds: ReadonlySet<string> }
): string | null {
  if (actor.side === "CLIENT" && target.ownerKind !== "STRUCTURE") {
    return "Une tâche de la structure ne peut être confiée qu'à la structure.";
  }
  if (target.ownerUserId === null) return null;
  const pool = target.ownerKind === "CABINET" ? eligible.cabinetUserIds : eligible.structureUserIds;
  return pool.has(target.ownerUserId) ? null : "Cette personne ne peut pas recevoir cette tâche.";
}

export function titleError(title: string): string | null {
  const trimmed = title.trim();
  if (trimmed.length === 0) return "Décrivez la tâche.";
  if (trimmed.length > MAX_ACTION_TITLE_LENGTH) {
    return `La tâche tient en ${MAX_ACTION_TITLE_LENGTH} caractères au plus.`;
  }
  return null;
}

// Détail d'audit : la source et le côté, jamais le titre (texte libre).
export function describeActionForAudit(item: Pick<ActionItemFacts, "source" | "ownerKind">): string {
  return `${item.source} · ${item.ownerKind}`;
}

// ── Responsable affiché ──────────────────────────────────────────────────────

// Fonctions dans la structure — source unique (fiche interlocuteur, pilote du PAC).
export const FUNCTION_LABELS: Record<EstablishmentUserRole, string> = {
  DIRECTEUR: "Directeur / Directrice",
  COORDINATEUR: "Coordinateur / Coordinatrice",
  ASSISTANT_QUALITE: "Assistant(e) qualité",
  RESPONSABLE_QUALITE: "Responsable Qualité",
  AUTRE: "Autre",
};

// Une personne nommée d'abord, sinon la fonction pilote, sinon le côté. Côté client,
// le cabinet s'appelle « EODA », jamais par un prénom (D7).
export function describeOwner(item: Pick<ActionItemFacts, "ownerKind" | "ownerFunction"> & { ownerName: string | null }): string {
  if (item.ownerName) return item.ownerName;
  if (item.ownerFunction) return FUNCTION_LABELS[item.ownerFunction];
  return item.ownerKind === "CABINET" ? "EODA" : "La structure";
}

// ── Tâches du jour (accueil cabinet) ─────────────────────────────────────────

export function selectTodayTasks<T extends ActionItemFacts>(items: readonly T[], viewerId: string, now: Date): T[] {
  return sortActionItems(
    items.filter((i) => i.ownerUserId === viewerId && isDueTodayOrLate(i, now)),
    now
  );
}
