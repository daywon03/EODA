"use client";

import { useState, useTransition } from "react";
import { reassignActionItem, setActionItemDone } from "@/lib/actions/task";
import type { ActionItemRow, ActionPerson } from "@/lib/actions/task";
import { actionPill, canActorActOnItem, describeOwner } from "@/lib/services/action-item-service";
import { formatDate } from "@/lib/services/date-format-service";
import { StatusPill } from "@/components/ui/status-pill";
import { Select } from "@/components/ui/select";

type Props = {
  establishmentId: string;
  item: ActionItemRow;
  viewerId: string;
  isClient: boolean;
  canWrite: boolean;
  cabinetPeople: readonly ActionPerson[];
  structurePeople: readonly ActionPerson[];
  // Date du rendu serveur : « en retard » se calcule au même instant pour tous.
  nowIso: string;
};

const SOURCE_LABELS: Record<ActionItemRow["source"], string> = {
  MANUEL: "Saisie",
  DOCUMENT: "Document",
  DIAGNOSTIC: "Diagnostic",
  PAC: "Plan d'action",
  ENQUETE: "Enquête",
  QUIZ: "Quiz",
};

// Valeur du sélecteur de responsable : « CABINET: » = EODA sans personne, « CABINET:id »…
function ownerValue(item: Pick<ActionItemRow, "ownerKind" | "ownerUserId">): string {
  return `${item.ownerKind}:${item.ownerUserId ?? ""}`;
}

export function TaskRow({ establishmentId, item, viewerId, isClient, canWrite, cabinetPeople, structurePeople, nowIso }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const now = new Date(nowIso);
  const actor = isClient ? ({ side: "CLIENT", userId: viewerId } as const) : ({ side: "CABINET" } as const);
  const canAct = canWrite && canActorActOnItem(actor, item);
  const checkboxId = `task-${item.id}`;

  function send(action: (data: FormData) => Promise<{ error: string } | null>, fields: Record<string, string>) {
    const data = new FormData();
    data.set("establishmentId", establishmentId);
    data.set("actionItemId", item.id);
    for (const [k, v] of Object.entries(fields)) data.set(k, v);
    setError(null);
    startTransition(async () => {
      const result = await action(data);
      if (result) setError(result.error);
    });
  }

  function reassign(value: string) {
    const [ownerKind = "STRUCTURE", ownerUserId = ""] = value.split(":");
    send(reassignActionItem, { ownerKind, ownerUserId });
  }

  return (
    <li className="flex flex-wrap items-start gap-3 px-2 py-3.5">
      <input
        id={checkboxId}
        type="checkbox"
        checked={item.doneAt !== null}
        disabled={!canAct || isPending}
        onChange={(e) => send(setActionItemDone, { done: String(e.target.checked) })}
        className="mt-1 h-6 w-6 flex-shrink-0 accent-terre"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <label htmlFor={checkboxId} className={item.doneAt ? "font-bold text-ink2 line-through" : "font-bold text-ink"}>
          {item.title}
        </label>
        <p className="text-sm text-ink2">
          {describeOwner(item)}
          {item.dueOn && ` · échéance ${formatDate(item.dueOn)}`}
          {` · ${SOURCE_LABELS[item.source]}`}
          {item.linkedCriterionCode && ` · critère ${item.linkedCriterionCode}`}
        </p>
        {error && (
          <p role="alert" className="text-sm text-danger-text">
            {error}
          </p>
        )}
      </div>
      <StatusPill pill={actionPill(item, now)} />
      {canAct && item.doneAt === null && (
        <div className="w-full sm:w-64">
          <label htmlFor={`${checkboxId}-owner`} className="sr-only">
            Confier la tâche « {item.title} »
          </label>
          <Select
            id={`${checkboxId}-owner`}
            value={ownerValue(item)}
            onChange={(e) => reassign(e.target.value)}
            disabled={isPending}
          >
            <option value="STRUCTURE:">La structure</option>
            {structurePeople.map((p) => (
              <option key={p.id} value={`STRUCTURE:${p.id}`}>
                {p.name}
              </option>
            ))}
            {!isClient && <option value="CABINET:">EODA</option>}
            {!isClient &&
              cabinetPeople.map((p) => (
                <option key={p.id} value={`CABINET:${p.id}`}>
                  EODA · {p.name}
                </option>
              ))}
          </Select>
        </div>
      )}
    </li>
  );
}
