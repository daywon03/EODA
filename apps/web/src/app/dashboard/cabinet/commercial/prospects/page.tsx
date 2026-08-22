import Link from "next/link";
import { listProspectBoard } from "@/lib/actions/prospect";
import { parsePageSize } from "@/lib/services/pagination-service";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoadMoreLink } from "@/components/layout/LoadMoreLink";
import { ProspectKanbanBoard } from "@/components/prospect/ProspectKanbanBoard";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";

export const metadata = { title: "Prospects · Pipeline commercial · EODA Conseil" };

const BASE_PATH = "/dashboard/cabinet/commercial/prospects";

type Props = { searchParams: Promise<{ taille?: string }> };

export default async function ProspectsPage({ searchParams }: Props) {
  const { taille } = await searchParams;
  // `taille` borne le nombre de cartes PAR COLONNE : c'est la dimension qui fait
  // exploser un Kanban, pas le total.
  const perColumn = parsePageSize(taille);
  const { items, totalByStatus, totalCount } = await listProspectBoard(perColumn);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prospects"
        subtitle={`${totalCount} prospect${totalCount > 1 ? "s" : ""} suivi${totalCount > 1 ? "s" : ""}`}
        backHref="/dashboard/cabinet/commercial"
        action={
          <Button asChild>
            <Link href="/dashboard/cabinet/commercial/prospects/nouveau">
              <Plus className="w-4 h-4" aria-hidden="true" />
              Nouveau prospect
            </Link>
          </Button>
        }
      />

      {totalCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-gris-light rounded-xl bg-white/50">
          <Users className="w-12 h-12 text-gris-light mb-4" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-brun-ancre mb-1">Aucun prospect</h2>
          <p className="text-gris-mid text-sm mb-6">Ajoutez votre premier prospect pour démarrer le suivi.</p>
          <Button asChild>
            <Link href="/dashboard/cabinet/commercial/prospects/nouveau">
              <Plus className="w-4 h-4" aria-hidden="true" />
              Nouveau prospect
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <ProspectKanbanBoard prospects={items} totalByStatus={totalByStatus} />
          <LoadMoreLink
            basePath={BASE_PATH}
            shownCount={items.length}
            totalCount={totalCount}
            pageSize={perColumn}
          />
        </div>
      )}
    </div>
  );
}
