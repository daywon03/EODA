import { getDevis } from "@/lib/actions/devis";
import { DevisSummaryPrintable } from "@/components/devis/DevisSummaryPrintable";
import { PrintButton } from "@/components/devis/PrintButton";
import { buildDevisFileName } from "@/lib/services/devis-sharing-service";

type Props = {
  params: Promise<{ id: string }>;
  // `?auto=1` — arrivée depuis le bouton « Télécharger » de la fiche devis : la
  // boîte d'impression s'ouvre seule, il n'y a rien d'autre à faire sur cette page.
  searchParams: Promise<{ auto?: string }>;
};

export default async function ImprimerDevisPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { auto } = await searchParams;
  const devis = await getDevis(id);

  // Nom de fichier conforme à la convention EODA, calculé au même endroit que celui
  // annoncé dans le brouillon d'e-mail : les deux doivent désigner le même document.
  const fileName = buildDevisFileName({
    number: devis.number,
    structureName: devis.prospect.structureName,
    issuedOn: devis.createdAt,
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-end print:hidden">
        <PrintButton fileName={fileName} auto={auto === "1"} />
      </div>
      <DevisSummaryPrintable
        number={devis.number}
        createdAt={devis.createdAt}
        validUntil={devis.validUntil}
        prospectStructureName={devis.prospect.structureName}
        formuleLabelSnapshot={devis.formuleLabelSnapshot}
        formulePriceSnapshotEuros={devis.formulePriceSnapshotEuros}
        options={devis.options}
        totalAmountEuros={devis.totalAmountEuros}
        depositPercent={devis.depositPercent}
        depositAmountEuros={devis.depositAmountEuros}
        balanceAmountEuros={devis.balanceAmountEuros}
        installmentCount={devis.installmentCount}
        installmentAmountEuros={devis.installmentAmountEuros}
      />
    </div>
  );
}
