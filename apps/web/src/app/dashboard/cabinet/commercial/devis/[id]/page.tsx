import { getDevis } from "@/lib/actions/devis";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DevisStatusBadge } from "@/components/devis/DevisStatusBadge";
import { DevisStatusActions } from "@/components/devis/DevisStatusActions";
import { DevisSummaryPrintable } from "@/components/devis/DevisSummaryPrintable";
import { Printer } from "lucide-react";

type Props = { params: Promise<{ id: string }> };

export default async function DevisDetailPage({ params }: Props) {
  const { id } = await params;
  const devis = await getDevis(id);

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title={devis.number}
        subtitle={devis.prospect.structureName}
        backHref={`/dashboard/cabinet/commercial/prospects/${devis.prospectId}`}
        action={
          <div className="flex items-center gap-2">
            <DevisStatusBadge status={devis.status} />
            <Button variant="outline" size="sm" asChild>
              <a href={`/imprimer/devis/${id}`} target="_blank" rel="noopener noreferrer">
                <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                Imprimer
              </a>
            </Button>
          </div>
        }
      />

      <DevisStatusActions devisId={id} status={devis.status} />

      <Card>
        <CardContent className="pt-6">
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
        </CardContent>
      </Card>
    </div>
  );
}
