import { requireClientEstablishment } from "@/lib/auth/guards";
import { listEstablishmentActionItems } from "@/lib/actions/task";
import { parseActionFilter } from "@/lib/services/action-item-service";
import { CLIENT_TASKS_PATH } from "@/lib/design/client-navigation";
import { TaskBoard } from "@/components/tasks/TaskBoard";

export const metadata = { title: "Tâches" };

type Props = { searchParams: Promise<{ filtre?: string | string[] }> };

// « Tâches » côté structure (tranche N5) : les tâches confiées à la structure ou à
// la personne connectée. L'établissement vient du lien du compte, jamais de
// l'adresse ; un accès révoqué ne montre rien.
export default async function ClientTasksPage({ searchParams }: Props) {
  const { establishment } = await requireClientEstablishment();
  if (!establishment) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold text-ink">Tâches</h1>
        <p className="text-ink2">Aucune structure n&apos;est rattachée à votre compte.</p>
      </div>
    );
  }
  const filter = parseActionFilter((await searchParams).filtre);
  const data = await listEstablishmentActionItems(establishment.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Tâches</h1>
        <p className="text-ink2">Ce qu&apos;il reste à faire dans votre structure. Cochez une tâche quand elle est faite.</p>
      </div>
      <TaskBoard
        establishmentId={establishment.id}
        data={data}
        filter={filter === "EODA" ? "EN_COURS" : filter}
        basePath={CLIENT_TASKS_PATH}
        now={new Date()}
      />
    </div>
  );
}
