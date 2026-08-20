import { listDevis } from "@/lib/actions/devis";
import { parsePageSize } from "@/lib/services/pagination-service";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoadMoreLink } from "@/components/layout/LoadMoreLink";
import { DevisCard } from "@/components/devis/DevisCard";
import { FileText } from "lucide-react";

export const metadata = { title: "Devis · Pipeline commercial · EODA Conseil" };

const BASE_PATH = "/dashboard/cabinet/commercial/devis";

type Props = { searchParams: Promise<{ taille?: string }> };

export default async function DevisListPage({ searchParams }: Props) {
  const { taille } = await searchParams;
  const pageSize = parsePageSize(taille);
  const { items, totalCount } = await listDevis(pageSize);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Devis"
        subtitle={`${totalCount} devis`}
        backHref="/dashboard/cabinet/commercial"
      />

      {totalCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-gris-light rounded-xl bg-white/50">
          <FileText className="w-12 h-12 text-gris-light mb-4" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-brun-ancre mb-1">Aucun devis</h2>
          <p className="text-gris-mid text-sm">Créez un devis depuis la fiche d&apos;un prospect.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((d) => (
            <DevisCard
              key={d.id}
              id={d.id}
              number={d.number}
              status={d.status}
              formuleLabelSnapshot={d.formuleLabelSnapshot}
              totalAmountEuros={d.totalAmountEuros}
              prospectStructureName={d.prospectStructureName}
            />
          ))}
          <LoadMoreLink
            basePath={BASE_PATH}
            shownCount={items.length}
            totalCount={totalCount}
            pageSize={pageSize}
          />
        </div>
      )}
    </div>
  );
}
