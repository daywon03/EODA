"use client";

import { useActionState } from "react";
import { upsertCatalogueOption } from "@/lib/actions/catalogue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2, Plus } from "lucide-react";
import type { CatalogueOption } from "@eoda/database";

// Sans `option`, le formulaire crée une nouvelle prestation à la carte.
// Avec `option`, il modifie label/prix d'une prestation existante (code figé).
export function CatalogueOptionForm({ option }: { option?: CatalogueOption }) {
  const [state, formAction, isPending] = useActionState(upsertCatalogueOption, null);
  const isEdit = !!option;

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor={`code-${option?.id ?? "new"}`}>Code</Label>
        <Input
          id={`code-${option?.id ?? "new"}`}
          name="code"
          defaultValue={option?.code}
          disabled={isPending || isEdit}
          required
          className="w-40"
          placeholder="ex : ATELIER_SUPP"
        />
      </div>
      <div className="space-y-1 flex-1 min-w-[180px]">
        <Label htmlFor={`label-${option?.id ?? "new"}`}>Libellé</Label>
        <Input id={`label-${option?.id ?? "new"}`} name="label" defaultValue={option?.label} disabled={isPending} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`price-${option?.id ?? "new"}`}>Prix (€)</Label>
        <Input
          id={`price-${option?.id ?? "new"}`}
          name="priceEuros"
          type="number"
          min={0}
          defaultValue={option?.priceEuros}
          disabled={isPending}
          required
          className="w-32"
        />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : !isEdit && <Plus className="w-3.5 h-3.5" aria-hidden="true" />}
        {isEdit ? "Enregistrer" : "Ajouter"}
      </Button>
      {state?.error && (
        <p role="alert" className="flex items-center gap-1 text-xs text-rouge-imp w-full">
          <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}
    </form>
  );
}
