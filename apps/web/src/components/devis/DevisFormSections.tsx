"use client";

import type { ReactNode } from "react";
import type { CommercialTier, PricingUnit } from "@eoda/database";
import { formatStartingPrice } from "@/lib/services/price-format-service";
import { isSubscriptionOption, optionUnitPriceForFormule } from "@/lib/services/subscription-service";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Sections présentationnelles du formulaire de devis (maquette v2 « Nouveau
// devis » : des cartes, un récapitulatif collant). Aucun calcul ici : les prix
// affichés viennent des mêmes fonctions que le serveur (subscription-service).

export type FormuleOption = {
  formule: CommercialTier;
  label: string;
  priceEuros: number;
  // Renseignés en mode « évaluation des besoins » : pendant un appel, le cabinet
  // doit voir ce que chaque offre contient sans changer d'écran.
  modulesLabel?: string | null;
  description?: string | null;
};

export type CatalogueOptionItem = {
  id: string;
  // L'appariement de l'abonnement portail (dégressif selon l'offre) se fait par
  // code, jamais par libellé (CLAUDE.md §7).
  code: string;
  label: string;
  priceEuros: number;
  pricingUnit: PricingUnit;
  priceMaxEuros: number | null;
  minQuantity: number | null;
};

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-xl border border-line bg-card p-5">
      <legend className="float-left mb-1 w-full text-lg font-bold text-ink">{title}</legend>
      <div className="clear-both space-y-3">{children}</div>
    </fieldset>
  );
}

export function OfferPicker({
  formules,
  value,
  onChange,
  disabled,
}: {
  formules: readonly FormuleOption[];
  value: CommercialTier | "";
  onChange: (formule: CommercialTier | "") => void;
  disabled: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {/* Devis SANS offre (call du 01/09) : valeur vide, lue comme « aucune formule »
          par le serveur, qui exige alors au moins une prestation à la carte. */}
      <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border-2 border-line bg-card p-4 transition-colors has-[:checked]:border-ink-fill has-[:checked]:bg-soft">
        <input
          type="radio"
          name="formule"
          value=""
          checked={value === ""}
          onChange={() => onChange("")}
          disabled={disabled}
          required
          className="mt-1 h-5 w-5 accent-terre"
        />
        <span className="min-w-0 flex-1 space-y-1">
          <span className="block text-lg font-bold text-ink">Sans offre</span>
          <span className="block text-sm text-ink2">Prestations à la carte seules — cochez-en au moins une.</span>
        </span>
      </label>
      {formules.map((f) => (
        <label
          key={f.formule}
          className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border-2 border-line bg-card p-4 transition-colors has-[:checked]:border-ink-fill has-[:checked]:bg-soft"
        >
          <input
            type="radio"
            name="formule"
            value={f.formule}
            checked={value === f.formule}
            onChange={() => onChange(f.formule)}
            disabled={disabled}
            required
            className="mt-1 h-5 w-5 accent-terre"
          />
          <span className="min-w-0 flex-1 space-y-1">
            <span className="block text-lg font-bold text-ink">{f.label}</span>
            <span className="block text-sm tabular-nums text-ink2">{formatStartingPrice({ priceEuros: f.priceEuros })}</span>
            {f.modulesLabel && <span className="block text-sm text-ink2">{f.modulesLabel}</span>}
            {f.description && <span className="block text-sm text-ink2">{f.description}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

export function OptionPicker({
  options,
  formule,
  selectedIds,
  onToggle,
  subscriptionNotice,
  disabled,
}: {
  options: readonly CatalogueOptionItem[];
  formule: CommercialTier | "";
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
  subscriptionNotice: string | null;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      {options.map((o) => (
        <label
          key={o.id}
          className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border-2 border-line px-3 py-2 transition-colors has-[:checked]:border-ink-fill"
        >
          <input
            type="checkbox"
            name="optionIds"
            value={o.id}
            checked={selectedIds.includes(o.id)}
            onChange={() => onToggle(o.id)}
            disabled={disabled}
            className="h-5 w-5 accent-terre"
          />
          <span className="min-w-0 flex-1 text-ink">
            <span className="font-bold">{o.label}</span>
            {/* L'abonnement portail est le seul tarif dégressif du catalogue (§12.2) :
                le taux appliqué est annoncé à côté de la ligne, sinon le total baisse
                sans que personne ne sache pourquoi. */}
            {isSubscriptionOption(o.code) && subscriptionNotice && (
              <span className="block text-sm text-accent-text">{subscriptionNotice}</span>
            )}
          </span>
          <span className="whitespace-nowrap text-sm tabular-nums text-ink2">
            {formatStartingPrice({ ...o, priceEuros: optionUnitPriceForFormule(o, formule === "" ? null : formule) })}
          </span>
        </label>
      ))}
    </div>
  );
}

export function ConditionsFields({
  depositPercent,
  onDepositChange,
  installmentCount,
  onInstallmentChange,
  defaultValidityDays,
  validityHint,
  disabled,
}: {
  depositPercent: number;
  onDepositChange: (value: number) => void;
  installmentCount: number;
  onInstallmentChange: (value: number) => void;
  defaultValidityDays: number;
  validityHint?: string | undefined;
  disabled: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor="depositPercent">Acompte (%)</Label>
        <Input
          id="depositPercent"
          name="depositPercent"
          type="number"
          min={0}
          max={100}
          value={depositPercent}
          onChange={(e) => onDepositChange(Number(e.target.value))}
          disabled={disabled}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="installmentCount">Nombre d&apos;échéances</Label>
        <Input
          id="installmentCount"
          name="installmentCount"
          type="number"
          min={1}
          max={6}
          value={installmentCount}
          onChange={(e) => onInstallmentChange(Number(e.target.value))}
          disabled={disabled}
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
          defaultValue={defaultValidityDays}
          disabled={disabled}
          aria-describedby={validityHint ? "validityDays-hint" : undefined}
        />
        {validityHint && (
          <p id="validityDays-hint" className="text-sm text-ink2">
            {validityHint} Modifiable.
          </p>
        )}
      </div>
    </div>
  );
}
