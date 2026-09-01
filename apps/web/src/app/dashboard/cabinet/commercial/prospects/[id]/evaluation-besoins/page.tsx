import { getProspect } from "@/lib/actions/prospect";
import { listCatalogue } from "@/lib/actions/catalogue";
import { PageHeader } from "@/components/layout/PageHeader";
import { DevisForm } from "@/components/devis/DevisForm";
import { formatContactIdentity } from "@/lib/services/prospect-contact-service";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone } from "lucide-react";

export const metadata = { title: "Évaluation des besoins · EODA Conseil" };

// Repli si aucun réglage de facturation n'a encore été enregistré — acompte de 40 %
// à la commande, CGP de l'offre commerciale v10 §06.
const DEFAULT_DEPOSIT_PERCENT = 40;

type Props = { params: Promise<{ id: string }> };

// ─────────────────────────────────────────────────────────────────────────────
// RÉUNION D'ÉVALUATION DES BESOINS — écran utilisable EN DIRECT pendant l'appel
//
// §12.3 : « C'est Sandrine qui coche les options pendant la réunion d'évaluation
// des besoins, ce qui génère le devis » — le client ne s'auto-configure jamais.
// D'où les partis pris : une seule page (pas d'assistant multi-étapes, on parle en
// même temps), les coordonnées du prospect sous les yeux, le contenu de chaque
// offre lisible sans changer d'écran, le total qui suit en bas, un seul envoi.
//
// Le formulaire est celui du devis (`DevisForm`, variante `assessment`), pas un
// second : deux formulaires de devis, ce sont deux règles de calcul à corriger, et
// une seule qui le sera (D1).
// ─────────────────────────────────────────────────────────────────────────────
export default async function EvaluationBesoinsPage({ params }: Props) {
  const { id } = await params;
  // `getProspect` passe par requireCabinetAdminSession et filtre par tenant :
  // un identifiant hors périmètre donne notFound(), jamais une redirection.
  const [prospect, catalogue] = await Promise.all([getProspect(id), listCatalogue()]);

  const formules = catalogue.formules
    .filter((f) => f.active)
    .map((f) => ({
      formule: f.formule,
      label: f.label,
      priceEuros: f.priceEuros,
      modulesLabel: f.modulesLabel,
      description: f.description,
    }));
  const options = catalogue.options
    .filter((o) => o.active)
    .map((o) => ({
      id: o.id,
      label: o.label,
      priceEuros: o.priceEuros,
      pricingUnit: o.pricingUnit,
      priceMaxEuros: o.priceMaxEuros,
      minQuantity: o.minQuantity,
    }));

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Évaluation des besoins"
        subtitle={prospect.structureName}
        backHref={`/dashboard/cabinet/commercial/prospects/${id}`}
      />

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-brun-ancre">
            {/* Même composition qu'ailleurs (civilité, nom, fonction) : la règle
                vit dans prospect-contact-service, pas dans chaque écran. */}
            {formatContactIdentity(prospect) && <span>{formatContactIdentity(prospect)}</span>}
            {prospect.contactPhone && (
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-gris-mid" aria-hidden="true" />
                {prospect.contactPhone}
              </span>
            )}
            {prospect.contactEmail && (
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-gris-mid" aria-hidden="true" />
                {prospect.contactEmail}
              </span>
            )}
          </div>
          <p className="text-xs text-gris-mid mt-3">
            Cochez l&apos;offre et les prestations retenues pendant l&apos;appel : l&apos;envoi
            crée le devis. La fiche client et son profil, eux, ne sont créés qu&apos;à la
            signature.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <DevisForm
            prospectId={id}
            variant="assessment"
            formules={formules}
            options={options}
            defaultNeedsAssessmentNotes={prospect.needsAssessmentNotes}
            defaultDepositPercent={
              catalogue.billingSettings?.defaultDepositPercent ?? DEFAULT_DEPOSIT_PERCENT
            }
            defaultValidityDays={catalogue.billingSettings?.defaultValidityDays ?? 30}
          />
        </CardContent>
      </Card>
    </div>
  );
}
