import { listCatalogue } from "@/lib/actions/catalogue";
import { CommercialHeader } from "@/components/commercial/CommercialHeader";
import { CatalogueFormuleForm } from "@/components/catalogue/CatalogueFormuleForm";
import { CatalogueOptionForm } from "@/components/catalogue/CatalogueOptionForm";
import { CatalogueActiveToggle } from "@/components/catalogue/CatalogueActiveToggle";
import { BillingSettingsForm } from "@/components/catalogue/BillingSettingsForm";
import { cn } from "@/lib/utils";

export const metadata = { title: "Catalogue · Pipeline commercial" };

// Maquette v2 « Catalogue » : les offres en cartes, les options en lignes. L'édition
// reste celle d'avant (un formulaire par ligne, upsertCatalogue*) — seule la mise en
// page change. Les prix s'affichent « à partir de » tant qu'ils ne sont pas fixés.
export default async function CataloguePage() {
  const { formules, options, billingSettings } = await listCatalogue();

  return (
    <div className="space-y-8">
      <CommercialHeader
        title="Catalogue"
        description="Les offres et les options vendues. Les prix saisis ici remplissent les devis et la page des offres du portail client."
      />

      <p className="max-w-3xl text-ink2">
        Retirer une ligne de la vente ne la supprime pas : elle disparaît des nouveaux devis et ne
        peut plus être vendue, mais les devis déjà émis qui la référencent restent lisibles à
        l&apos;identique (libellé et prix y sont figés à la date d&apos;émission).
      </p>

      <section aria-labelledby="catalogue-offres" className="space-y-3">
        <h2 id="catalogue-offres" className="text-xl font-bold text-ink">
          Offres
        </h2>
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {formules.map((f) => (
            <li
              key={f.id}
              className={cn(
                "flex flex-col gap-3 rounded-xl border bg-card p-5",
                f.active ? "border-line" : "border-dashed border-muted"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="text-xl font-bold text-ink">{f.label}</h3>
                <CatalogueActiveToggle kind="formule" id={f.id} label={f.label} active={f.active} />
              </div>
              <CatalogueFormuleForm formule={f} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="catalogue-options" className="overflow-hidden rounded-xl border border-line bg-card">
        <h2 id="catalogue-options" className="bg-soft px-5 py-3 text-xl font-bold text-ink">
          Options et prestations à la carte
        </h2>
        <ul className="divide-y divide-line">
          {options.map((o) => (
            <li key={o.id} className={cn(!o.active && "bg-soft")}>
              <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
                <span className="font-bold text-ink">{o.label}</span>
                <CatalogueActiveToggle kind="option" id={o.id} label={o.label} active={o.active} />
              </div>
              <CatalogueOptionForm option={o} />
            </li>
          ))}
          <li>
            <h3 className="px-5 pt-4 font-bold text-ink">Ajouter une prestation</h3>
            <CatalogueOptionForm />
          </li>
        </ul>
      </section>

      <section aria-labelledby="catalogue-facturation" className="space-y-3">
        <h2 id="catalogue-facturation" className="text-xl font-bold text-ink">
          Réglages de facturation
        </h2>
        <BillingSettingsForm settings={billingSettings} />
      </section>
    </div>
  );
}
