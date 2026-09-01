import { getDiscoveryAnswers } from "@/lib/actions/discovery";
import { discoveryGrid } from "@/lib/services/discovery-grid-service";
import { DiscoveryGridForm } from "@/components/prospect/DiscoveryGridForm";
import { StructureIdentityForm } from "@/components/prospect/StructureIdentityForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Réunion de découverte · EODA Conseil" };

type Props = { params: Promise<{ id: string }> };

// ─────────────────────────────────────────────────────────────────────────────
// RÉUNION DE DÉCOUVERTE (R1) — la grille d'entretien, première étape du parcours.
//
// Le bouton « Préparer la réunion de découverte » de la fiche prospect ouvrait
// directement l'évaluation des besoins, donc le choix de l'offre : on chiffrait avant
// d'avoir écouté. La découverte a désormais son écran, et l'évaluation des besoins
// vient après.
//
// `getDiscoveryAnswers` passe par requireCabinetAdminSession et filtre par tenant :
// un identifiant hors périmètre donne notFound(), jamais une redirection.
//
// Réservé au cabinet : l'ouverture de cette grille au client n'est pas tranchée.
// ─────────────────────────────────────────────────────────────────────────────
export default async function DecouvertePage({ params }: Props) {
  const { id } = await params;
  const discovery = await getDiscoveryAnswers(id);
  const grid = discoveryGrid();

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Réunion de découverte"
        subtitle={discovery.structureName}
        backHref={`/dashboard/cabinet/commercial/prospects/${id}`}
      />

      <Card>
        <CardContent className="pt-6 text-sm text-gris-mid">
          <p>
            Grille d&apos;entretien à remplir pendant l&apos;appel : elle sert à écouter avant
            de chiffrer. Aucune réponse n&apos;est obligatoire, et l&apos;enregistrement peut
            se faire en plusieurs fois.
          </p>
          <p className="mt-2">
            Questions reprises du gabarit EODA du 30 août 2026. Le statut juridique, le type
            de SAD et l&apos;échéance HAS ne s&apos;y trouvent pas : ils se saisissent
            ci-dessus, et alimentent directement le devis et le périmètre de critères.
          </p>
        </CardContent>
      </Card>

      {/* L'identité administrative AVANT la grille : elle se demande en début d'appel
          (« vous êtes bien une association ? quel est votre FINESS ? »), et c'est
          l'information qui manquait ensuite au devis et au contrat. Enregistrable
          seule, sans quitter l'écran ni perdre les réponses de grille en cours. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identité de la structure</CardTitle>
        </CardHeader>
        <CardContent>
          <StructureIdentityForm
            prospectId={id}
            structureType={discovery.structureType}
            finessNumber={discovery.finessNumber}
            siretNumber={discovery.siretNumber}
            address={discovery.address}
            establishmentType={discovery.establishmentType}
            hasEvaluationTargetDate={discovery.hasEvaluationTargetDate}
          />
        </CardContent>
      </Card>

      <DiscoveryGridForm
        prospectId={id}
        grid={grid}
        answers={discovery.answers}
        updatedAt={discovery.updatedAt}
      />
    </div>
  );
}
