import { CalendarClock, Check, Circle, HeartHandshake } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/services/date-format-service";
import type { TerrainPeopleBoard } from "@/lib/actions/terrain-read";

// Liste des personnes accompagnées (maquette « Espace structure », A3). La pastille
// d'enquête porte un glyphe ET un mot (jamais la couleur seule) ; le GIR est un repère
// de charge d'aide, pas un jugement.
function girTone(gir: number | null): string {
  if (gir === null) return "bg-soft text-ink";
  if (gir <= 2) return "bg-ink-fill text-on-ink";
  if (gir <= 4) return "bg-amber-fill text-ink";
  return "bg-soft text-ink";
}

const ALERT_LABEL = {
  DIPC_A_REMETTRE: "DIPEC à remettre",
  RENOUVELLEMENT: "À revoir",
} as const;

export function PeopleBoard({ board }: { board: TerrainPeopleBoard }) {
  return (
    <div className="flex flex-col gap-6">
      {board.alerts.length > 0 && (
        <section aria-labelledby="echeances-titre" className="flex flex-col gap-2">
          <h2 id="echeances-titre" className="flex items-center gap-2 text-xl font-bold">
            <CalendarClock className="h-5 w-5 text-accent-text" aria-hidden="true" />
            Échéances des 30 prochains jours
          </h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {board.alerts.map((alert) => (
              <li key={`${alert.beneficiaryId}-${alert.kind}-${alert.documentKind}`} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="min-w-[12rem] flex-1 font-bold">{alert.name}</span>
                <span>
                  {ALERT_LABEL[alert.kind]} · {alert.documentKind === "PAP" ? "projet personnalisé" : "DIPEC"}
                </span>
                <span className={cn("tabular-nums", alert.overdue ? "font-bold text-danger-text" : "text-ink2")}>
                  {alert.overdue ? "En retard depuis le " : "Avant le "}
                  {formatDate(alert.dueOn)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {board.people.length === 0 ? (
        <EmptyState
          icon={HeartHandshake}
          title="Aucun dossier pour l'instant"
          description={
            board.hdsAvailable
              ? "Les dossiers se créent sur la tablette, à l'arrivée d'une personne, avec la feuille de réception signée."
              : "Les dossiers des personnes accompagnées s'ouvriront avec l'hébergement certifié HDS. Rien n'est enregistré d'ici là."
          }
        />
      ) : (
        <ul className="flex flex-col gap-2.5" aria-label="Personnes accompagnées">
          {board.people.map((person) => (
            <li key={person.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-card px-4 py-3">
              <span
                className={cn("flex h-14 w-14 flex-shrink-0 flex-col items-center justify-center rounded-lg leading-tight", girTone(person.girLevel))}
                aria-label={person.girLevel ? `GIR ${person.girLevel}` : "GIR non renseigné"}
              >
                <span className="text-sm font-bold" aria-hidden="true">GIR</span>
                <span className="text-[22px] font-bold" aria-hidden="true">{person.girLevel ?? "–"}</span>
              </span>
              <span className="flex min-w-[12rem] flex-[2] flex-col">
                <span className="text-lg font-bold">{person.name}</span>
                {person.monthlyHours !== null && <span className="text-ink2">{person.monthlyHours} h par mois</span>}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-3 py-0.5 font-bold",
                  person.surveyDone ? "border-ok-text bg-ok-soft text-ink" : "border-dashed border-ink2 bg-card text-ink"
                )}
              >
                {person.surveyDone ? <Check className="h-4 w-4" aria-hidden="true" /> : <Circle className="h-4 w-4" aria-hidden="true" />}
                {person.surveyDone ? "Enquête faite" : "Enquête à faire"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
