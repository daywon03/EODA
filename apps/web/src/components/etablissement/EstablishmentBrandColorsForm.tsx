"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { setEstablishmentBrandColors, type BrandColorsActionState } from "@/lib/actions/establishment";
import { submitWithoutReset } from "@/lib/forms/submit-without-reset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  establishmentId: string;
  establishmentName: string;
  primary: string | null;
  secondary: string | null;
};

const HEX = /^#?([0-9a-f]{6})$/i;

// Valeur montrée par le sélecteur natif : il n'accepte que « #rrggbb ».
function pickerValue(value: string, fallback: string): string {
  const match = HEX.exec(value.trim());
  return match ? `#${match[1]!.toLowerCase()}` : fallback;
}

function ColorField({
  id,
  name,
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  id: string;
  name: string;
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} : choisir dans la palette`}
          value={pickerValue(value, "#3e2c26")}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          disabled={disabled}
          className="h-11 w-12 shrink-0 cursor-pointer rounded-md border border-gris-light bg-surface p-1 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Input
          id={id}
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="#1A4D8F"
          maxLength={7}
          spellCheck={false}
          autoComplete="off"
          disabled={disabled}
          aria-describedby={`${id}-hint`}
          className="max-w-[9rem] font-mono uppercase"
        />
      </div>
      <p id={`${id}-hint`} className="text-sm text-ink2">
        {hint}
      </p>
    </div>
  );
}

// Charte couleur de la structure (E1, call du 09/11/2026) — à côté du logo, même garde.
// L'aperçu montre ce qui sortira sur le document final : un titre dans la couleur
// principale, souligné d'un filet dans la secondaire. La page de garde EODA, elle,
// garde la charte EODA.
export function EstablishmentBrandColorsForm({ establishmentId, establishmentName, primary, secondary }: Props) {
  const [state, formAction, isPending] = useActionState<BrandColorsActionState, FormData>(setEstablishmentBrandColors, null);
  const [primaryValue, setPrimary] = useState(primary ?? "");
  const [secondaryValue, setSecondary] = useState(secondary ?? "");
  const previewPrimary = HEX.test(primaryValue.trim()) ? pickerValue(primaryValue, "") : null;
  const previewSecondary = HEX.test(secondaryValue.trim()) ? pickerValue(secondaryValue, "") : previewPrimary;

  return (
    <form method="post" onSubmit={submitWithoutReset(formAction)} className="space-y-4 border-t border-line pt-4">
      <input type="hidden" name="establishmentId" value={establishmentId} />
      <div>
        <h3 className="font-bold text-ink">Couleurs de la structure</h3>
        <p className="mt-1 text-sm text-ink2">
          Elles colorent les titres du document remis à la structure après une mise en conformité. La page de garde EODA
          garde les couleurs EODA. Sans couleur saisie, le document garde sa mise en forme par défaut.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ColorField
          id="brand-primary"
          name="primary"
          label="Couleur principale"
          hint="Titres. Assez foncée pour se lire sur du blanc."
          value={primaryValue}
          onChange={setPrimary}
          disabled={isPending}
        />
        <ColorField
          id="brand-secondary"
          name="secondary"
          label="Couleur secondaire"
          hint="Filets sous les titres. Facultative."
          value={secondaryValue}
          onChange={setSecondary}
          disabled={isPending}
        />
      </div>

      <div aria-hidden="true" className="rounded-lg border border-line bg-white px-4 py-3">
        <p
          className="border-b-[3px] pb-1 text-lg font-bold"
          style={{ color: previewPrimary ?? "#3E2C26", borderColor: previewSecondary ?? "transparent" }}
        >
          Livret d&apos;accueil — {establishmentName}
        </p>
        {/* Le papier du document est blanc quel que soit le thème : couleurs fixes. */}
        <p className="mt-2 text-sm" style={{ color: "#3E2C26" }}>
          Aperçu du titre d&apos;un document final.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          Enregistrer les couleurs
        </Button>
        {(primaryValue || secondaryValue) && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() => {
              setPrimary("");
              setSecondary("");
            }}
          >
            Vider les champs
          </Button>
        )}
        {state && "ok" in state && !isPending && (
          <p role="status" className="flex items-center gap-1.5 text-sm text-ink2">
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            Couleurs enregistrées.
          </p>
        )}
      </div>

      {state && "error" in state && (
        <p role="alert" className="flex items-center gap-1.5 text-sm text-rouge-imp">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}
    </form>
  );
}
