import Link from "next/link";
import { getDevis } from "@/lib/actions/devis";
import { isDevisDeletable, isDevisEditable } from "@/lib/services/devis-transition-service";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DevisStatusBadge } from "@/components/devis/DevisStatusBadge";
import { DevisStatusActions } from "@/components/devis/DevisStatusActions";
import { DevisSummaryPrintable } from "@/components/devis/DevisSummaryPrintable";
import { DeleteDevisButton } from "@/components/devis/DeleteDevisButton";
import { SendDevisEmailButton } from "@/components/devis/SendDevisEmailButton";
import { Pencil, Download } from "lucide-react";

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
            {isDevisEditable(devis.status) && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/cabinet/commercial/devis/${id}/modifier`}>
                  <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                  Corriger
                </Link>
              </Button>
            )}
            {isDevisDeletable(devis.status) && (
              <DeleteDevisButton devisId={id} number={devis.number} />
            )}
            <Button variant="outline" size="sm" asChild>
              {/* Ouvre la vue imprimable et déclenche « Enregistrer en PDF », sous
                  le nom de fichier de la convention EODA. */}
              <a href={`/imprimer/devis/${id}?auto=1`} target="_blank" rel="noopener noreferrer">
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                Télécharger
              </a>
            </Button>
            {(devis.status === "BROUILLON" || devis.status === "ENVOYE") && (
              <SendDevisEmailButton
                devisId={id}
                number={devis.number}
                structureName={devis.prospect.structureName}
                contactEmail={devis.prospect.contactEmail}
              />
            )}
          </div>
        }
      />

      <DevisStatusActions devisId={id} status={devis.status} />

      {devis.status === "ANNULE" && (
        <p className="text-sm text-gris-mid border-l-4 border-gris-light pl-3">
          Ce devis est annulé. Son numéro reste réservé dans la série annuelle — une série
          commerciale numérotée ne comporte pas de trou — et il n&apos;entre plus dans aucun
          indicateur du pipeline.
        </p>
      )}

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
