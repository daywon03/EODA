import Link from "next/link";
import { listProspectBoard } from "@/lib/actions/prospect";
import { parsePageSize } from "@/lib/services/pagination-service";
import { CommercialHeader } from "@/components/commercial/CommercialHeader";
import { LoadMoreLink } from "@/components/layout/LoadMoreLink";
import { ProspectKanbanBoard } from "@/components/prospect/ProspectKanbanBoard";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";

export const metadata = { title: "Prospects · Pipeline commercial · EODA Conseil" };

const BASE_PATH = "/dashboard/cabinet/commercial/prospects";

type Props = { searchParams: Promise<{ taille?: string }> };

// Habillage v2 seulement : le Kanban par étape et la grille de découverte (fiche
// prospect) restent ceux d'avant — ils portent le suivi réel du pipeline.
export default async function ProspectsPage({ searchParams }: Props) {
  const { taille } = await searchParams;
  // `taille` borne le nombre de cartes PAR COLONNE : c'est la dimension qui fait
  // exploser un Kanban, pas le total.
  const perColumn = parsePageSize(taille);
  const { items, totalByStatus, totalCount } = await listProspectBoard(perColumn);

  const newProspect = (
    <Button asChild>
      <Link href={`${BASE_PATH}/nouveau`}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Nouveau prospect
      </Link>
    </Button>
  );

  return (
    <div className="space-y-6">
      <CommercialHeader
        title="Prospects"
        description={`${totalCount} structure${totalCount > 1 ? "s" : ""} suivie${totalCount > 1 ? "s" : ""}, du premier contact à la signature. Le devis se prépare depuis la fiche du prospect.`}
        action={newProspect}
      />

      {totalCount === 0 ? (
        <EmptyState
          icon={Users}
          title="Aucun prospect"
          description="Ajoutez votre premier prospect pour démarrer le suivi."
          action={newProspect}
        />
      ) : (
        <div className="space-y-4">
          <ProspectKanbanBoard prospects={items} totalByStatus={totalByStatus} />
          <LoadMoreLink basePath={BASE_PATH} shownCount={items.length} totalCount={totalCount} pageSize={perColumn} />
        </div>
      )}
    </div>
  );
}
