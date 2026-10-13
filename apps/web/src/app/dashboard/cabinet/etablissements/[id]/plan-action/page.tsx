import { requireEstablishmentInTenant } from "@/lib/auth/guards";
import { listEstablishmentActionItems } from "@/lib/actions/task";
import { parseActionFilter } from "@/lib/services/action-item-service";
import { structureHref } from "@/lib/design/structure-tabs";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { PacGenerator } from "@/components/tasks/PacGenerator";

export const metadata = { title: "Plan d'action" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filtre?: string | string[] }>;
};

// Onglet « Plan d'action » de la fiche (tranche N5) : toutes les tâches de la
// structure — saisies, issues du PAC — et la génération depuis l'auto-évaluation.
export default async function StructureActionPlanPage({ params, searchParams }: Props) {
  const { id } = await params;
  await requireEstablishmentInTenant(id, "READ");
  const filter = parseActionFilter((await searchParams).filtre);
  const data = await listEstablishmentActionItems(id);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-ink">Plan d&apos;action</h2>
      <PacGenerator establishmentId={id} />
      <TaskBoard establishmentId={id} data={data} filter={filter} basePath={structureHref(id, "plan-action")} now={new Date()} />
    </div>
  );
}
