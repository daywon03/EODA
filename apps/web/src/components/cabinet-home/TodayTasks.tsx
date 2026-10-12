import Link from "next/link";
import type { TodayTask } from "@/lib/actions/task";
import { actionPill } from "@/lib/services/action-item-service";
import { formatDate } from "@/lib/services/date-format-service";
import { structureHref } from "@/lib/design/structure-tabs";
import { StatusPill } from "@/components/ui/status-pill";

// « Mes tâches du jour » (accueil cabinet, N5) : les tâches confiées à la personne
// connectée, échues aujourd'hui ou en retard. Dérivé (selectTodayTasks).
export function TodayTasks({ tasks, now }: { tasks: readonly TodayTask[]; now: Date }) {
  return (
    <section aria-labelledby="today-tasks" className="space-y-3">
      <h2 id="today-tasks" className="text-xl font-bold text-ink">
        Mes tâches du jour
      </h2>
      {tasks.length === 0 ? (
        <p className="text-ink2">Aucune tâche à échéance aujourd&apos;hui ni en retard.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-card">
          {tasks.map((task) => (
            <li key={task.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <Link href={structureHref(task.establishmentId, "plan-action")} className="font-bold text-ink hover:underline">
                  {task.title}
                </Link>
                <span className="block text-sm text-ink2">
                  {task.establishmentName}
                  {task.dueOn && ` · échéance ${formatDate(task.dueOn)}`}
                </span>
              </span>
              <StatusPill pill={actionPill(task, now)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
