import { getProspectKpiCounts } from "@/lib/actions/prospect";
import { listDevisForKpi } from "@/lib/actions/devis";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/kpi/KpiCard";
import { BreakdownList } from "@/components/kpi/BreakdownList";
import { PROSPECT_STATUS_LABELS } from "@/components/prospect/ProspectStatusBadge";
import { formatEuros } from "@/lib/services/price-format-service";
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
  const [{ byStatus, byStructureType }, devisList] = await Promise.all([
    getProspectKpiCounts(),
    listDevisForKpi(),
  ]);

  const conversionRate = computeConversionRatePercent(devisList);
  const weightedPipeline = computeWeightedPipelineEuros(devisList);
  const signedRevenue = computeSignedRevenueEuros(devisList);

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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <BreakdownList
          title="Pipeline par statut"
          entries={Object.entries(byStatus).map(([status, count]) => ({
            label: PROSPECT_STATUS_LABELS[status as keyof typeof PROSPECT_STATUS_LABELS],
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
