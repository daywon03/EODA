"use client";

import type { ReactNode } from "react";
import type { CommercialTier } from "@eoda/database";
import { formatPriceWithUnit } from "@/lib/services/price-format-service";
import { isSubscriptionOption, optionUnitPriceForFormule } from "@/lib/services/subscription-service";
import { COMMITMENT_CHOICES, COMMITMENT_LABELS, offerModeLabel, type CommitmentMonths } from "@/lib/services/devis-recap-service";
import type { DevisFormuleChoice, DevisOptionChoice } from "@/lib/services/devis-catalogue-choices";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Sections présentationnelles du formulaire de devis (maquette v2 « Nouveau devis » :
// Structure, Offre, Options, Engagement, Note). Aucun calcul ici : les prix affichés
// viennent des mêmes fonctions que le serveur (subscription-service).

export type FormuleOption = DevisFormuleChoice;
export type CatalogueOptionItem = DevisOptionChoice;

// Champ groupé : un intitulé en gras, sans boîte autour (la maquette aligne les
// blocs sur la colonne, les cartes sont réservées aux choix eux-mêmes).
export function FormSection({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-2 font-bold text-ink">
        {title}
        {hint && <span className="font-normal text-ink2"> {hint}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

const CHOICE_CARD =
  "flex min-h-11 cursor-pointer flex-col gap-1 rounded-xl border-2 border-line bg-card p-4 text-left text-ink transition-colors hover:border-muted has-[:checked]:border-accent-fill has-[:checked]:bg-paper has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ambre";

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
    <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
      {formules.map((f) => (
        <label key={f.formule} className={CHOICE_CARD}>
          <input
            type="radio"
            name="formule"
            value={f.formule}
            checked={value === f.formule}
            onChange={() => onChange(f.formule)}
            disabled={disabled}
            required
            className="sr-only"
          />
          <span className="text-lg font-bold">{f.label}</span>
          <span className="text-base text-ink2">
            {offerModeLabel(f.formule)}
            {f.modulesLabel ? ` · ${f.modulesLabel}` : ""}
          </span>
          {f.description && <span className="text-base text-ink2">{f.description}</span>}
        </label>
      ))}
      {/* Devis SANS offre (call du 01/09) : valeur vide, lue comme « aucune formule »
          par le serveur, qui exige alors au moins une prestation à la carte. */}
      <label className={CHOICE_CARD}>
        <input
          type="radio"
          name="formule"
          value=""
          checked={value === ""}
          onChange={() => onChange("")}
          disabled={disabled}
          required
          className="sr-only"
        />
        <span className="text-lg font-bold">Sans offre</span>
        <span className="text-base text-ink2">Prestations à la carte seules</span>
      </label>
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
  if (options.length === 0) return <p className="text-ink2">Aucune option en vente au catalogue.</p>;
  return (
    <div className="flex flex-col gap-2">
      {options.map((o) => {
        const checked = selectedIds.includes(o.id);
        return (
          <label
            key={o.id}
            className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-[10px] border-2 border-line bg-card px-3 py-2 text-ink transition-colors hover:border-muted has-[:checked]:border-ink has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ambre"
          >
            <input
              type="checkbox"
              name="optionIds"
              value={o.id}
              checked={checked}
              onChange={() => onToggle(o.id)}
              disabled={disabled}
              className="h-6 w-6 flex-shrink-0 accent-terre"
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-bold">{o.label}</span>
              {o.audienceLabel && <span className="text-base text-ink2">{o.audienceLabel}</span>}
              {/* L'abonnement portail est le seul tarif dégressif du catalogue (§12.2) :
                  le taux appliqué est annoncé à côté de la ligne. */}
              {isSubscriptionOption(o.code) && subscriptionNotice && (
                <span className="text-base text-accent-text">{subscriptionNotice}</span>
              )}
            </span>
            {/* Passe à la ligne sur téléphone : « 360 € / mois (engagement 12 mois
                minimum) » d'un seul tenant élargissait la page à 390 px. */}
            <span className="max-w-[45%] text-right text-base tabular-nums sm:max-w-none sm:whitespace-nowrap">
              {formatPriceWithUnit({ ...o, priceEuros: optionUnitPriceForFormule(o, formule === "" ? null : formule) })}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function CommitmentPicker({
  value,
  onChange,
  disabled,
}: {
  value: CommitmentMonths;
  onChange: (value: CommitmentMonths) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {COMMITMENT_CHOICES.map((months) => (
        <label
          key={months}
          className="inline-flex min-h-11 cursor-pointer items-center rounded-full border-2 border-line bg-card px-4 font-bold text-ink transition-colors hover:border-muted has-[:checked]:border-ink-fill has-[:checked]:bg-ink-fill has-[:checked]:text-on-ink has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ambre"
        >
          <input
            type="radio"
            name="commitmentMonths"
            value={months}
            checked={value === months}
            onChange={() => onChange(months)}
            disabled={disabled}
            className="sr-only"
          />
          {value === months && <span aria-hidden="true">✓&nbsp;</span>}
          {COMMITMENT_LABELS[months]}
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
          <p id="validityDays-hint" className="text-base text-ink2">
            {validityHint} Modifiable.
          </p>
        )}
      </div>
    </div>
  );
}
