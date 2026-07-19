"use client";

import { useActionState, useMemo, useState } from "react";
import { createDevis } from "@/lib/actions/devis";
import { computeDevisAmounts } from "@/lib/services/devis-calculation-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import type { CommercialTier } from "@eoda/database";

type FormuleOption = { formule: CommercialTier; label: string; priceEuros: number };
type CatalogueOptionItem = { id: string; label: string; priceEuros: number };

type Props = {
  prospectId: string;
  formules: FormuleOption[];
  options: CatalogueOptionItem[];
  defaultDepositPercent: number;
  defaultValidityDays: number;
};

export function DevisForm({ prospectId, formules, options, defaultDepositPercent, defaultValidityDays }: Props) {
  const [state, formAction, isPending] = useActionState(createDevis, null);
  const [formule, setFormule] = useState<CommercialTier | "">(formules[0]?.formule ?? "");
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [depositPercent, setDepositPercent] = useState(defaultDepositPercent);
  const [installmentCount, setInstallmentCount] = useState(1);

  const preview = useMemo(() => {
    const formulePrice = formules.find((f) => f.formule === formule)?.priceEuros ?? 0;
    const optionPrices = options
      .filter((o) => selectedOptionIds.includes(o.id))
      .map((o) => o.priceEuros);
    return computeDevisAmounts({
      formulePriceEuros: formulePrice,
      optionPricesEuros: optionPrices,
      depositPercent,
      installmentCount,
    });
  }, [formule, selectedOptionIds, depositPercent, installmentCount, formules, options]);

  function toggleOption(id: string) {
    setSelectedOptionIds((prev) => (prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]));
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="prospectId" value={prospectId} />

      <div className="space-y-1.5">
        <Label htmlFor="formule">
          Formule <span className="text-rouge-imp">*</span>
        </Label>
        <Select
          id="formule"
          name="formule"
          required
          disabled={isPending}
          value={formule}
          onChange={(e) => setFormule(e.target.value as CommercialTier)}
        >
          {formules.map((f) => (
            <option key={f.formule} value={f.formule}>
              {f.label} — {f.priceEuros.toLocaleString("fr-FR")} €
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Prestations à la carte</Label>
        <div className="space-y-2 border border-gris-light rounded-md p-3">
          {options.map((o) => (
            <label key={o.id} className="flex items-center gap-2 text-sm text-brun-ancre cursor-pointer">
              <input
                type="checkbox"
                name="optionIds"
                value={o.id}
                checked={selectedOptionIds.includes(o.id)}
                onChange={() => toggleOption(o.id)}
                disabled={isPending}
                className="accent-terre"
              />
              {o.label} <span className="text-gris-mid">— {o.priceEuros.toLocaleString("fr-FR")} €</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="depositPercent">Acompte (%)</Label>
          <Input
            id="depositPercent"
            name="depositPercent"
            type="number"
            min={0}
            max={100}
            value={depositPercent}
            onChange={(e) => setDepositPercent(Number(e.target.value))}
            disabled={isPending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="installmentCount">Nombre d'échéances</Label>
          <Input
            id="installmentCount"
            name="installmentCount"
            type="number"
            min={1}
            max={6}
            value={installmentCount}
            onChange={(e) => setInstallmentCount(Number(e.target.value))}
            disabled={isPending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="validityDays">Validité (jours)</Label>
          <Input
            id="validityDays"
            name="validityDays"
            type="number"
            min={1}
            defaultValue={defaultValidityDays}
            disabled={isPending}
          />
        </div>
      </div>

      <div className="bg-ivoire rounded-lg p-4 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-gris-mid">Montant total</span>
          <span className="font-semibold text-brun-ancre">{preview.totalAmountEuros.toLocaleString("fr-FR")} €</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gris-mid">Acompte</span>
          <span className="font-semibold text-brun-ancre">{preview.depositAmountEuros.toLocaleString("fr-FR")} €</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gris-mid">Solde</span>
          <span className="font-semibold text-brun-ancre">{preview.balanceAmountEuros.toLocaleString("fr-FR")} €</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gris-mid">Par échéance</span>
          <span className="font-semibold text-brun-ancre">{preview.installmentAmountEuros.toLocaleString("fr-FR")} €</span>
        </div>
      </div>

      {state?.error && (
        <div
          role="alert"
          className="flex items-center gap-2 text-rouge-imp text-sm bg-rouge-imp/10 border border-rouge-imp/20 rounded-md px-3 py-2.5"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span>{state.error}</span>
        </div>
      )}

      <div className="flex gap-3 pt-2 border-t border-gris-light mt-6">
        <Button type="submit" disabled={isPending} className="mt-6">
          {isPending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          Créer le devis
        </Button>
        <Button type="button" variant="outline" asChild className="mt-6">
          <Link href={`/dashboard/cabinet/commercial/prospects/${prospectId}`}>Annuler</Link>
        </Button>
      </div>
    </form>
  );
}
