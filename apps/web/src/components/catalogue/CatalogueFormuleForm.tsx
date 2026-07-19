"use client";

import { useActionState } from "react";
import { upsertCatalogueFormule } from "@/lib/actions/catalogue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2 } from "lucide-react";
import type { CatalogueFormule } from "@eoda/database";

export function CatalogueFormuleForm({ formule }: { formule: CatalogueFormule }) {
  const [state, formAction, isPending] = useActionState(upsertCatalogueFormule, null);

  return (
    <form action={formAction} className="border border-gris-light rounded-xl p-4 space-y-3">
      <input type="hidden" name="formule" value={formule.formule} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`label-${formule.id}`}>Libellé</Label>
          <Input id={`label-${formule.id}`} name="label" defaultValue={formule.label} disabled={isPending} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`price-${formule.id}`}>Prix (€)</Label>
          <Input id={`price-${formule.id}`} name="priceEuros" type="number" min={0} defaultValue={formule.priceEuros} disabled={isPending} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`modules-${formule.id}`}>Modules</Label>
          <Input id={`modules-${formule.id}`} name="modulesLabel" defaultValue={formule.modulesLabel ?? undefined} disabled={isPending} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`description-${formule.id}`}>Description</Label>
        <Input id={`description-${formule.id}`} name="description" defaultValue={formule.description ?? undefined} disabled={isPending} />
      </div>
      {state?.error && (
        <p role="alert" className="flex items-center gap-1 text-xs text-rouge-imp">
          <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
        Enregistrer
      </Button>
    </form>
  );
}
