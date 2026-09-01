import { getSignatureContext } from "@/lib/actions/conversion";
import { isDevisSignable } from "@/lib/services/conversion-service";
import { formatEuros } from "@/lib/services/price-format-service";
import { PageHeader } from "@/components/layout/PageHeader";
import { SignatureConversionForm } from "@/components/devis/SignatureConversionForm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata = { title: "Signature du devis · EODA Conseil" };

type Props = { params: Promise<{ id: string }> };

// ─────────────────────────────────────────────────────────────────────────────
// SIGNATURE — le moment où le devis devient un client
//
// « En cliquant ça, ça génère dans le portail client un profil » (§12.4). L'écran
// montre d'abord ce que le clic va produire, puis demande la seule chose qui ne se
// déduit d'aucune donnée déjà saisie : le type de SAD.
// ─────────────────────────────────────────────────────────────────────────────
export default async function SignatureDevisPage({ params }: Props) {
  const { id } = await params;
  // Lecture cloisonnée par tenant : un devis hors périmètre donne notFound().
  const context = await getSignatureContext(id);

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Signature du devis"
        subtitle={`${context.number} · ${context.structureName}`}
        backHref={`/dashboard/cabinet/commercial/devis/${id}`}
      />

      <Card>
        <CardContent className="pt-6 space-y-3 text-sm">
          <p className="text-xs text-gris-mid uppercase tracking-wide">
            Ce que la signature va créer
          </p>
          <ul className="space-y-1.5 text-brun-ancre">
            <li>
              <span className="text-gris-mid">Fiche client : </span>
              {context.existingEstablishmentId
                ? "déjà existante, conservée telle quelle"
                : context.structureName}
            </li>
            <li>
              <span className="text-gris-mid">Offre ouverte au client : </span>
              {context.formuleLabel}
            </li>
            <li>
              <span className="text-gris-mid">Options souscrites : </span>
              {context.optionLabels.length > 0 ? context.optionLabels.join(", ") : "aucune"}
            </li>
            <li>
              <span className="text-gris-mid">Montant signé : </span>
              {formatEuros(context.totalAmountEuros)}
            </li>
          </ul>
          <p className="text-xs text-gris-mid border-t border-gris-light pt-3">
            Le portail client n&apos;affichera que les checklists documentaires, les tâches
            et le périmètre de critères couverts par cette offre.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isDevisSignable(context.status) ? (
            <SignatureConversionForm
              devisId={id}
              structureName={context.structureName}
              contactEmail={context.contactEmail}
              contactName={context.contactName}
              existingEstablishmentId={context.existingEstablishmentId}
              defaults={context.defaults}
            />
          ) : context.status === "SIGNE" && context.existingEstablishmentId ? (
            // Conversion déjà faite. Observé en pilotant l'application : juste après
            // une signature réussie, cet écran affichait « ce devis n'est pas signable ».
            // Sandrine venait de signer et lisait un refus — elle en aurait conclu à un
            // échec et aurait recommencé. On confirme, et on donne la suite.
            <div className="space-y-4">
              <p className="text-sm font-semibold text-brun-ancre">
                Signature enregistrée — la fiche client et la mission existent.
              </p>
              <p className="text-sm text-gris-mid">
                Prochaine étape : inviter l&apos;interlocuteur du client depuis sa fiche. Il
                recevra un mot de passe temporaire qu&apos;il devra changer à sa première
                connexion.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link href={`/dashboard/cabinet/etablissements/${context.existingEstablishmentId}`}>
                    Ouvrir la fiche client
                  </Link>
                </Button>
                {/* Le contrat reste accessible après coup : on revient sur cet écran
                    précisément quand on a besoin du document, pas de la conversion. */}
                <Button variant="outline" asChild>
                  <Link
                    href={`/imprimer/contrat/${context.existingEstablishmentId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Éditer le contrat d&apos;accompagnement
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`/dashboard/cabinet/commercial/devis/${id}`}>
                    Revenir au devis
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-brun-ancre">
                Ce devis n&apos;est pas signable : seul un devis au statut Envoyé peut
                l&apos;être.
              </p>
              <Button variant="outline" asChild>
                <Link href={`/dashboard/cabinet/commercial/devis/${id}`}>
                  Revenir au devis
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
