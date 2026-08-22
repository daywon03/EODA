import { notFound } from "next/navigation";
import { getDevis } from "@/lib/actions/devis";
import { listCatalogue } from "@/lib/actions/catalogue";
import { isDevisEditable } from "@/lib/services/devis-transition-service";
import { PageHeader } from "@/components/layout/PageHeader";
import { DevisForm } from "@/components/devis/DevisForm";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Corriger un devis · EODA Conseil" };

// Repli si aucun réglage de facturation n'est enregistré — CGP v10 §06.
const DEFAULT_DEPOSIT_PERCENT = 40;

type Props = { params: Promise<{ id: string }> };

export default async function ModifierDevisPage({ params }: Props) {
  const { id } = await params;
  // getDevis vérifie l'appartenance au tenant et fait notFound() sinon.
  const [devis, catalogue] = await Promise.all([getDevis(id), listCatalogue()]);

  // Un devis émis ne se corrige pas : notFound() plutôt que redirect(), la route
  // n'existe pas pour cet objet. `updateDevis` refuse de toute façon côté serveur.
  if (!isDevisEditable(devis.status)) notFound();

  const activeFormules = catalogue.formules.filter((f) => f.active);
  const activeOptions = catalogue.options.filter((o) => o.active);

  const retiredLines = [
    ...(activeFormules.some((f) => f.id === devis.catalogueFormuleId)
      ? []
      : [devis.formuleLabelSnapshot]),
    ...devis.options
      .filter((o) => !activeOptions.some((a) => a.id === o.catalogueOptionId))
      .map((o) => o.labelSnapshot),
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title={`Corriger ${devis.number}`}
        subtitle={`${devis.prospect.structureName} · brouillon`}
        backHref={`/dashboard/cabinet/commercial/devis/${id}`}
      />
      <Card>
        <CardContent className="pt-6">
          <DevisForm
            prospectId={devis.prospectId}
            formules={activeFormules.map((f) => ({
              formule: f.formule,
              label: f.label,
              priceEuros: f.priceEuros,
            }))}
            options={activeOptions.map((o) => ({
              id: o.id,
              label: o.label,
              priceEuros: o.priceEuros,
              pricingUnit: o.pricingUnit,
              priceMaxEuros: o.priceMaxEuros,
              minQuantity: o.minQuantity,
            }))}
            defaultDepositPercent={
              catalogue.billingSettings?.defaultDepositPercent ?? DEFAULT_DEPOSIT_PERCENT
            }
            defaultValidityDays={catalogue.billingSettings?.defaultValidityDays ?? 30}
            draft={{
              id: devis.id,
              formule: devis.catalogueFormule.formule,
              optionIds: devis.options.map((o) => o.catalogueOptionId),
              depositPercent: devis.depositPercent,
              installmentCount: devis.installmentCount,
              validityDays: devis.validityDays,
            }}
            retiredLines={retiredLines}
          />
        </CardContent>
      </Card>
    </div>
  );
}
