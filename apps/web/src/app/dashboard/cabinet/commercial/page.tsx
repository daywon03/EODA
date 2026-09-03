import Link from "next/link";
import { getProspectKpiCounts } from "@/lib/actions/prospect";
import { listDevisForKpi } from "@/lib/actions/devis";
import { listPortfolioRowsForKpi } from "@/lib/actions/establishment";
import { listPendingOptionRequests } from "@/lib/actions/option-request";
import { OptionRequestQueue } from "@/components/devis/OptionRequestQueue";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/kpi/KpiCard";
import { BreakdownList } from "@/components/kpi/BreakdownList";
import { FunnelChart } from "@/components/kpi/FunnelChart";
import { FORMULE_LABELS } from "@/components/mission/formule-labels";
import { formatEuros } from "@/lib/services/price-format-service";
import {
  computeFunnelBreakdown,
  groupActiveMissionsByFormule,
} from "@/lib/services/portfolio-kpi-service";
import { buildFunnelSteps } from "@/lib/services/funnel-view-service";
import {
  computeConversionRatePercent,
  computeIssuedDevisCount,
  computeSignedRevenueEuros,
  computeWeightedPipelineEuros,
} from "@/lib/services/commercial-kpi-service";
import { Briefcase, Euro, FileText, Plus, Target, TrendingUp } from "lucide-react";

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
  // Passage du « combien à chaque étape » au « où ça décroche » (funnel-view-service).
  const funnelSteps = buildFunnelSteps(funnel.byStage);
  const activeMissionsByFormule = groupActiveMissionsByFormule(portfolio);

  // Chaque indicateur porte sa DÉFINITION. Un chiffre dont on ne sait pas ce qu'il
  // compte se fait mal interpréter une fois, puis plus jamais regarder.
  const stats = [
    // Devis annulés exclus partout : ils conservent leur numéro mais sortent des
    // indicateurs (cf. commercial-kpi-service).
    {
      label: "Devis émis",
      value: String(computeIssuedDevisCount(devisList)),
      icon: Briefcase,
      hint: "Hors brouillons et devis annulés.",
    },
    {
      label: "Taux de conversion",
      value: `${conversionRate}%`,
      icon: TrendingUp,
      hint: "Devis signés sur devis émis.",
    },
    {
      label: "Pipeline pondéré",
      value: formatEuros(weightedPipeline),
      icon: Target,
      hint: "Montants en cours, pondérés par la probabilité de l'étape.",
    },
    {
      label: "CA signé cumulé",
      value: formatEuros(signedRevenue),
      icon: Euro,
      hint: "Total des devis signés, depuis l'origine.",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline commercial"
        subtitle="Prospects, devis et indicateurs — usage interne Cabinet uniquement"
        icon={Briefcase}
        action={
          // Une seule action PRIMAIRE par écran (`primary-action`) : créer un
          // prospect, l'entrée de l'entonnoir. Le devis vient après, et depuis un
          // prospect — d'où son rang secondaire.
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/dashboard/cabinet/commercial/prospects/nouveau">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Nouveau prospect
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/cabinet/commercial/devis">
                <FileText className="h-4 w-4" aria-hidden="true" />
                Les devis
              </Link>
            </Button>
          </div>
        }
      />

      {/* Les demandes clients EN TÊTE quand il y en a : ce sont les seules lignes de
          cet écran qui attendent une action, et §12.3 les veut impossibles à rater.
          File vide, la carte descend en bas de page — une boîte de réception vide
          n'est pas ce qu'on vient lire ici, et elle occuperait la place de ce qui
          compte (`content-priority`). Elle ne disparaît pas pour autant : cacher une
          section rend la fonctionnalité introuvable. */}
      {optionRequests.length > 0 && <OptionRequestQueue requests={optionRequests} />}

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gris-mid">
          Indicateurs commerciaux
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(({ label, value, icon, hint }) => (
            <KpiCard key={label} label={label} value={value} icon={icon} hint={hint} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gris-mid">
          Du premier contact à la fin d&apos;accompagnement
        </h2>
        {/* L'entonnoir prend deux tiers de la largeur : c'est la lecture principale
            de l'écran, les répartitions sont du contexte. */}
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <FunnelChart
              steps={funnelSteps}
              lost={funnel.byStage.PERDU}
              indetermine={funnel.indetermine}
            />
          </div>

          <div className="space-y-4">
            {/* Ce qui reste à livrer, pas ce qui a été vendu : missions non closes,
                réparties par la formule portée par la mission (CLAUDE.md §7). */}
            <BreakdownList
              title="Missions actives par formule"
              entries={Object.entries(activeMissionsByFormule).map(([formule, count]) => ({
                label: FORMULE_LABELS[formule as keyof typeof FORMULE_LABELS],
                count,
              }))}
              emptyMessage="Aucun accompagnement en cours. Une mission apparaît ici dès la signature d'un devis."
            />
            <BreakdownList
              title="Prospects par type de structure"
              entries={Object.entries(byStructureType).map(([type, count]) => ({
                label: STRUCTURE_TYPE_LABELS[type as keyof typeof STRUCTURE_TYPE_LABELS],
                count,
              }))}
              emptyMessage="Aucun prospect enregistré pour l'instant."
            />
          </div>
        </div>
      </section>

      {optionRequests.length === 0 && <OptionRequestQueue requests={optionRequests} />}
    </div>
  );
}
