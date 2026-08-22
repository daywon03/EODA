import { getDevis } from "@/lib/actions/devis";
import { DevisSummaryPrintable } from "@/components/devis/DevisSummaryPrintable";
import { PrintButton } from "@/components/devis/PrintButton";

type Props = { params: Promise<{ id: string }> };

export default async function ImprimerDevisPage({ params }: Props) {
  const { id } = await params;
  const devis = await getDevis(id);

  return (
    <div className="space-y-6">
      <div className="flex justify-end print:hidden">
        <PrintButton />
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
