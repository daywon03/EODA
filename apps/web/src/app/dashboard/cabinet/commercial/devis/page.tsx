import Link from "next/link";
import { listDevis, type DevisListPage } from "@/lib/actions/devis";
import { parsePageSize } from "@/lib/services/pagination-service";
import { DEVIS_TABS, describeDevisDates, devisRowActions, parseDevisTab } from "@/lib/services/devis-list-service";
import { formatStartingPrice } from "@/lib/services/price-format-service";
import { pillForDevisStatus } from "@/lib/design/status-vocabulary";
import { CommercialHeader } from "@/components/commercial/CommercialHeader";
import { LoadMoreLink } from "@/components/layout/LoadMoreLink";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";
import { TabsNav } from "@/components/ui/tabs-nav";
import { Button } from "@/components/ui/button";
import { SendDevisEmailButton } from "@/components/devis/SendDevisEmailButton";
import { DeleteDevisButton } from "@/components/devis/DeleteDevisButton";
import { Download, FileSignature } from "lucide-react";

export const metadata = { title: "Devis · Pipeline commercial" };

const BASE_PATH = "/dashboard/cabinet/commercial/devis";

type Props = { searchParams: Promise<{ taille?: string; onglet?: string }> };
type Row = DevisListPage["items"][number];

function columns(now: Date): DataTableColumn<Row>[] {
  return [
    { id: "number", header: "Numéro", isRowHeader: true, cell: (d) => <span className="tabular-nums">{d.number}</span> },
    {
      id: "structure",
      header: "Structure",
      cell: (d) => (
        <span className="flex flex-col">
          <span className="font-bold">{d.prospectStructureName}</span>
          <span className="text-sm text-ink2">{d.formuleLabelSnapshot}</span>
        </span>
      ),
    },
    { id: "status", header: "Statut", cell: (d) => <StatusPill pill={pillForDevisStatus(d.status)} /> },
    {
      id: "amount",
      header: "Montant",
      align: "end",
      cell: (d) => <span className="whitespace-nowrap tabular-nums">{formatStartingPrice({ priceEuros: d.totalAmountEuros })}</span>,
    },
    { id: "dates", header: "Dates", cell: (d) => <span className="text-sm text-ink2">{describeDevisDates({ ...d, now })}</span> },
    { id: "actions", header: "Actions", cell: (d) => <RowActions devis={d} /> },
  ];
}

// Gestes d'une ligne — au-dessus du lien étendu de la ligne (`relative z-10`).
// Pas de « Marquer signé » : la signature est un PARCOURS (convertDevisToClient)
// qui crée la fiche, la mission et ouvre le portail.
function RowActions({ devis }: { devis: Row }) {
  const actions = devisRowActions(devis.status, devis.prospectContactEmail);
  return (
    <div className="relative z-10 flex flex-wrap items-center gap-2">
      {actions.canSend && (
        <SendDevisEmailButton
          // Repart à neuf quand le statut change : une erreur ne survit pas à une
          // action qui a réussi.
          key={devis.status}
          devisId={devis.id}
          number={devis.number}
          structureName={devis.prospectStructureName}
          contactEmail={devis.prospectContactEmail}
          label="Envoyer"
        />
      )}
      {actions.canSign && (
        <Button size="sm" variant="outline" asChild>
          <Link href={`${BASE_PATH}/${devis.id}/signature`}>
            <FileSignature className="h-4 w-4" aria-hidden="true" />
            Signature
          </Link>
        </Button>
      )}
      <Button size="sm" variant="outline" asChild>
        <a href={`/imprimer/devis/${devis.id}?auto=1`} target="_blank" rel="noopener noreferrer">
          <Download className="h-4 w-4" aria-hidden="true" />
          PDF<span className="sr-only"> du devis {devis.number}</span>
        </a>
      </Button>
      {devis.status === "BROUILLON" && <DeleteDevisButton devisId={devis.id} number={devis.number} compact />}
    </div>
  );
}

export default async function DevisListPage({ searchParams }: Props) {
  const { taille, onglet } = await searchParams;
  const pageSize = parsePageSize(taille);
  const tab = parseDevisTab(onglet);
  const { items, totalCount, countsByTab } = await listDevis(pageSize, tab);

  return (
    <div className="space-y-6">
      <CommercialHeader
        title="Devis"
        description="Un devis signé ouvre l'accompagnement et l'accès aux documents de la structure. Un devis se crée depuis la fiche d'un prospect."
        action={
          <Button variant="outline" asChild>
            <Link href="/dashboard/cabinet/commercial/prospects">Choisir un prospect</Link>
          </Button>
        }
      />

      <TabsNav
        label="Filtrer les devis"
        activeId={tab}
        tabs={DEVIS_TABS.map((t) => ({ id: t.id, label: t.label, href: `${BASE_PATH}?onglet=${t.id}`, count: countsByTab[t.id] }))}
      />

      <DataTable
        caption="Devis"
        columns={columns(new Date())}
        rows={items}
        getRowKey={(d) => d.id}
        rowHref={(d) => `${BASE_PATH}/${d.id}`}
        emptyMessage="Aucun devis dans cette liste."
      />
      <LoadMoreLink basePath={BASE_PATH} query={{ onglet: tab }} shownCount={items.length} totalCount={totalCount} pageSize={pageSize} />
    </div>
  );
}
