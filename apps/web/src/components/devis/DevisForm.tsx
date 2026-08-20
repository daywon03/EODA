"use client";

import { useActionState, useMemo, useState } from "react";
import { createDevis, updateDevis } from "@/lib/actions/devis";
import {
  computeDevisAmounts,
  optionCommittedAmountEuros,
} from "@/lib/services/devis-calculation-service";
import { formatEuros, formatStartingPrice } from "@/lib/services/price-format-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import type { CommercialTier, PricingUnit } from "@eoda/database";

type FormuleOption = { formule: CommercialTier; label: string; priceEuros: number };
type CatalogueOptionItem = {
  id: string;
  label: string;
  priceEuros: number;
  pricingUnit: PricingUnit;
  priceMaxEuros: number | null;
  minQuantity: number | null;
};

// Valeurs d'un devis existant à corriger. Absentes = création.
// Seul un BROUILLON arrive ici : la route de modification refuse les autres, et
// `updateDevis` le revérifie côté serveur.
type DevisDraft = {
  id: string;
  formule: CommercialTier;
  optionIds: string[];
  depositPercent: number;
  installmentCount: number;
  validityDays: number;
};

type Props = {
  prospectId: string;
  formules: FormuleOption[];
  options: CatalogueOptionItem[];
  defaultDepositPercent: number;
  defaultValidityDays: number;
  draft?: DevisDraft;
  // Lignes du brouillon qui ne sont plus au catalogue (formule ou prestation
  // retirée depuis la création). Affichées explicitement : elles disparaîtront à
  // l'enregistrement, et une disparition silencieuse serait pire que le retrait.
  retiredLines?: string[];
};

export function DevisForm({
  prospectId,
  formules,
  options,
  defaultDepositPercent,
  defaultValidityDays,
  draft,
  retiredLines = [],
}: Props) {
  // `updateDevis` prend l'identifiant en premier argument : on le lie ici plutôt
  // que de le poster en champ caché — un identifiant lié n'est pas réécrivable
  // depuis le navigateur.
  const [state, formAction, isPending] = useActionState(
    draft ? updateDevis.bind(null, draft.id) : createDevis,
    null
  );
  // Repli sur la première formule active si celle du brouillon a été retirée du
  // catalogue entre-temps : le <select> ne peut pas porter une valeur absente de
  // ses options.
  const draftFormuleStillSellable =
    draft !== undefined && formules.some((f) => f.formule === draft.formule);
  const [formule, setFormule] = useState<CommercialTier | "">(
    (draftFormuleStillSellable ? draft?.formule : undefined) ?? formules[0]?.formule ?? ""
  );
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>(
    (draft?.optionIds ?? []).filter((id) => options.some((o) => o.id === id))
  );
  const [depositPercent, setDepositPercent] = useState(draft?.depositPercent ?? defaultDepositPercent);
  const [installmentCount, setInstallmentCount] = useState(draft?.installmentCount ?? 1);

  const preview = useMemo(() => {
    const formulePrice = formules.find((f) => f.formule === formule)?.priceEuros ?? 0;
    // Une option tarifée à l'heure ou au mois entre au devis pour son engagement
    // minimal (2 h, 12 mois), pas pour son prix unitaire — cf. optionCommittedAmountEuros.
    const optionPrices = options
      .filter((o) => selectedOptionIds.includes(o.id))
      .map(optionCommittedAmountEuros);
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
              {f.label} — {formatStartingPrice({ priceEuros: f.priceEuros })}
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
              {o.label} <span className="text-gris-mid">— {formatStartingPrice(o)}</span>
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
            max={365}
            defaultValue={draft?.validityDays ?? defaultValidityDays}
            disabled={isPending}
          />
        </div>
      </div>

      <div className="bg-ivoire rounded-lg p-4 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-gris-mid">Montant total</span>
          <span className="font-semibold text-brun-ancre">
            {formatStartingPrice({ priceEuros: preview.totalAmountEuros })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gris-mid">Acompte</span>
          <span className="font-semibold text-brun-ancre">{formatEuros(preview.depositAmountEuros)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gris-mid">Solde</span>
          <span className="font-semibold text-brun-ancre">{formatEuros(preview.balanceAmountEuros)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gris-mid">Par échéance</span>
          <span className="font-semibold text-brun-ancre">{formatEuros(preview.installmentAmountEuros)}</span>
        </div>
      </div>

      {retiredLines.length > 0 && (
        <div
          role="status"
          className="flex items-start gap-2 text-sm text-brun-moyen bg-ambre/15 border border-ambre/30 rounded-md px-3 py-2.5"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-ambre" aria-hidden="true" />
          <span>
            Retirées du catalogue depuis la création de ce brouillon, ces lignes ne seront pas
            conservées à l&apos;enregistrement : {retiredLines.join(", ")}.
          </span>
        </div>
      )}

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
          {draft ? "Enregistrer les corrections" : "Créer le devis"}
        </Button>
        <Button type="button" variant="outline" asChild className="mt-6">
          <Link
            href={
              draft
                ? `/dashboard/cabinet/commercial/devis/${draft.id}`
                : `/dashboard/cabinet/commercial/prospects/${prospectId}`
            }
          >
            Annuler
          </Link>
        </Button>
      </div>
    </form>
  );
}
