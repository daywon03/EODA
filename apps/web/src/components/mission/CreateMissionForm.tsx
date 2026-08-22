"use client";

import { useActionState } from "react";
import { createMission } from "@/lib/actions/mission";
import { FormuleOfferPicker } from "./FormuleOfferPicker";
import { MissionOptionsPicker } from "./MissionOptionsPicker";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";
import type { CatalogueFormule, CatalogueOption } from "@eoda/database";

type Props = {
  establishmentId: string;
  formules: CatalogueFormule[];
  options: CatalogueOption[];
};

export function CreateMissionForm({ establishmentId, formules, options }: Props) {
  const action = createMission.bind(null, establishmentId);
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-5">
      <FormuleOfferPicker formules={formules} />
      <MissionOptionsPicker options={options} />

      {state?.error && (
        <div
          role="alert"
          className="flex items-center gap-2 text-rouge-imp text-sm bg-rouge-imp/10 border border-rouge-imp/20 rounded-md px-3 py-2.5"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span>{state.error}</span>
        </div>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
        Démarrer le suivi de mission
      </Button>
    </form>
  );
}
