"use client";

import { cn } from "@/lib/utils";

// Choix d'un rôle « en cartes » (maquettes Équipe EODA et Paramètres de la
// structure) : chaque carte est un VRAI bouton radio, masqué visuellement mais
// présent — flèches du clavier, nom accessible, état coché lus correctement. La
// carte choisie se reconnaît à sa bordure ET à sa pastille pleine, jamais à la
// couleur seule.
export type RoleCardOption<T extends string> = { value: T; label: string; description: string };

export function RoleCardPicker<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  disabled = false,
}: {
  legend: string;
  name: string;
  options: readonly RoleCardOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="mb-2 font-bold text-ink">{legend}</legend>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <label
            key={option.value}
            className={cn(
              "flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border-2 px-3 py-2 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-70",
              selected ? "border-accent-fill bg-paper" : "border-line bg-card"
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <span
              aria-hidden="true"
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-ink"
            >
              {selected && <span className="h-2.5 w-2.5 rounded-full bg-accent-fill" />}
            </span>
            <span className="flex flex-col">
              <span className="font-bold text-ink">{option.label}</span>
              <span className="text-ink2">{option.description}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
