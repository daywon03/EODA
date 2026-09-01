import { getDiscoveryAnswers } from "@/lib/actions/discovery";
import { discoveryGrid } from "@/lib/services/discovery-grid-service";
import { DiscoveryGridForm } from "@/components/prospect/DiscoveryGridForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

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
            Ce contenu est un gabarit interne provisoire, en attente de la grille de référence
            d&apos;EODA. Les réponses déjà saisies seront conservées lors de sa mise en place.
          </p>
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
