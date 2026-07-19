"use client";

import { useActionState } from "react";
import { updateBillingSettings } from "@/lib/actions/catalogue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2 } from "lucide-react";
import type { BillingSettings } from "@eoda/database";

export function BillingSettingsForm({ settings }: { settings: BillingSettings | null }) {
  const [state, formAction, isPending] = useActionState(updateBillingSettings, null);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-4">
      <div className="space-y-1">
        <Label htmlFor="defaultDepositPercent">Acompte par défaut (%)</Label>
        <Input
          id="defaultDepositPercent"
          name="defaultDepositPercent"
          type="number"
          min={0}
          max={100}
          defaultValue={settings?.defaultDepositPercent ?? 30}
          disabled={isPending}
          className="w-32"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="defaultValidityDays">Validité par défaut (jours)</Label>
        <Input
          id="defaultValidityDays"
          name="defaultValidityDays"
          type="number"
          min={1}
          defaultValue={settings?.defaultValidityDays ?? 30}
          disabled={isPending}
          className="w-32"
        />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
        Enregistrer
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
