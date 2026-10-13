import Link from "next/link";
import { listDevis, type DevisListItem } from "@/lib/actions/devis-read";
import { parsePageSize } from "@/lib/services/pagination-service";
import { DEVIS_TABS, describeDevisDates, devisRowActions, parseDevisTab } from "@/lib/services/devis-list-service";
import { summarizeDevis } from "@/lib/services/devis-recap-service";
import { pillForDevisStatus } from "@/lib/design/status-vocabulary";
import { CommercialHeader } from "@/components/commercial/CommercialHeader";
import { LoadMoreLink } from "@/components/layout/LoadMoreLink";
import { StatusPill } from "@/components/ui/status-pill";
import { TabsNav } from "@/components/ui/tabs-nav";
import { Button } from "@/components/ui/button";
import { SendDevisEmailButton } from "@/components/devis/SendDevisEmailButton";
import { RemindDevisButton } from "@/components/devis/RemindDevisButton";
import { DeleteDevisButton } from "@/components/devis/DeleteDevisButton";
import { Download, FileSignature, Plus } from "lucide-react";

export const metadata = { title: "Devis · Pipeline commercial" };

const BASE_PATH = "/dashboard/cabinet/commercial/devis";

type Props = { searchParams: Promise<{ taille?: string; onglet?: string }> };

// Gestes d'une ligne (maquette v2) : Envoyer (brouillon), Relancer (envoyé), PDF,
// Signature. Pas de « Marquer signé » : la signature est un PARCOURS
// (convertDevisToClient) qui crée la fiche, la mission et ouvre le portail.
function RowActions({ devis }: { devis: DevisListItem }) {
  const actions = devisRowActions(devis.status, devis.prospectContactEmail);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.canSend && (
        <SendDevisEmailButton
          key={devis.status}
          devisId={devis.id}
          number={devis.number}
          structureName={devis.prospectStructureName}
          contactEmail={devis.prospectContactEmail}
          label="Envoyer"
        />
      )}
      {actions.canRemind && devis.prospectContactEmail && (
        <RemindDevisButton
          devisId={devis.id}
          number={devis.number}
          structureName={devis.prospectStructureName}
          contactEmail={devis.prospectContactEmail}
        />
      )}
      {actions.canSign && (
        <Button size="sm" variant="outline" asChild>
          <Link href={`${BASE_PATH}/${devis.id}/signature`}>
            <FileSignature className="h-4 w-4" aria-hidden="true" />
            Signature<span className="sr-only"> du devis {devis.number}</span>
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

function DevisRow({ devis, now }: { devis: DevisListItem; now: Date }) {
  const summary = summarizeDevis({
    formuleLabel: devis.formuleLabelSnapshot,
    optionLabels: devis.optionLabels,
    commitmentMonths: devis.commitmentMonths,
  });
  const dates = describeDevisDates({ ...devis, now });
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line px-4 py-4 last:border-b-0 sm:px-5">
      <span className="w-28 text-base tabular-nums text-ink2">{devis.number}</span>
      <span className="flex min-w-0 flex-[2_1_14rem] flex-col">
        <Link
          href={`${BASE_PATH}/${devis.id}`}
          className="w-fit font-bold text-ink underline-offset-4 hover:underline"
        >
          {devis.prospectStructureName}
        </Link>
        <span className="text-base text-ink2">{summary}</span>
      </span>
      <StatusPill pill={pillForDevisStatus(devis.status)} />
      <span className="flex-[1_1_10rem] text-base text-ink2">
        {dates}
        {devis.clientNote && <span className="block truncate">Note : {devis.clientNote}</span>}
      </span>
      <RowActions devis={devis} />
    </li>
  );
}

export default async function DevisListPage({ searchParams }: Props) {
  const { taille, onglet } = await searchParams;
  const pageSize = parsePageSize(taille);
  const tab = parseDevisTab(onglet);
  const { items, totalCount, countsByTab } = await listDevis(pageSize, tab);
  const now = new Date();

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4">
      <CommercialHeader
        title="Devis"
        description="Un devis signé ouvre l'accompagnement et l'accès aux documents de la structure."
        action={
          <Button asChild>
            <Link href={`${BASE_PATH}/nouveau`}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nouveau devis
            </Link>
          </Button>
        }
      />

      <TabsNav
        label="Filtrer les devis"
        activeId={tab}
        tabs={DEVIS_TABS.map((t) => ({ id: t.id, label: t.label, href: `${BASE_PATH}?onglet=${t.id}`, count: countsByTab[t.id] }))}
      />

      <section aria-label="Liste des devis" className="rounded-xl border border-line bg-card">
        {items.length === 0 ? (
          <p className="px-5 py-10 text-center text-ink2">Aucun devis dans cette liste.</p>
        ) : (
          <ul>
            {items.map((d) => (
              <DevisRow key={d.id} devis={d} now={now} />
            ))}
          </ul>
        )}
      </section>
      <LoadMoreLink basePath={BASE_PATH} query={{ onglet: tab }} shownCount={items.length} totalCount={totalCount} pageSize={pageSize} />
    </div>
  );
}
