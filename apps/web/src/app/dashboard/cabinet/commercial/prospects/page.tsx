import Link from "next/link";
import { listProspects } from "@/lib/actions/prospect";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProspectKanbanBoard } from "@/components/prospect/ProspectKanbanBoard";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";

export const metadata = { title: "Prospects · Pipeline commercial · EODA Conseil" };

export default async function ProspectsPage() {
  const prospects = await listProspects();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prospects"
        subtitle={`${prospects.length} prospect${prospects.length > 1 ? "s" : ""} suivi${prospects.length > 1 ? "s" : ""}`}
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

      {prospects.length === 0 ? (
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
        <ProspectKanbanBoard prospects={prospects} />
      )}
    </div>
  );
}
