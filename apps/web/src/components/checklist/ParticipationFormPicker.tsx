"use client";

import { useId, useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import type { ParticipationForm } from "@eoda/database";
import { setParticipationForm } from "@/lib/actions/document";
import { PARTICIPATION_FORM_LABELS, PARTICIPATION_FORMS } from "@/lib/services/participation-form-service";
import { Button } from "@/components/ui/button";

// Choix de la FORME de participation des usagers (21/10/2026), sur la seule ligne
// « Autre forme de participation des usagers ». Un fait de la structure — pas un
// second document : le CVS reste une ligne distincte, qu'une structure sans CVS déclare
// « Non concerné » une fois ce choix fait.
export function ParticipationFormPicker({
  establishmentId,
  form,
  otherLabel,
}: {
  establishmentId: string;
  form: ParticipationForm | null;
  otherLabel: string | null;
}) {
  const [choice, setChoice] = useState<ParticipationForm | null>(form);
  const [other, setOther] = useState(otherLabel ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const groupId = useId();

  function save() {
    if (!choice) return;
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await setParticipationForm(establishmentId, choice, choice === "AUTRE" ? other : null);
      if (result && "error" in result) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <fieldset className="space-y-2 rounded-xl border border-line bg-card p-4">
      <legend className="px-1 font-bold text-ink">Forme de participation des usagers</legend>
      <p className="text-sm text-ink2">
        Sans conseil de la vie sociale, la loi 2002-2 demande une autre forme de participation. Laquelle a été choisie ?
      </p>
      <div className="flex flex-col gap-1" role="radiogroup" aria-labelledby={groupId}>
        <span id={groupId} className="sr-only">
          Forme de participation
        </span>
        {PARTICIPATION_FORMS.map((value) => (
          <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2 text-ink">
            <input
              type="radio"
              name={`participation-${establishmentId}`}
              value={value}
              checked={choice === value}
              disabled={isPending}
              onChange={() => {
                setChoice(value);
                setSaved(false);
              }}
              className="h-4 w-4 accent-current"
            />
            {PARTICIPATION_FORM_LABELS[value]}
          </label>
        ))}
      </div>
      {choice === "AUTRE" && (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold text-ink">Précisez</span>
          <input
            type="text"
            value={other}
            maxLength={80}
            disabled={isPending}
            onChange={(event) => {
              setOther(event.target.value);
              setSaved(false);
            }}
            placeholder="Par exemple : réunions d'expression trimestrielles"
            className="h-11 rounded-lg border border-line bg-card px-3 text-ink placeholder:text-ink2"
          />
        </label>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" onClick={save} disabled={isPending || !choice}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Enregistrer
        </Button>
        {saved && (
          <span role="status" className="flex items-center gap-1.5 text-sm text-ok-text">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Enregistré.
          </span>
        )}
        {error && (
          <span role="alert" className="text-sm text-danger-text">
            {error}
          </span>
        )}
      </div>
    </fieldset>
  );
}
