import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildMonthGrid, type CalendarAppointment } from "@/lib/services/calendar-service";
import { formatTime } from "@/lib/services/date-format-service";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
const MONTH_LABEL = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

type Props = {
  year: number;
  month: number;
  appointments: CalendarAppointment[];
  now: Date;
  basePath: string;
};

// Vue mois. Navigation par LIENS et non par état client : le mois affiché vit dans
// l'URL, donc un mois se partage, se met en favori, et le bouton « retour » du
// navigateur fait ce qu'on attend de lui.
export function MonthGrid({ year, month, appointments, now, basePath }: Props) {
  const weeks = buildMonthGrid(year, month, appointments, now);
  const previous = month === 0 ? { y: year - 1, m: 11 } : { y: year, m: month - 1 };
  const next = month === 11 ? { y: year + 1, m: 0 } : { y: year, m: month + 1 };
  const label = MONTH_LABEL.format(new Date(year, month, 1));

  return (
    <div className="rounded-xl border border-gris-light bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-gris-light px-4 py-3">
        <Link
          href={`${basePath}?mois=${previous.y}-${String(previous.m + 1).padStart(2, "0")}`}
          aria-label="Mois précédent"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-gris-mid transition-colors hover:bg-ivoire hover:text-brun-ancre focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terre"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        </Link>

        <p className="text-sm font-semibold text-brun-ancre first-letter:uppercase">{label}</p>

        <Link
          href={`${basePath}?mois=${next.y}-${String(next.m + 1).padStart(2, "0")}`}
          aria-label="Mois suivant"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-gris-mid transition-colors hover:bg-ivoire hover:text-brun-ancre focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terre"
        >
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>

      {/* La grille déborde en largeur sur un petit écran plutôt que d'écraser les
          colonnes : sept jours ne tiennent pas lisiblement dans 375 px. */}
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-7 border-b border-gris-light bg-ivoire/60">
            {WEEKDAYS.map((day) => (
              <div key={day} className="px-2 py-2 text-center text-xs font-medium text-gris-mid">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {weeks.flat().map((day) => (
              <div
                key={day.date.toISOString()}
                className={cn(
                  "min-h-[92px] border-b border-r border-gris-light p-1.5 last:border-r-0",
                  !day.inMonth && "bg-ivoire/40"
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs tabular-nums",
                      day.isToday && "bg-terre font-semibold text-ivoire-light",
                      !day.isToday && day.inMonth && "text-brun-ancre",
                      !day.isToday && !day.inMonth && "text-gris-mid"
                    )}
                  >
                    {day.date.getDate()}
                  </span>
                  {day.appointments.length > 2 && (
                    <span className="text-[10px] font-medium text-gris-mid tabular-nums">
                      +{day.appointments.length - 2}
                    </span>
                  )}
                </div>

                <ul className="mt-1 space-y-1">
                  {day.appointments.slice(0, 2).map((appointment) => (
                    <li key={appointment.id}>
                      {/* Une pastille par rendez-vous : heure, puis structure. Le
                          statut annulé est barré ET grisé — jamais la couleur seule. */}
                      <span
                        className={cn(
                          "block truncate rounded px-1.5 py-1 text-[11px] leading-tight",
                          appointment.status === "ANNULE"
                            ? "bg-gris-light/60 text-gris-mid line-through"
                            : appointment.status === "CONFIRME"
                              ? "bg-vert-ok/15 text-brun-ancre"
                              : "bg-ambre/20 text-brun-ancre"
                        )}
                        title={`${appointment.subject} — ${appointment.structureName}`}
                      >
                        <span className="tabular-nums">{formatTime(appointment.startsAt)}</span>{" "}
                        {appointment.structureName}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gris-light px-4 py-2 text-xs text-gris-mid">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-ambre/60" aria-hidden="true" />
          Créneau proposé
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-vert-ok/40" aria-hidden="true" />
          Confirmé
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-gris-light" aria-hidden="true" />
          Annulé
        </span>
      </p>
    </div>
  );
}
