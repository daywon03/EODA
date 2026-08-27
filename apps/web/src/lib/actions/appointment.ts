"use server";

import {
  prisma,
  AppointmentKind,
  AppointmentMode,
  AppointmentStatus,
  type Prisma,
} from "@eoda/database";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCabinetSession, requireClientEstablishment } from "@/lib/auth/guards";
import {
  appointmentRangeError,
  endOfMonth,
  startOfMonth,
  selectUpcoming,
  type CalendarAppointment,
} from "@/lib/services/calendar-service";
import {
  firstError,
  isEnumValue,
  optionalString,
  requiredEnum,
  requiredString,
} from "@/lib/validation/form-parsers";

// ─────────────────────────────────────────────────────────────────────────────
// AGENDA — lectures et écritures.
//
// Un rendez-vous appartient à un PROSPECT (R0/R1/R2) ou à un ÉTABLISSEMENT, jamais
// aux deux : la base le tient (contrainte `appointments_one_owner`), l'action le
// vérifie aussi, parce qu'un identifiant reçu par une action serveur vient d'une
// route HTTP publique.
//
// Cloisonnement : les rendez-vous de prospection restent réservés à CABINET_ADMIN,
// comme le reste du pipeline commercial (CLAUDE.md §7). Un évaluateur voit l'agenda
// des accompagnements, pas celui du démarchage.
// ─────────────────────────────────────────────────────────────────────────────

const AGENDA_PATH = "/dashboard/cabinet/agenda";

// Ce que la lecture ramène : de quoi afficher une ligne d'agenda, et rien de plus.
// `notes` reste en base et ne sort JAMAIS d'ici — c'est de la préparation interne.
const AGENDA_SELECT = {
  id: true,
  kind: true,
  mode: true,
  status: true,
  startsAt: true,
  endsAt: true,
  subject: true,
  location: true,
  prospect: { select: { id: true, structureName: true } },
  establishment: { select: { id: true, name: true } },
} satisfies Prisma.AppointmentSelect;

type AgendaRow = Prisma.AppointmentGetPayload<{ select: typeof AGENDA_SELECT }>;

function toCalendarAppointment(row: AgendaRow): CalendarAppointment {
  return {
    id: row.id,
    kind: row.kind,
    mode: row.mode,
    status: row.status,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    subject: row.subject,
    location: row.location,
    // Le nom de la structure : un agenda qui n'affiche que « Réunion de suivi » à
    // quatre lignes différentes ne sert à rien.
    structureName: row.establishment?.name ?? row.prospect?.structureName ?? "Structure inconnue",
    href: row.establishment
      ? `/dashboard/cabinet/etablissements/${row.establishment.id}`
      : row.prospect
        ? `/dashboard/cabinet/commercial/prospects/${row.prospect.id}`
        : null,
  };
}

// Filtre de cloisonnement : hors CABINET_ADMIN, on ne rend que les rendez-vous
// rattachés à un établissement. Fail-closed — on n'ajoute pas une condition quand on
// est admin, on en retire une quand on l'est.
function scopeForRole(tenantId: string, isAdmin: boolean): Prisma.AppointmentWhereInput {
  return isAdmin ? { tenantId } : { tenantId, establishmentId: { not: null } };
}

export async function listAgendaMonth(
  year: number,
  month: number
): Promise<CalendarAppointment[]> {
  const { tenantId, session } = await requireCabinetSession();

  // Bornes calculées côté serveur à partir d'entiers validés : `year`/`month`
  // arrivent d'une URL.
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 0 || month > 11) {
    return [];
  }

  const rows = await prisma.appointment.findMany({
    where: {
      ...scopeForRole(tenantId, session.user.role === "CABINET_ADMIN"),
      // La grille affiche six semaines : on élargit d'une semaine de chaque côté
      // plutôt que de borner au mois, sinon les jours débordants sont vides à tort.
      startsAt: { gte: addWeeks(startOfMonth(year, month), -1), lte: addWeeks(endOfMonth(year, month), 1) },
    },
    select: AGENDA_SELECT,
    orderBy: { startsAt: "asc" },
  });

  return rows.map(toCalendarAppointment);
}

function addWeeks(date: Date, weeks: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + weeks * 7);
  return next;
}

// Prochains rendez-vous, tous clients confondus — la question « qu'est-ce que j'ai
// cette semaine ? ». Bornée en base ET filtrée par le service : un rendez-vous
// annulé garde sa ligne mais n'est pas « à venir ».
export async function listUpcomingAgenda(limit = 8): Promise<CalendarAppointment[]> {
  const { tenantId, session } = await requireCabinetSession();
  const now = new Date();

  const rows = await prisma.appointment.findMany({
    where: {
      ...scopeForRole(tenantId, session.user.role === "CABINET_ADMIN"),
      status: { not: "ANNULE" },
      endsAt: { gte: now },
    },
    select: AGENDA_SELECT,
    orderBy: { startsAt: "asc" },
    take: Math.min(Math.max(Math.trunc(limit) || 8, 1), 50),
  });

  return rows.map(toCalendarAppointment);
}

// Les rendez-vous d'UNE structure — affichés sur sa fiche ou sur le prospect.
export async function listAppointmentsFor(owner: {
  prospectId?: string;
  establishmentId?: string;
}): Promise<CalendarAppointment[]> {
  const { tenantId, session } = await requireCabinetSession();

  const where = owner.establishmentId
    ? { tenantId, establishmentId: owner.establishmentId }
    : owner.prospectId
      ? { tenantId, prospectId: owner.prospectId }
      : null;
  if (!where) return [];
  // Un évaluateur n'a pas à lire l'agenda de prospection.
  if (owner.prospectId && session.user.role !== "CABINET_ADMIN") return [];

  const rows = await prisma.appointment.findMany({
    where,
    select: AGENDA_SELECT,
    orderBy: { startsAt: "asc" },
  });
  return rows.map(toCalendarAppointment);
}

// ── Portail client ───────────────────────────────────────────────────────────

// « Savoir quand sont ses prochains points, en visio ou en présentiel. »
//
// Trois filtres, tous nécessaires : l'établissement de la session (jamais un
// identifiant reçu), les rendez-vous marqués visibles, et ceux qui ne sont pas
// annulés. `notes` n'est même pas sélectionné.
export async function listClientAppointments(limit = 5): Promise<CalendarAppointment[]> {
  const { establishment } = await requireClientEstablishment();
  if (!establishment) return [];

  const rows = await prisma.appointment.findMany({
    where: {
      establishmentId: establishment.id,
      visibleToClient: true,
      status: { not: "ANNULE" },
      endsAt: { gte: new Date() },
    },
    select: AGENDA_SELECT,
    orderBy: { startsAt: "asc" },
    take: Math.min(Math.max(Math.trunc(limit) || 5, 1), 20),
  });

  return selectUpcoming(rows.map(toCalendarAppointment), new Date(), limit);
}

// ── Écritures ────────────────────────────────────────────────────────────────

type AppointmentActionResult = { error: string } | null;

// Vérifie que la structure visée appartient bien au tenant de l'appelant, et rend le
// lien à écrire. Sans ce contrôle, un identifiant d'un autre cabinet poserait un
// rendez-vous dans son agenda.
async function resolveOwner(
  formData: FormData,
  tenantId: string,
  isAdmin: boolean
): Promise<{ error: string } | { data: { prospectId?: string; establishmentId?: string }; path: string }> {
  const establishmentId = optionalString(formData, "establishmentId", "L'établissement", 40);
  const prospectId = optionalString(formData, "prospectId", "Le prospect", 40);
  if (!establishmentId.ok) return { error: establishmentId.error };
  if (!prospectId.ok) return { error: prospectId.error };

  if (establishmentId.value) {
    const establishment = await prisma.establishment.findFirst({
      where: { id: establishmentId.value, tenantId },
      select: { id: true },
    });
    if (!establishment) notFound();
    return {
      data: { establishmentId: establishment.id },
      path: `/dashboard/cabinet/etablissements/${establishment.id}`,
    };
  }

  if (prospectId.value) {
    // Le démarchage reste réservé à CABINET_ADMIN.
    if (!isAdmin) notFound();
    const prospect = await prisma.prospect.findFirst({
      where: { id: prospectId.value, tenantId },
      select: { id: true },
    });
    if (!prospect) notFound();
    return {
      data: { prospectId: prospect.id },
      path: `/dashboard/cabinet/commercial/prospects/${prospect.id}`,
    };
  }

  return { error: "Indiquez la structure concernée par ce rendez-vous." };
}

export async function createAppointment(
  _prevState: AppointmentActionResult,
  formData: FormData
): Promise<AppointmentActionResult> {
  const { tenantId, userId, session } = await requireCabinetSession();
  const isAdmin = session.user.role === "CABINET_ADMIN";

  const owner = await resolveOwner(formData, tenantId, isAdmin);
  if ("error" in owner) return owner;

  const kind = requiredEnum(formData, "kind", "Le type de rendez-vous", AppointmentKind);
  const mode = requiredEnum(formData, "mode", "Le format", AppointmentMode);
  const subject = requiredString(formData, "subject", "L'intitulé", 200);
  const date = requiredString(formData, "date", "La date", 10);
  const startTime = requiredString(formData, "startTime", "L'heure de début", 5);
  const endTime = requiredString(formData, "endTime", "L'heure de fin", 5);
  const location = optionalString(formData, "location", "Le lieu ou le lien", 500);
  const notes = optionalString(formData, "notes", "Les notes de préparation", 2000);

  const error = firstError(kind, mode, subject, date, startTime, endTime, location, notes);
  if (error) return { error };
  if (
    !kind.ok || !mode.ok || !subject.ok || !date.ok ||
    !startTime.ok || !endTime.ok || !location.ok || !notes.ok
  ) {
    return { error: "Formulaire invalide." };
  }

  // Date et heures sont saisies séparément — c'est ce que rendent les champs natifs
  // `date` et `time`, et c'est aussi ce qu'on dicte au téléphone. Recomposées en
  // heure LOCALE : un rendez-vous est un moment de la journée de quelqu'un.
  const startsAt = combineDateAndTime(date.value, startTime.value);
  const endsAt = combineDateAndTime(date.value, endTime.value);
  if (!startsAt || !endsAt) return { error: "La date ou l'heure saisie est invalide." };

  const rangeError = appointmentRangeError(startsAt, endsAt);
  if (rangeError) return { error: rangeError };

  await prisma.appointment.create({
    data: {
      tenantId,
      ...owner.data,
      kind: kind.value,
      mode: mode.value,
      subject: subject.value,
      location: location.value,
      notes: notes.value,
      startsAt,
      endsAt,
      // Le client ne voit pas un rendez-vous de prospection : il n'est pas encore
      // client, et ces créneaux ne le concernent pas.
      visibleToClient: owner.data.establishmentId !== undefined,
      createdByUserId: userId,
    },
  });

  revalidatePath(AGENDA_PATH);
  revalidatePath(owner.path);
  revalidatePath("/dashboard/client");
  return null;
}

// `YYYY-MM-DD` + `HH:MM` → Date locale. Construite composant par composant plutôt que
// par `new Date("2026-09-03T09:00")` : selon le format, JavaScript interprète la
// chaîne en UTC, et le rendez-vous de 9 h s'affiche à 11 h.
function combineDateAndTime(date: string, time: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return null;

  const value = new Date(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2])
  );
  return Number.isNaN(value.getTime()) ? null : value;
}

// Confirmer un créneau proposé, ou annuler. Pas de suppression : un rendez-vous
// annulé s'est quand même passé dans la relation client — il a été proposé, puis
// retiré, et cette trace vaut mieux qu'une ligne disparue.
export async function setAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus
): Promise<AppointmentActionResult> {
  const { tenantId, session } = await requireCabinetSession();

  if (!isEnumValue(status, AppointmentStatus)) return { error: "Statut invalide." };

  const appointment = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      ...scopeForRole(tenantId, session.user.role === "CABINET_ADMIN"),
    },
    select: { id: true, status: true, prospectId: true, establishmentId: true },
  });
  if (!appointment) notFound();
  if (appointment.status === status) return null;

  await prisma.appointment.update({ where: { id: appointment.id }, data: { status } });

  revalidatePath(AGENDA_PATH);
  if (appointment.establishmentId) {
    revalidatePath(`/dashboard/cabinet/etablissements/${appointment.establishmentId}`);
    revalidatePath("/dashboard/client");
  }
  if (appointment.prospectId) {
    revalidatePath(`/dashboard/cabinet/commercial/prospects/${appointment.prospectId}`);
  }
  return null;
}
