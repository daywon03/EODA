"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DipcCheckField, DipcFreeField } from "@/lib/services/dipc-tablet-preparation";

// Les zones « [à compléter] » et les cases « ☐ » du DIPC de la structure, remplies
// sur la tablette (copie préparée par dipc-tablet-preparation). Rien n'est imposé :
// une zone laissée vide reste une ligne à compléter à la main dans le contrat.
export function AdmissionProjectStep({ freeFields, checkFields, texts, checks, onText, onCheck }: {
  freeFields: readonly DipcFreeField[];
  checkFields: readonly DipcCheckField[];
  texts: Record<string, string>;
  checks: Record<string, boolean>;
  onText: (id: string, value: string) => void;
  onCheck: (id: string, value: boolean) => void;
}) {
  const filled = freeFields.filter((f) => (texts[f.id] ?? "").trim()).length;
  if (freeFields.length === 0 && checkFields.length === 0) {
    return <p className="text-[19px]">Le DIPC de la structure n&apos;a rien à compléter ici.</p>;
  }
  return (
    <div className="flex max-w-[860px] flex-col gap-7">
      <p className="text-[19px]">
        Écrivez avec la personne ce que le contrat demande. Une zone laissée vide restera à compléter à la main.
        <span className="ml-2 tabular-nums font-bold">{filled} sur {freeFields.length}</span>
      </p>
      {freeFields.map((field) => (
        <label key={field.id} className="flex flex-col gap-1.5 text-[19px] font-bold">
          {field.label}
          {field.hint && <span className="text-[17px] font-normal text-ink2">{field.hint}</span>}
          <textarea
            value={texts[field.id] ?? ""}
            onChange={(e) => onText(field.id, e.target.value)}
            rows={3}
            maxLength={1500}
            className="w-full rounded-xl border-2 border-muted bg-card px-4 py-3 text-[19px] font-normal text-ink"
          />
        </label>
      ))}
      {checkFields.length > 0 && (
        <section aria-labelledby="projet-cases" className="flex flex-col gap-2.5">
          <h2 id="projet-cases" className="text-[24px] font-bold">Cases du contrat</h2>
          {checkFields.map((field) => {
            const on = Boolean(checks[field.id]);
            return (
              <button key={field.id} type="button" role="checkbox" aria-checked={on} onClick={() => onCheck(field.id, !on)} className={cn("flex min-h-[64px] w-full items-center gap-3.5 rounded-xl border-2 px-3.5 py-2 text-left text-[19px]", on ? "border-ok-text bg-ok-soft" : "border-line bg-card")}>
                <span className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border-2", on ? "border-ok-text bg-green-fill" : "border-muted bg-card")}>
                  {on && <Check className="h-5 w-5" aria-hidden="true" />}
                </span>
                {field.label}
              </button>
            );
          })}
        </section>
      )}
    </div>
  );
}
