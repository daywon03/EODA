import Link from "next/link";
import { listProspectPipeline } from "@/lib/actions/prospect-pipeline";
import type { PipelineFacts } from "@/lib/db/read-prospect-pipeline";
import {
  modeLabelFor,
  ORIGIN_FILTERS,
  PIPELINE_ACTION_LABELS,
  PIPELINE_TABS,
  pipelineAction,
} from "@/lib/services/prospect-pipeline-service";
import { describeAcquisitionChannel } from "@/lib/services/prospect-contact-service";
import { formatDate } from "@/lib/services/date-format-service";
import { pillForProspectStatus } from "@/lib/design/status-vocabulary";
import { CommercialHeader } from "@/components/commercial/CommercialHeader";
import { SignalDot } from "@/components/commercial/SignalDot";
import { TabsNav } from "@/components/ui/tabs-nav";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";
import { RemindProspectButton } from "@/components/prospect/RemindProspectButton";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

export const metadata = { title: "Prospects · Pipeline commercial" };

const BASE_PATH = "/dashboard/cabinet/commercial/prospects";

type Props = { searchParams: Promise<{ onglet?: string; origine?: string }> };

function href(tab: string, origin: string): string {
  return `${BASE_PATH}?onglet=${tab}&origine=${origin}`;
}

function RowAction({ row }: { row: PipelineFacts }) {
  const action = pipelineAction(row);
  if (action === "REMIND") return <RemindProspectButton prospectId={row.id} structureName={row.structureName} />;
  return (
    <Button size="sm" variant={action === "PREPARE_CALL" ? "default" : "outline"} asChild>
      <Link href={`${BASE_PATH}/${row.id}`}>
        {PIPELINE_ACTION_LABELS[action]}
        <span className="sr-only"> — {row.structureName}</span>
      </Link>
    </Button>
  );
}

function ProspectRow({ row }: { row: PipelineFacts }) {
  const isSelfService = row.origin === "LIBRE_SERVICE";
  return (
    <tr className={cn("border-t border-line align-middle", row.hasPendingCall ? "bg-paper" : "bg-card")}>
      <th scope="row" className="px-4 py-3.5 text-left font-normal">
        <span className="flex flex-col gap-1">
          <Link href={`${BASE_PATH}/${row.id}`} className="w-fit font-bold text-ink underline-offset-4 hover:underline">
            {row.structureName}
          </Link>
          <span
            className={cn(
              "inline-flex w-fit whitespace-nowrap rounded-md border px-2.5 py-0.5 text-sm font-bold",
              row.envisagedFormule === "EXCELLENCE" && isSelfService
                ? "border-ink bg-ink-fill text-on-ink"
                : isSelfService
                  ? "border-ink2 bg-soft text-ink"
                  : "border-muted bg-card text-ink2"
            )}
          >
            {modeLabelFor(row.origin, row.envisagedFormule)}
          </span>
        </span>
      </th>
      <td className="whitespace-nowrap px-4 py-3.5 tabular-nums">{formatDate(row.firstContactDate)}</td>
      <td className="px-4 py-3.5">
        {row.progress ? (
          <span className="flex min-w-[10rem] flex-col gap-1.5">
            <span>{row.progress.label}</span>
            <ProgressBar
              value={row.progress.percent}
              label={`Diagnostic de ${row.structureName}`}
              valueText={row.progress.label}
              colorClassName="bg-accent-fill"
              className="h-1.5"
            />
          </span>
        ) : (
          <span className="text-ink2">{describeAcquisitionChannel(row)}</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3.5 font-bold tabular-nums">
        {row.workCount === null ? "—" : `${row.workCount} document${row.workCount > 1 ? "s" : ""}`}
      </td>
      <td className="px-4 py-3.5">
        {row.signal ? (
          <SignalDot tone={row.signal.tone} text={row.signal.text} />
        ) : (
          <span className="text-ink2">{row.hasPendingCall ? "Appel prévu" : pillForProspectStatus(row.status).label}</span>
        )}
      </td>
      <td className="px-4 py-3.5 text-right">
        <RowAction row={row} />
      </td>
    </tr>
  );
}

// Maquette v2 « Prospects » : un tableau, des onglets, le filtre « Origine » pour
// retrouver les prospects démarchés (bouche-à-oreille, UNA…) à côté des structures
// inscrites seules. Le kanban est retiré (13/10/2026) ; l'étape commerciale d'un
// prospect se change depuis sa fiche.
export default async function ProspectsPage({ searchParams }: Props) {
  const params = await searchParams;
  const { rows, counts, tab, origin } = await listProspectPipeline({ tab: params.onglet, origin: params.origine });

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4">
      <CommercialHeader
        title="Prospects"
        description="Les structures inscrites seules et les structures démarchées. Quand un diagnostic est terminé, la structure voit sa liste de travail : c'est le bon moment pour proposer un accompagnement."
        action={
          <Button variant="outline" asChild>
            <Link href={`${BASE_PATH}/nouveau`}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nouveau prospect démarché
            </Link>
          </Button>
        }
      />

      <nav aria-label="Origine des prospects" className="flex flex-wrap gap-2">
        {ORIGIN_FILTERS.map((o) => (
          <Link
            key={o.id}
            href={href(tab, o.id)}
            aria-current={o.id === origin ? "true" : undefined}
            scroll={false}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full border px-4 text-base",
              o.id === origin ? "border-ink-fill bg-ink-fill font-bold text-on-ink" : "border-line bg-card text-ink hover:border-muted"
            )}
          >
            {o.id === origin && <span aria-hidden="true">✓&nbsp;</span>}
            {o.label}
          </Link>
        ))}
      </nav>

      <TabsNav
        label="Filtrer les prospects"
        activeId={tab}
        tabs={PIPELINE_TABS.map((t) => ({ id: t.id, label: t.label, href: href(t.id, origin), count: counts[t.id] }))}
      />

      <div role="region" aria-label="Prospects" tabIndex={0} className="relative overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full min-w-[1000px] border-collapse text-left text-base">
          <caption className="sr-only">Prospects</caption>
          <thead className="bg-soft">
            <tr>
              {["Structure", "Inscrite le", "Diagnostic", "À créer", "Signal"].map((h) => (
                <th key={h} scope="col" className="whitespace-nowrap px-4 py-3 text-sm font-bold text-ink">
                  {h}
                </th>
              ))}
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink2">
                  Aucun prospect dans cette liste.
                </td>
              </tr>
            ) : (
              rows.map((row) => <ProspectRow key={row.id} row={row} />)
            )}
          </tbody>
        </table>
      </div>
      <p className="text-base text-ink2">
        Vous voyez l&apos;avancement et l&apos;activité. Jamais le contenu des réponses ni des documents, tant
        qu&apos;aucun accompagnement n&apos;est signé.
      </p>
    </div>
  );
}
