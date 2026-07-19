import { notFound } from "next/navigation";
import { getProspect } from "@/lib/actions/prospect";
import { listCatalogue } from "@/lib/actions/catalogue";
import { PageHeader } from "@/components/layout/PageHeader";
import { DevisForm } from "@/components/devis/DevisForm";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Nouveau devis · EODA Conseil" };

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
    .map((o) => ({ id: o.id, label: o.label, priceEuros: o.priceEuros }));

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Nouveau devis"
        subtitle={prospect.structureName}
        backHref={`/dashboard/cabinet/commercial/prospects/${prospectId}`}
      />
      <Card>
        <CardContent className="pt-6">
          <DevisForm
            prospectId={prospectId}
            formules={formules}
            options={options}
            defaultDepositPercent={catalogue.billingSettings?.defaultDepositPercent ?? 30}
            defaultValidityDays={catalogue.billingSettings?.defaultValidityDays ?? 30}
          />
        </CardContent>
      </Card>
    </div>
  );
}
