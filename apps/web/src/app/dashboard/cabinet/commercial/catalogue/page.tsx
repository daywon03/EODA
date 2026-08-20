import { listCatalogue } from "@/lib/actions/catalogue";
import { PageHeader } from "@/components/layout/PageHeader";
import { CatalogueFormuleForm } from "@/components/catalogue/CatalogueFormuleForm";
import { CatalogueOptionForm } from "@/components/catalogue/CatalogueOptionForm";
import { CatalogueActiveToggle } from "@/components/catalogue/CatalogueActiveToggle";
import { BillingSettingsForm } from "@/components/catalogue/BillingSettingsForm";

export const metadata = { title: "Catalogue · Pipeline commercial · EODA Conseil" };

export default async function CataloguePage() {
  const { formules, options, billingSettings } = await listCatalogue();

  return (
    <div className="space-y-8">
      <PageHeader title="Catalogue commercial" backHref="/dashboard/cabinet/commercial" />

      <p className="text-sm text-gris-mid max-w-3xl">
        Retirer une ligne de la vente ne la supprime pas : elle disparaît des nouveaux devis et
        ne peut plus être vendue, mais les devis déjà émis qui la référencent restent lisibles
        à l&apos;identique (libellé et prix y sont figés à la date d&apos;émission).
      </p>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-brun-ancre">Formules</h2>
        <div className="space-y-3">
          {formules.map((f) => (
            <div
              key={f.id}
              className={f.active ? "space-y-2" : "space-y-2 opacity-60"}
            >
              <div className="flex justify-end">
                <CatalogueActiveToggle kind="formule" id={f.id} label={f.label} active={f.active} />
              </div>
              <CatalogueFormuleForm formule={f} />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-brun-ancre">Prestations à la carte</h2>
        <div className="space-y-3">
          {options.map((o) => (
            <div key={o.id} className={o.active ? "space-y-2" : "space-y-2 opacity-60"}>
              <div className="flex justify-end">
                <CatalogueActiveToggle kind="option" id={o.id} label={o.label} active={o.active} />
              </div>
              <CatalogueOptionForm option={o} />
            </div>
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
