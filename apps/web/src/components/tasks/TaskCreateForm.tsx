"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { createActionItem, type ActionPerson } from "@/lib/actions/task";
import { MAX_ACTION_TITLE_LENGTH } from "@/lib/services/action-item-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type Props = {
  establishmentId: string;
  isClient: boolean;
  cabinetPeople: readonly ActionPerson[];
  structurePeople: readonly ActionPerson[];
};

// Ajouter une tâche : un geste sur un document ou une pratique, un responsable, une
// échéance facultative. Le serveur revérifie le responsable (assignmentError).
export function TaskCreateForm({ establishmentId, isClient, cabinetPeople, structurePeople }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const [ownerKind = "STRUCTURE", ownerUserId = ""] = String(data.get("owner") ?? "").split(":");
    data.set("establishmentId", establishmentId);
    data.set("ownerKind", ownerKind);
    data.set("ownerUserId", ownerUserId);
    setError(null);
    startTransition(async () => {
      const result = await createActionItem(data);
      if (result) setError(result.error);
      else formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="grid gap-3 rounded-xl border border-line bg-card p-5 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
      <div className="space-y-1.5">
        <Label htmlFor="task-title">Nouvelle tâche</Label>
        <Input
          id="task-title"
          name="title"
          required
          maxLength={MAX_ACTION_TITLE_LENGTH}
          placeholder="ex : Ajouter le droit à l'image au livret d'accueil"
          disabled={isPending}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="task-owner">Confiée à</Label>
        <Select id="task-owner" name="owner" defaultValue="STRUCTURE:" disabled={isPending}>
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
      <div className="space-y-1.5">
        <Label htmlFor="task-due">Échéance (facultative)</Label>
        <Input id="task-due" name="dueOn" type="date" disabled={isPending} />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
        Ajouter
      </Button>
      {error && (
        <p role="alert" className="text-sm text-danger-text sm:col-span-4">
          {error}
        </p>
      )}
    </form>
  );
}
