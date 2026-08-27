import type { AppointmentKind, AppointmentMode, AppointmentStatus } from "@eoda/database";

// ─────────────────────────────────────────────────────────────────────────────
// AGENDA — règles pures.
//
// Ce que l'agenda doit rendre possible (demande du 26/08) : caler un planning
// PRÉVISIONNEL, donner au cabinet la vue de tous ses rendez-vous tous clients
// confondus, et dire au client quand est son prochain point — visio ou présentiel.
//
// Ni Prisma, ni React, ni horloge : `now` et les dates entrent en paramètre. Une
// grille de mois calculée à partir de `new Date()` ne se teste pas.
//
// ⚠️ Toutes les dates sont manipulées en HEURE LOCALE (fuseau du serveur, Europe/Paris
// en production). Un rendez-vous est un moment de la journée de quelqu'un : le passer
// en UTC décalerait « 9 h » à « 7 h » à l'affichage l'été.
// ─────────────────────────────────────────────────────────────────────────────

export const APPOINTMENT_KIND_LABELS: Record<AppointmentKind, string> = {
  R0_PRISE_CONTACT: "R0 — Prise de contact",
  R1_DECOUVERTE: "R1 — Réunion de découverte",
  R2_ACCORD: "R2 — Accord de principe",
  REUNION_CADRAGE: "Réunion de cadrage",
  VISITE: "Visite sur site",
  ATELIER: "Atelier",
  REUNION_SUIVI: "Réunion de suivi",
  RESTITUTION: "Restitution",
  AUTRE: "Autre rendez-vous",
};

export const APPOINTMENT_MODE_LABELS: Record<AppointmentMode, string> = {
  VISIO: "Visioconférence",
  PRESENTIEL: "Sur site",
  TELEPHONE: "Téléphone",
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  PROPOSE: "Créneau proposé",
  CONFIRME: "Confirmé",
  ANNULE: "Annulé",
};

// Les trois étapes de vente. Séparées des rendez-vous d'accompagnement parce qu'elles
// se programment sur un PROSPECT, avant qu'aucune fiche client n'existe.
export const PROSPECT_APPOINTMENT_KINDS: AppointmentKind[] = [
  "R0_PRISE_CONTACT",
  "R1_DECOUVERTE",
  "R2_ACCORD",
];

export type CalendarAppointment = {
  id: string;
  kind: AppointmentKind;
  mode: AppointmentMode;
  status: AppointmentStatus;
  startsAt: Date;
  endsAt: Date;
  subject: string;
  location: string | null;
  // Nom de la structure concernée — prospect ou client. Résolu par la couche de
  // lecture : l'agenda du cabinet est inutilisable sans savoir DE QUI on parle.
  structureName: string;
  href: string | null;
};

// ── Dates ────────────────────────────────────────────────────────────────────

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Semaine française : lundi en tête. `getDay()` rend 0 pour dimanche, d'où le décalage.
export function startOfWeekMonday(date: Date): Date {
  const day = startOfDay(date);
  const shift = (day.getDay() + 6) % 7;
  return addDays(day, -shift);
}

export function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

export function endOfMonth(year: number, month: number): Date {
  // Jour 0 du mois suivant = dernier jour du mois demandé, à 23:59:59.999.
  return new Date(year, month + 1, 0, 23, 59, 59, 999);
}

// ── Grille de mois ───────────────────────────────────────────────────────────

export type CalendarDay = {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  appointments: CalendarAppointment[];
};

// Six semaines pleines, toujours. Un nombre de lignes variable ferait sauter la
// hauteur de la grille d'un mois à l'autre — et un calendrier qui se réorganise sous
// l'œil est illisible pour qui n'est pas à l'aise avec l'outil.
export const CALENDAR_WEEKS = 6;

export function buildMonthGrid(
  year: number,
  month: number,
  appointments: CalendarAppointment[],
  now: Date
): CalendarDay[][] {
  const first = startOfWeekMonday(startOfMonth(year, month));
  const byDay = groupByDayKey(appointments);

  const weeks: CalendarDay[][] = [];
  for (let week = 0; week < CALENDAR_WEEKS; week++) {
    const days: CalendarDay[] = [];
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      const date = addDays(first, week * 7 + dayOfWeek);
      days.push({
        date,
        inMonth: date.getMonth() === month,
        isToday: isSameDay(date, now),
        appointments: byDay.get(dayKey(date)) ?? [],
      });
    }
    weeks.push(days);
  }
  return weeks;
}

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function groupByDayKey(appointments: CalendarAppointment[]): Map<string, CalendarAppointment[]> {
  const map = new Map<string, CalendarAppointment[]>();
  for (const appointment of sortByStart(appointments)) {
    const key = dayKey(appointment.startsAt);
    const bucket = map.get(key);
    if (bucket) bucket.push(appointment);
    else map.set(key, [appointment]);
  }
  return map;
}

export function sortByStart(appointments: CalendarAppointment[]): CalendarAppointment[] {
  return [...appointments].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

// ── Listes ───────────────────────────────────────────────────────────────────

// Prochains rendez-vous. Un rendez-vous annulé garde sa ligne en base — l'historique
// compte — mais n'a rien à faire dans « ce qui arrive ».
export function selectUpcoming(
  appointments: CalendarAppointment[],
  now: Date,
  limit?: number
): CalendarAppointment[] {
  const upcoming = sortByStart(appointments).filter(
    (appointment) => appointment.status !== "ANNULE" && appointment.endsAt >= now
  );
  return limit === undefined ? upcoming : upcoming.slice(0, limit);
}

export type DayGroup = { date: Date; appointments: CalendarAppointment[] };

// Regroupement par journée, pour une liste lisible : « jeudi 3 septembre » puis ses
// créneaux. Une liste plate de dates complètes se relit mal.
export function groupByDay(appointments: CalendarAppointment[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const appointment of sortByStart(appointments)) {
    const last = groups[groups.length - 1];
    if (last && isSameDay(last.date, appointment.startsAt)) {
      last.appointments.push(appointment);
      continue;
    }
    groups.push({ date: startOfDay(appointment.startsAt), appointments: [appointment] });
  }
  return groups;
}

// ── Saisie ───────────────────────────────────────────────────────────────────

export const MIN_DURATION_MINUTES = 15;
export const MAX_DURATION_MINUTES = 12 * 60;

// Validée ici plutôt que dans l'action : c'est une règle, pas une plomberie de
// formulaire, et elle doit valoir pour tous les points d'entrée.
export function appointmentRangeError(startsAt: Date, endsAt: Date): string | null {
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return "Les dates du rendez-vous sont invalides.";
  }

  const minutes = (endsAt.getTime() - startsAt.getTime()) / 60000;
  if (minutes < MIN_DURATION_MINUTES) {
    return `Un rendez-vous dure au moins ${MIN_DURATION_MINUTES} minutes — vérifiez l'heure de fin.`;
  }
  if (minutes > MAX_DURATION_MINUTES) {
    return "Un rendez-vous de plus de douze heures est probablement une erreur de saisie.";
  }
  return null;
}

// Chevauchement avec un rendez-vous déjà posé. Ne bloque rien — Sandrine peut avoir
// deux points le même créneau et trancher elle-même — mais l'écran doit le DIRE :
// découvrir un conflit le matin même, c'est un client qu'on décale.
export function findOverlaps(
  candidate: { startsAt: Date; endsAt: Date; id?: string },
  existing: CalendarAppointment[]
): CalendarAppointment[] {
  return existing.filter(
    (appointment) =>
      appointment.id !== candidate.id &&
      appointment.status !== "ANNULE" &&
      appointment.startsAt < candidate.endsAt &&
      candidate.startsAt < appointment.endsAt
  );
}
