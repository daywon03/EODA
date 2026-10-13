import { notFound } from "next/navigation";
import { getProspect } from "@/lib/actions/prospect";
import { listCatalogue } from "@/lib/actions/catalogue";
import { computeDefaultValidityDays } from "@/lib/services/devis-validity-service";
import { CommercialHeader } from "@/components/commercial/CommercialHeader";
import { DevisForm } from "@/components/devis/DevisForm";

export const metadata = { title: "Nouveau devis" };

// Repli si aucun réglage de facturation n'a encore été enregistré — acompte de 40 %
// à la commande, validité 30 jours, CGP de l'offre commerciale v10 §06.
const DEFAULT_DEPOSIT_PERCENT = 40;
const DEFAULT_VALIDITY_DAYS = 30;

type Props = { searchParams: Promise<{ prospectId?: string }> };

export default async function NouveauDevisPage({ searchParams }: Props) {
  const { prospectId } = await searchParams;
  if (!prospectId) notFound();

  const [prospect, catalogue] = await Promise.all([getProspect(prospectId), listCatalogue()]);

  const formules = catalogue.formules
    .filter((f) => f.active)
    .map((f) => ({ formule: f.formule, label: f.label, priceEuros: f.priceEuros }));
  const options = catalogue.options
    .filter((o) => o.active)
    .map((o) => ({
      id: o.id,
      code: o.code,
      label: o.label,
      priceEuros: o.priceEuros,
      pricingUnit: o.pricingUnit,
      priceMaxEuros: o.priceMaxEuros,
      minQuantity: o.minQuantity,
    }));

  // Validité proposée selon l'échéance HAS du prospect (décision Q10 bis).
  const validity = computeDefaultValidityDays({
    evaluationTargetDate: prospect.hasEvaluationTargetDate,
    now: new Date(),
    fallbackDays: catalogue.billingSettings?.defaultValidityDays ?? DEFAULT_VALIDITY_DAYS,
  });

  return (
    <div className="max-w-6xl space-y-6">
      <CommercialHeader title="Nouveau devis" description={`Pour ${prospect.structureName}.`} />
      <DevisForm
        prospectId={prospectId}
        structureName={prospect.structureName}
        formules={formules}
        options={options}
        defaultDepositPercent={catalogue.billingSettings?.defaultDepositPercent ?? DEFAULT_DEPOSIT_PERCENT}
        defaultValidityDays={validity.days}
        validityHint={validity.reason}
        envisagedFormule={prospect.envisagedFormule}
      />
    </div>
  );
}
