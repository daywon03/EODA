import { CalendarClock, ShieldCheck } from "lucide-react";
import { MeasureCard } from "@/components/ui/measure-card";
import { cn } from "@/lib/utils";
import type { BeneficiaryAggregates } from "@/lib/services/beneficiary-aggregate-service";

// Onglet cabinet « Personnes accompagnées » : des CHIFFRES, jamais une liste
// (décision de Damon, 14/10/2026 — minimisation RGPD/HDS). La liste nominative reste
// dans l'espace de la structure. Chaque nombre porte sa définition à l'écran.

function percentOf(part: number, total: number): number | undefined {
  return total > 0 ? Math.round((part / total) * 100) : undefined;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count > 1 ? many : one}`;
}

export function PeopleAggregates({ aggregates }: { aggregates: BeneficiaryAggregates }) {
  const { activePeople, receptionUpToDate, receptionToRenew, surveyDone, alerts } = aggregates;

  return (
    <div className="flex flex-col gap-6">
      <p className="flex max-w-[70ch] items-start gap-2 text-ink2">
        <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent-text" aria-hidden="true" />
        <span>
          Chiffres seulement : le nom, l&apos;adresse et le dossier de chaque personne restent dans l&apos;espace de la structure.
        </span>
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MeasureCard label="Personnes accompagnées" value={String(activePeople)} note="Accompagnement en cours aujourd'hui." />
        <MeasureCard
          label="Feuille de réception à jour"
          value={`${receptionUpToDate} / ${activePeople}`}
          percent={percentOf(receptionUpToDate, activePeople)}
          progressLabel="Part des feuilles de réception à jour"
          note="Remise signée, aucune échéance dans les 30 jours."
        />
        <MeasureCard
          label="À remettre ou à renouveler"
          value={`${receptionToRenew} / ${activePeople}`}
          percent={percentOf(receptionToRenew, activePeople)}
          progressLabel="Part des dossiers à remettre ou à renouveler"
          note="DIPEC pas encore remis, ou à revoir dans les 30 jours."
        />
        <MeasureCard
          label="Enquête de satisfaction faite"
          value={`${surveyDone} / ${activePeople}`}
          percent={percentOf(surveyDone, activePeople)}
          progressLabel="Part des personnes enquêtées"
          note="Sur les 12 derniers mois."
        />
      </div>

      <section aria-labelledby="alertes-agregees-titre" className="flex flex-col gap-2">
        <h3 id="alertes-agregees-titre" className="flex items-center gap-2 text-xl font-bold">
          <CalendarClock className="h-5 w-5 text-accent-text" aria-hidden="true" />
          Échéances des 30 prochains jours
        </h3>
        {alerts.total === 0 ? (
          <p className="text-ink2">Aucune échéance proche.</p>
        ) : (
          <dl className="grid grid-cols-1 divide-y divide-line rounded-xl border border-line bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <AlertCount label="DIPEC à remettre" value={alerts.toDeliver} />
            <AlertCount label="DIPEC ou projet personnalisé à revoir" value={alerts.toRenew} />
            <AlertCount label="Dont en retard" value={alerts.overdue} isUrgent={alerts.overdue > 0} />
          </dl>
        )}
        {alerts.total > 0 && (
          <p className="text-sm text-ink2">
            {plural(alerts.total, "échéance", "échéances")} au total. La structure voit le détail par personne dans son espace.
          </p>
        )}
      </section>
    </div>
  );
}

function AlertCount({ label, value, isUrgent = false }: { label: string; value: number; isUrgent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-3 sm:flex-col sm:items-start sm:gap-1">
      <dt className="text-ink2">{label}</dt>
      <dd className={cn("text-2xl font-bold tabular-nums", isUrgent ? "text-danger-text" : "text-ink")}>{value}</dd>
    </div>
  );
}
