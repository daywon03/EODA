import { notFound } from "next/navigation";
import { getDevis } from "@/lib/actions/devis-read";
import { listCatalogue } from "@/lib/actions/catalogue";
import { isDevisEditable } from "@/lib/services/devis-transition-service";
import { PageHeader } from "@/components/layout/PageHeader";
import { DevisForm } from "@/components/devis/DevisForm";
import { toDevisCatalogueChoices } from "@/lib/services/devis-catalogue-choices";

export const metadata = { title: "Corriger un devis" };

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
  const choices = toDevisCatalogueChoices(catalogue);

  const retiredLines = [
    ...(devis.catalogueFormuleId === null || activeFormules.some((f) => f.id === devis.catalogueFormuleId)
      ? []
      : devis.formuleLabelSnapshot === null
        ? []
        : [devis.formuleLabelSnapshot]),
    ...devis.options
      .filter((o) => !activeOptions.some((a) => a.id === o.catalogueOptionId))
      .map((o) => o.labelSnapshot),
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        title={`Corriger ${devis.number}`}
        subtitle={`${devis.prospect.structureName} · brouillon`}
        backHref={`/dashboard/cabinet/commercial/devis/${id}`}
      />
          <DevisForm
            prospectId={devis.prospectId}
            structureName={devis.prospect.structureName}
            formules={choices.formules}
            options={choices.options}
            defaultDepositPercent={
              catalogue.billingSettings?.defaultDepositPercent ?? DEFAULT_DEPOSIT_PERCENT
            }
            defaultValidityDays={catalogue.billingSettings?.defaultValidityDays ?? 30}
            draft={{
              id: devis.id,
              number: devis.number,
              commitmentMonths: devis.commitmentMonths,
              clientNote: devis.clientNote,
              formule: devis.catalogueFormule?.formule ?? null,
              optionIds: devis.options.map((o) => o.catalogueOptionId),
              depositPercent: devis.depositPercent,
              installmentCount: devis.installmentCount,
              validityDays: devis.validityDays,
            }}
            retiredLines={retiredLines}
          />
    </div>
  );
}
