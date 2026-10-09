import Link from "next/link";
import { APPOINTMENT_MODE_LABELS, type CalendarAppointment } from "@/lib/services/calendar-service";
import { formatCalendarTile, formatTime } from "@/lib/services/date-format-service";

// « Prochains rendez-vous » de l'accueil cabinet — les mêmes que l'agenda
// (listUpcomingAgenda), avec la même portée par rôle.
export function UpcomingAppointments({ appointments }: { appointments: CalendarAppointment[] }) {
  return (
    <section aria-labelledby="rdv-heading" className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <h2 id="rdv-heading" className="text-xl font-bold text-ink">
          Prochains rendez-vous
        </h2>
        <Link
          href="/dashboard/cabinet/agenda"
          className="text-base font-bold text-accent-text underline-offset-4 hover:underline"
        >
          Ouvrir l&apos;agenda →
        </Link>
      </div>
      {appointments.length === 0 ? (
        <p className="py-4 text-base text-ink2">Aucun rendez-vous à venir.</p>
      ) : (
        <ul>
          {appointments.map((a) => {
            const tile = formatCalendarTile(a.startsAt);
            const meta = [a.structureName, formatTime(a.startsAt), APPOINTMENT_MODE_LABELS[a.mode]].join(" · ");
            const body = (
              <>
                <span
                  className="w-14 flex-shrink-0 rounded-lg border border-line bg-card py-1 text-center"
                  aria-hidden="true"
                >
                  <span className="block text-xl font-bold leading-tight tabular-nums">{tile.day}</span>
                  <span className="block text-sm text-ink2">{tile.month}</span>
                </span>
                <span className="flex flex-col">
                  <span className="sr-only">
                    Le {tile.day} {tile.month} :
                  </span>
                  <span className="font-bold">{a.subject}</span>
                  <span className="text-sm text-ink2">{meta}</span>
                </span>
              </>
            );
            return (
              <li key={a.id} className="border-b border-line">
                {a.href ? (
                  <Link href={a.href} className="flex gap-4 px-1 py-3.5 text-ink hover:bg-soft">
                    {body}
                  </Link>
                ) : (
                  <div className="flex gap-4 px-1 py-3.5 text-ink">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
