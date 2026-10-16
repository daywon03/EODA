// ─────────────────────────────────────────────────────────────────────────────
// DURÉES RELATIVES — « il y a 6 jours », « dans 86 jours ».
//
// Compte en JOURS CALENDAIRES locaux, pas en tranches de 24 h : un document déposé
// hier à 23 h est « d'hier » ce matin, pas « d'aujourd'hui ». Règles PURES : `now`
// est toujours un paramètre (D7 — un test ne dépend pas de l'horloge réelle).
// ─────────────────────────────────────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function localMidnight(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

// Nombre de jours calendaires de `from` à `to` (négatif si `to` est avant). Arrondi :
// un changement d'heure fait durer une journée 23 ou 25 h.
export function calendarDaysBetween(from: Date, to: Date): number {
  return Math.round((localMidnight(to) - localMidnight(from)) / MS_PER_DAY);
}

function days(n: number): string {
  return `${n} jour${n > 1 ? "s" : ""}`;
}

// « aujourd'hui », « hier », « il y a 6 jours ». Une date future (horloges
// désaccordées) est lue comme « aujourd'hui » plutôt que « il y a -1 jour ».
export function formatAgo(date: Date, now: Date): string {
  const elapsed = calendarDaysBetween(date, now);
  if (elapsed <= 0) return "aujourd'hui";
  if (elapsed === 1) return "hier";
  return `il y a ${days(elapsed)}`;
}

// Échéance : « dans 86 jours », « demain », « aujourd'hui », « dépassée depuis 3 jours ».
export function formatDaysUntil(target: Date, now: Date): string {
  const remaining = calendarDaysBetween(now, target);
  if (remaining === 0) return "aujourd'hui";
  if (remaining === 1) return "demain";
  if (remaining > 1) return `dans ${days(remaining)}`;
  return `dépassée depuis ${days(-remaining)}`;
}
