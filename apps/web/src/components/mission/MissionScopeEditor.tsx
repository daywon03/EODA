"use client";

import { useActionState } from "react";
import { updateMissionScope } from "@/lib/actions/mission";
import { FormuleOfferPicker } from "./FormuleOfferPicker";
import { MissionOptionsPicker } from "./MissionOptionsPicker";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";
import type { CatalogueFormule, CatalogueOption, CommercialTier } from "@eoda/database";

type Props = {
  missionId: string;
  formules: CatalogueFormule[];
  options: CatalogueOption[];
  currentFormule: CommercialTier;
  currentGratuit: boolean;
  subscribedOptions: { catalogueOptionId: string; priceIsFirm: boolean }[];
};

export function MissionScopeEditor({
  missionId,
  formules,
  options,
  currentFormule,
  currentGratuit,
  subscribedOptions,
}: Props) {
  const action = updateMissionScope.bind(null, missionId);
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-4">
      <FormuleOfferPicker formules={formules} defaultFormule={currentFormule} defaultGratuit={currentGratuit} />
      <MissionOptionsPicker options={options} subscribed={subscribedOptions} />

      {state?.error && (
        <div
          role="alert"
          className="flex items-center gap-2 text-rouge-imp text-sm bg-rouge-imp/10 border border-rouge-imp/20 rounded-md px-3 py-2.5"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span>{state.error}</span>
        </div>
      )}

      <Button type="submit" size="sm" disabled={isPending}>
        {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
        Mettre à jour le périmètre
      </Button>
    </form>
  );
}
