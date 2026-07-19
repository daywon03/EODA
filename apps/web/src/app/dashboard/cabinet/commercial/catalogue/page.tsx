import { listCatalogue } from "@/lib/actions/catalogue";
import { PageHeader } from "@/components/layout/PageHeader";
import { CatalogueFormuleForm } from "@/components/catalogue/CatalogueFormuleForm";
import { CatalogueOptionForm } from "@/components/catalogue/CatalogueOptionForm";
import { BillingSettingsForm } from "@/components/catalogue/BillingSettingsForm";

export const metadata = { title: "Catalogue · Pipeline commercial · EODA Conseil" };

export default async function CataloguePage() {
  const { formules, options, billingSettings } = await listCatalogue();

  return (
    <div className="space-y-8">
      <PageHeader title="Catalogue commercial" backHref="/dashboard/cabinet/commercial" />

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-brun-ancre">Formules</h2>
        <div className="space-y-3">
          {formules.map((f) => (
            <CatalogueFormuleForm key={f.id} formule={f} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-brun-ancre">Prestations à la carte</h2>
        <div className="space-y-3">
          {options.map((o) => (
            <CatalogueOptionForm key={o.id} option={o} />
          ))}
          <div className="border-t border-gris-light pt-3">
            <p className="text-xs text-gris-mid uppercase tracking-wide mb-2">Ajouter une prestation</p>
            <CatalogueOptionForm />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-brun-ancre">Réglages de facturation</h2>
        <BillingSettingsForm settings={billingSettings} />
      </section>
    </div>
  );
}
