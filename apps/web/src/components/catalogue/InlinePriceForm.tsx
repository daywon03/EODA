"use client";

import { useActionState, useId } from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { updateFormuleMonthlyPrice, updateOptionPrice } from "@/lib/actions/catalogue";
import { Button } from "@/components/ui/button";

// Prix modifiable sur place (maquette v2 « Catalogue ») : un champ, l'unité à côté,
// un bouton « Enregistrer ». Le prix MENSUEL d'une offre peut rester vide — il
// s'affiche alors « à partir de xx € / mois », jamais 0 inventé.
export function InlinePriceForm({
  kind,
  id,
  value,
  unitLabel,
  accessibleName,
  label = "Prix",
}: {
  kind: "formule-monthly" | "option";
  id: string;
  value: number | null;
  unitLabel: string;
  accessibleName: string;
  label?: string;
}) {
  const [state, formAction, isPending] = useActionState(
    kind === "option" ? updateOptionPrice : updateFormuleMonthlyPrice,
    null
  );
  const inputId = useId();
  const field = kind === "option" ? "priceEuros" : "monthlyPriceEuros";

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={inputId} className="flex-1 text-base text-ink2">
          {label}
          <span className="sr-only"> — {accessibleName}</span>
        </label>
        <input
          id={inputId}
          name={field}
          type="number"
          inputMode="decimal"
          min={0}
          defaultValue={value ?? ""}
          placeholder="xx"
          required={kind === "option"}
          disabled={isPending}
          className="h-11 w-24 rounded-lg border border-muted bg-card px-2.5 text-right text-base tabular-nums text-ink placeholder:text-ink2"
        />
        <span className="whitespace-nowrap text-base text-ink">€ {unitLabel}</span>
        <Button type="submit" size="sm" variant="outline" disabled={isPending} aria-label={`Enregistrer le prix — ${accessibleName}`}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
          <span className="hidden sm:inline">Enregistrer</span>
        </Button>
      </div>
      {state?.error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-danger-text">
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}
    </form>
  );
}
