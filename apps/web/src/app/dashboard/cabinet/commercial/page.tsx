import { getProspectKpiCounts } from "@/lib/actions/prospect";
import { listDevisForKpi } from "@/lib/actions/devis";
import { listPortfolioRowsForKpi } from "@/lib/actions/establishment";
import { listPendingOptionRequests } from "@/lib/actions/option-request";
import { OptionRequestQueue } from "@/components/devis/OptionRequestQueue";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/kpi/KpiCard";
import { BreakdownList } from "@/components/kpi/BreakdownList";
import { FORMULE_LABELS } from "@/components/mission/formule-labels";
import { FUNNEL_STAGES, FUNNEL_STAGE_LABELS } from "@/lib/services/lifecycle-service";
import { formatEuros } from "@/lib/services/price-format-service";
import {
  computeFunnelBreakdown,
  groupActiveMissionsByFormule,
} from "@/lib/services/portfolio-kpi-service";
import {
  computeConversionRatePercent,
  computeIssuedDevisCount,
  computeSignedRevenueEuros,
  computeWeightedPipelineEuros,
} from "@/lib/services/commercial-kpi-service";
import { Briefcase, TrendingUp, Euro, Target } from "lucide-react";

export const metadata = { title: "Pipeline commercial · EODA Conseil" };

const STRUCTURE_TYPE_LABELS = { ASSOCIATION: "Association", PRIVE: "Privé", PUBLIC: "Public" } as const;

export default async function CommercialDashboardPage() {
  // Les répartitions prospects sont comptées en base (groupBy) et non en chargeant
  // la table pour la compter en mémoire ; les devis sont lus en projection étroite
  // (4 scalaires) — un KPI calculé sur une page serait faux, il n'est donc pas paginé.
  const [{ byStatus, byStructureType }, devisList, optionRequests, portfolio] = await Promise.all([
    getProspectKpiCounts(),
    listDevisForKpi(),
    // Demandes d'options émises depuis les portails clients (§12.3) — la
    // contrepartie interne du paywall « Mon accompagnement ».
    listPendingOptionRequests(),
    // L'aval de l'entonnoir : les fiches clients et l'état réel de leur
    // accompagnement. Sans elles, les indicateurs s'arrêtaient à la signature.
    listPortfolioRowsForKpi(),
  ]);

  const conversionRate = computeConversionRatePercent(devisList);
  const weightedPipeline = computeWeightedPipelineEuros(devisList);
  const signedRevenue = computeSignedRevenueEuros(devisList);

  // Prospects non convertis + fiches clients sur une seule échelle : « où en est
  // chaque structure ? », du premier contact à la fin d'accompagnement.
  const funnel = computeFunnelBreakdown({
    unconvertedProspectsByStatus: byStatus,
    establishments: portfolio,
  });
  const activeMissionsByFormule = groupActiveMissionsByFormule(portfolio);

  const stats = [
    // Devis annulés exclus partout : ils conservent leur numéro mais sortent des
    // indicateurs (cf. commercial-kpi-service).
    { label: "Devis émis", value: String(computeIssuedDevisCount(devisList)), icon: Briefcase },
    { label: "Taux de conversion", value: `${conversionRate}%`, icon: TrendingUp },
    { label: "Pipeline pondéré", value: formatEuros(weightedPipeline), icon: Target },
    { label: "CA signé cumulé", value: formatEuros(signedRevenue), icon: Euro },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Pipeline commercial" subtitle="Prospects, devis et indicateurs — usage interne Cabinet uniquement" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon }) => (
          <KpiCard key={label} label={label} value={value} icon={icon} />
        ))}
      </div>

      <OptionRequestQueue requests={optionRequests} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Une seule échelle du premier contact à la clôture. Les étapes après la
            signature viennent des faits de mission, jamais d'un statut stocké. */}
        <BreakdownList
          title="Entonnoir commercial"
          entries={FUNNEL_STAGES.map((stage) => ({
            label: FUNNEL_STAGE_LABELS[stage],
            count: funnel.byStage[stage],
          })).concat(
            // Affiché seulement s'il existe : une ligne « Indéterminé » à zéro sur
            // un dépôt sain donnerait l'impression d'un défaut permanent.
            funnel.indetermine > 0
              ? [{ label: "Indéterminé", count: funnel.indetermine }]
              : []
          )}
        />
        {/* Ce qui reste à livrer, pas ce qui a été vendu : missions non closes,
            réparties par la formule portée par la mission (CLAUDE.md §7). */}
        <BreakdownList
          title="Missions actives par formule"
          entries={Object.entries(activeMissionsByFormule).map(([formule, count]) => ({
            label: FORMULE_LABELS[formule as keyof typeof FORMULE_LABELS],
            count,
          }))}
        />
        <BreakdownList
          title="Prospects par type de structure"
          entries={Object.entries(byStructureType).map(([type, count]) => ({
            label: STRUCTURE_TYPE_LABELS[type as keyof typeof STRUCTURE_TYPE_LABELS],
            count,
          }))}
        />
      </div>
    </div>
  );
}
