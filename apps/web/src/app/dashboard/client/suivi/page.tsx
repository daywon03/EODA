import Link from "next/link";
import { AlertTriangle, CheckCircle2, MessageSquareWarning, Search, TrendingUp, Upload } from "lucide-react";
import { getClientMissionProgress } from "@/lib/actions/client-mission-progress";
import { getClientContract } from "@/lib/actions/client-contract";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";
import { MissionProgressSummary } from "@/components/mission/MissionProgressSummary";
import { PHASE_LABELS, PHASE_ORDER } from "@/lib/services/mission-progress-service";

export const metadata = { title: "Mon suivi · EODA Conseil" };

// « Mon suivi » — la progression du projet, séparée du cadre contractuel et
// financier (« Mon contrat »). Demande du 07/09/2026 : la structure veut voir où
// elle en est (« Phase 1 : analyse des documents ») sans traverser des montants
// pour y arriver. Deux lectures déjà existantes, jamais montrées ensemble au
// client jusqu'ici : la progression de mission (jusque-là cabinet uniquement) et
// la contrepartie documentaire (déménagée depuis « Mon contrat »).
export default async function ClientSuiviPage() {
  const [progressView, { establishment, documents, documentProgressPercent, counters }] =
    await Promise.all([getClientMissionProgress(), getClientContract()]);

  if (!establishment) {
    return (
      <div className="space-y-6">
        <PageHeader title="Mon suivi" icon={TrendingUp} accent="ambre" />
        <div className="flex items-start gap-3 bg-ambre/10 border border-ambre/30 rounded-lg px-5 py-4">
          <AlertTriangle className="w-5 h-5 text-ambre flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold text-brun-ancre">Aucun établissement rattaché</p>
            <p className="text-gris-mid">
              Votre consultant EODA doit d&apos;abord vous rattacher à votre établissement.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const obligations = [
    {
      label: "À déposer",
      value: documents.toDeposit,
      icon: Upload,
      color: "text-rouge-imp bg-rouge-imp/10",
    },
    {
      label: "Commentés, en attente d'arbitrage",
      value: documents.justified,
      icon: MessageSquareWarning,
      color: "text-ambre bg-ambre/10",
    },
    {
      label: "Déposés, en cours de revue",
      value: documents.inReview,
      icon: Search,
      color: "text-brun-moyen bg-gris-light",
    },
    {
      label: "Conformes",
      value: documents.compliant,
      icon: CheckCircle2,
      color: "text-vert-ok bg-vert-ok/10",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mon suivi"
        subtitle={`${establishment.name} — où en est votre accompagnement`}
        icon={TrendingUp}
        accent="ambre"
      />

      {progressView.hasMission ? (
        <section className="space-y-4">
          <MissionProgressSummary
            diagnosticPct={progressView.progress.diagnosticPct}
            phasesPct={progressView.progress.phasesPct}
            globalPct={progressView.progress.globalPct}
          />

          <div className="bg-white border border-gris-light rounded-xl p-5 space-y-3">
            <h2 className="text-base font-semibold text-brun-ancre">Détail des phases</h2>
            <ul className="divide-y divide-gris-light">
              {PHASE_ORDER.map((phase) => {
                const pct = progressView.progress.phasePcts[phase];
                return (
                  <li key={phase} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="text-sm text-brun-ancre">{PHASE_LABELS[phase]}</span>
                    <span className="text-sm text-gris-mid tabular-nums">
                      {pct === undefined ? "—" : `${pct}%`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ) : (
        <div className="bg-white border border-gris-light rounded-xl p-5">
          <p className="text-sm text-gris-mid">
            Le suivi détaillé s&apos;ouvre dès que votre consultant EODA démarre le diagnostic.
          </p>
        </div>
      )}

      {/* Contrepartie documentaire — déménagée depuis « Mon contrat » (07/09/2026) :
          c'est un indicateur de progression, pas un chiffre financier. */}
      <section className="bg-white border border-gris-light rounded-xl p-5 space-y-4">
        <h2 className="text-base font-semibold text-brun-ancre">Ce que vous devez fournir</h2>
        <p className="text-xs text-gris-mid -mt-2">
          La contrepartie documentaire de votre offre — seules les pièces couvertes par votre
          formule sont demandées.
        </p>

        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-brun-ancre">Progression documentaire</span>
          <span className="text-gris-mid tabular-nums">
            {documents.compliant} / {documents.total} pièces conformes
          </span>
        </div>
        <ProgressBar value={documentProgressPercent} colorClassName="bg-vert-ok" />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {obligations.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="flex items-start gap-2.5">
              <span className={`flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 ${color}`}>
                <Icon className="w-4 h-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-brun-ancre tabular-nums leading-none">{value}</p>
                <p className="text-xs text-gris-mid leading-tight mt-1">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {counters && (
          <p className="text-xs text-gris-mid border-t border-gris-light pt-3">
            Traitement EODA sur vos dépôts : {counters.deposited} document
            {counters.deposited > 1 ? "s" : ""} déposé{counters.deposited > 1 ? "s" : ""} ·{" "}
            {counters.analyzed} analysé{counters.analyzed > 1 ? "s" : ""} · {counters.modified} mis
            à jour · {counters.compliant} conforme{counters.compliant > 1 ? "s" : ""}.
          </p>
        )}

        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/client">
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            Déposer mes documents
          </Link>
        </Button>
      </section>
    </div>
  );
}
