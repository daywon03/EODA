import Link from "next/link";
import { CalendarDays } from "lucide-react";
import {
  APPOINTMENT_KIND_LABELS,
  groupByDay,
  type CalendarAppointment,
} from "@/lib/services/calendar-service";
import { formatDayHeading, formatTimeRange } from "@/lib/services/date-format-service";
import { AppointmentMode, AppointmentStatusBadge } from "./AppointmentStatusBadge";
import { AppointmentStatusActions } from "./AppointmentStatusActions";

type Props = {
  appointments: CalendarAppointment[];
  // Portail client : pas de bouton de confirmation, pas de lien vers une fiche
  // interne. Le client lit son agenda, il ne le pilote pas.
  readOnly?: boolean;
  // Affiché quand il n'y a rien — un écran vide sans explication ressemble à une
  // panne, surtout pour quelqu'un qui n'est pas à l'aise avec l'outil.
  emptyMessage: string;
};

export function AppointmentList({ appointments, readOnly = false, emptyMessage }: Props) {
  if (appointments.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-dashed border-gris-light px-4 py-5 text-sm text-gris-mid">
        <CalendarDays className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {groupByDay(appointments).map((group) => (
        <section key={group.date.toISOString()} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gris-mid">
            {formatDayHeading(group.date)}
          </h3>
          <ul className="divide-y divide-gris-light rounded-lg border border-gris-light bg-white">
            {group.appointments.map((appointment) => (
              <li
                key={appointment.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    {/* L'heure d'abord, en chiffres alignés : c'est ce qu'on cherche
                        en parcourant une journée. */}
                    <span className="text-sm font-semibold text-brun-ancre tabular-nums">
                      {formatTimeRange(appointment.startsAt, appointment.endsAt)}
                    </span>
                    <span className="text-sm text-brun-ancre">{appointment.subject}</span>
                  </p>
                  <p className="text-xs text-gris-mid">
                    {APPOINTMENT_KIND_LABELS[appointment.kind]}
                    {/* Rendez-vous tenu avant la signature : dit en toutes lettres,
                        sinon il se lit comme un point d'accompagnement — et personne
                        ne comprend pourquoi il n'apparaît pas côté client. */}
                    {appointment.beforeSignature && (
                      <span className="ml-1.5 rounded bg-ivoire px-1.5 py-0.5 text-[10px] font-medium text-brun-moyen">
                        avant signature
                      </span>
                    )}
                    {!readOnly && (
                      <>
                        {" · "}
                        {appointment.href ? (
                          <Link
                            href={appointment.href}
                            className="text-terre underline underline-offset-2 hover:text-brun-moyen transition-colors"
                          >
                            {appointment.structureName}
                          </Link>
                        ) : (
                          appointment.structureName
                        )}
                      </>
                    )}
                  </p>
                  <AppointmentMode mode={appointment.mode} location={appointment.location} />
                </div>

                <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                  <AppointmentStatusBadge status={appointment.status} />
                  {!readOnly && (
                    <AppointmentStatusActions
                      appointmentId={appointment.id}
                      status={appointment.status}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
