"use client";

import { cn } from "@/lib/utils";
import { TABLET_CHOICE_OFF, TABLET_CHOICE_ON, TABLET_INPUT } from "../tablet-ui";

// Champs de saisie partagés par les étapes de l'accueil : mêmes tailles (tablette,
// « un enfant de 12 ans »), même mention « facultatif ».

export const FIELD_LABEL = "flex flex-col gap-1.5 text-[19px] font-bold";
export const CHOICE = "min-h-[60px] rounded-xl border-2 px-5 text-[19px] font-bold";

export function Field({ label, value, onChange, type = "text", optional = true, autoComplete = "off", inputMode }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  optional?: boolean;
  autoComplete?: string;
  inputMode?: "numeric" | "tel" | "email" | "decimal";
}) {
  return (
    <label className={FIELD_LABEL}>
      <span>
        {label}
        {optional && <span className="font-normal text-ink2"> (facultatif)</span>}
      </span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={TABLET_INPUT} autoComplete={autoComplete} inputMode={inputMode} maxLength={120} />
    </label>
  );
}

export function Choices<T extends string>({ legend, options, value, onChange }: { legend: string; options: { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-[19px] font-bold">{legend}</legend>
      <div className="flex flex-wrap gap-3">
        {options.map((option) => (
          <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)} className={cn(CHOICE, value === option.value ? TABLET_CHOICE_ON : TABLET_CHOICE_OFF)}>
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
