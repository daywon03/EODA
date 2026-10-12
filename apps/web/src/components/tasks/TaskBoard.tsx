import type { EstablishmentActionItems } from "@/lib/actions/task";
import {
  ACTION_FILTERS,
  ACTION_FILTER_LABELS,
  countActionFilters,
  matchesActionFilter,
  sortActionItems,
  type ActionFilter,
} from "@/lib/services/action-item-service";
import { TabsNav } from "@/components/ui/tabs-nav";
import { TaskRow } from "./TaskRow";
import { TaskCreateForm } from "./TaskCreateForm";

type Props = {
  establishmentId: string;
  data: EstablishmentActionItems;
  filter: ActionFilter;
  basePath: string;
  now: Date;
};

// Liste filtrable des tâches d'une structure — la même pour le cabinet (onglet
// « Plan d'action ») et la structure (page « Tâches »). Composant serveur : les
// filtres sont des liens, les gestes des composants clients.
export function TaskBoard({ establishmentId, data, filter, basePath, now }: Props) {
  // Côté client, « Confiées à EODA » n'a pas de sens : il ne voit que ses tâches.
  const filters = ACTION_FILTERS.filter((f) => !(data.isClient && f === "EODA"));
  const counts = countActionFilters(data.items, data.viewerId, now);
  const items = sortActionItems(
    data.items.filter((i) => matchesActionFilter(i, filter, data.viewerId, now)),
    now
  );

  return (
    <div className="space-y-5">
      {data.canWrite && (
        <TaskCreateForm
          establishmentId={establishmentId}
          isClient={data.isClient}
          cabinetPeople={data.cabinetPeople}
          structurePeople={data.structurePeople}
        />
      )}
      <TabsNav
        label="Filtrer les tâches"
        activeId={filter}
        tabs={filters.map((f) => ({
          id: f,
          label: ACTION_FILTER_LABELS[f],
          count: counts[f],
          href: f === "EN_COURS" ? basePath : `${basePath}?filtre=${f}`,
        }))}
      />
      {items.length === 0 ? (
        <p className="py-4 text-ink2">Aucune tâche dans cette liste.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-card">
          {items.map((item) => (
            <TaskRow
              key={item.id}
              establishmentId={establishmentId}
              item={item}
              viewerId={data.viewerId}
              isClient={data.isClient}
              canWrite={data.canWrite}
              cabinetPeople={data.cabinetPeople}
              structurePeople={data.structurePeople}
              nowIso={now.toISOString()}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
