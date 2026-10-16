import { countActiveStructuresByFormule, listCatalogue } from "@/lib/actions/catalogue";
import { offerModeLabel, PRICING_UNIT_SHORT_LABELS } from "@/lib/services/devis-recap-service";
import { describeStructuresOnOffer, splitOfferItems } from "@/lib/services/catalogue-view-service";
import { CommercialHeader } from "@/components/commercial/CommercialHeader";
import { CatalogueFormuleForm } from "@/components/catalogue/CatalogueFormuleForm";
import { CatalogueOptionForm } from "@/components/catalogue/CatalogueOptionForm";
import { CatalogueActiveToggle } from "@/components/catalogue/CatalogueActiveToggle";
import { BillingSettingsForm } from "@/components/catalogue/BillingSettingsForm";
import { InlinePriceForm } from "@/components/catalogue/InlinePriceForm";
import { cn } from "@/lib/utils";

export const metadata = { title: "Catalogue · Pipeline commercial" };

const DETAILS_SUMMARY =
  "flex min-h-11 cursor-pointer list-none items-center gap-2 font-bold text-accent-text underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden";

// Maquette v2 « Catalogue » : les offres en cartes (mode, périmètre, contenu, prix
// mensuel modifiable sur place, nombre de structures), les options en lignes (pour
// qui, prix modifiable, unité). L'édition complète d'une ligne reste celle d'avant,
// repliée sous « Modifier ». Retirer une ligne de la vente ne la supprime pas : les
// devis déjà émis gardent leurs libellés et prix figés.
export default async function CataloguePage() {
  const [{ formules, options, billingSettings }, structuresByFormule] = await Promise.all([
    listCatalogue(),
    countActiveStructuresByFormule(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6">
      <CommercialHeader
        title="Catalogue"
        description="Les offres et les options vendues. Les prix saisis ici remplissent les devis et la page des offres du portail client."
      />

      <section aria-label="Offres" className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] items-stretch gap-4">
        {formules.map((f) => {
          const accompanied = offerModeLabel(f.formule) === "Avec EODA";
          const items = splitOfferItems(f.description);
          return (
            <article
              key={f.id}
              aria-labelledby={`offre-${f.id}`}
              className={cn(
                "flex flex-col gap-2.5 rounded-[14px] border bg-card p-5 sm:p-6",
                accompanied ? "border-ink" : "border-line",
                !f.active && "border-dashed"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 id={`offre-${f.id}`} className="text-2xl font-bold text-ink">
                  {f.label}
                </h2>
                <span
                  className={cn(
                    "whitespace-nowrap rounded-md border px-2.5 py-0.5 text-sm font-bold",
                    accompanied ? "border-ink bg-ink-fill text-on-ink" : "border-muted bg-card text-ink2"
                  )}
                >
                  {offerModeLabel(f.formule)}
                </span>
              </div>
              {f.modulesLabel && <p className="text-ink2">{f.modulesLabel}</p>}
              {items.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {items.map((item) => (
                    <li key={item} className="flex gap-2 text-ink">
                      <span aria-hidden="true" className="font-bold text-accent-text">
                        ✓
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              )}
              {!f.active && <p className="font-bold text-ink2">Retirée de la vente</p>}
              <div className="mt-auto flex flex-col gap-2 border-t border-line pt-3">
                <InlinePriceForm
                  kind="formule-monthly"
                  id={f.id}
                  value={f.monthlyPriceEuros}
                  unitLabel="/ mois"
                  accessibleName={`offre ${f.label}`}
                />
                <p className="text-base tabular-nums text-ink2">
                  {describeStructuresOnOffer(structuresByFormule[f.formule] ?? 0)}
                </p>
                <details className="group">
                  <summary className={DETAILS_SUMMARY}>
                    Modifier l&apos;offre<span className="sr-only"> {f.label}</span>
                  </summary>
                  <div className="flex flex-col gap-3 pt-2">
                    <CatalogueFormuleForm formule={f} />
                    <CatalogueActiveToggle kind="formule" id={f.id} label={f.label} active={f.active} />
                  </div>
                </details>
              </div>
            </article>
          );
        })}
      </section>

      <section aria-labelledby="catalogue-options" className="overflow-hidden rounded-[14px] border border-line bg-card">
        <h2 id="catalogue-options" className="bg-soft px-4 py-3 font-bold text-ink sm:px-5">
          Options
        </h2>
        <ul>
          {options.map((o) => (
            <li key={o.id} className={cn("flex flex-col gap-2 border-t border-line px-4 py-3 sm:px-5", !o.active && "bg-soft")}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="min-w-[14rem] flex-[2_1_14rem] font-bold text-ink">
                  {o.label}
                  {!o.active && <span className="font-normal text-ink2"> · retirée de la vente</span>}
                </span>
                <span className="min-w-[10rem] flex-[1_1_10rem] text-ink2">{o.audienceLabel ?? "—"}</span>
                <InlinePriceForm
                  kind="option"
                  id={o.id}
                  value={o.priceEuros}
                  unitLabel={PRICING_UNIT_SHORT_LABELS[o.pricingUnit]}
                  accessibleName={o.label}
                  label="Prix à partir de"
                />
              </div>
              <details>
                <summary className={DETAILS_SUMMARY}>
                  Modifier<span className="sr-only"> l&apos;option {o.label}</span>
                </summary>
                <div className="flex flex-col gap-2">
                  <CatalogueOptionForm option={o} />
                  <CatalogueActiveToggle kind="option" id={o.id} label={o.label} active={o.active} />
                </div>
              </details>
            </li>
          ))}
          <li className="border-t border-line px-4 py-3 sm:px-5">
            <details>
              <summary className={DETAILS_SUMMARY}>+ Ajouter une option</summary>
              <CatalogueOptionForm />
            </details>
          </li>
        </ul>
      </section>

      <section aria-labelledby="catalogue-facturation" className="flex flex-col gap-3">
        <h2 id="catalogue-facturation" className="text-xl font-bold text-ink">
          Réglages de facturation
        </h2>
        <BillingSettingsForm settings={billingSettings} />
      </section>
    </div>
  );
}
