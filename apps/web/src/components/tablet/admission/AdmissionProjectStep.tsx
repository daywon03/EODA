"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DipcCheckField, DipcDurationChoice, DipcFreeField } from "@/lib/services/dipc-tablet-preparation";
import type { AdmissionAid, DipcDuration } from "@/lib/services/admission-service";
import { TABLET_CHOICE_OFF, TABLET_CHOICE_ON, TABLET_INPUT } from "../tablet-ui";
import { AdmissionAidFields } from "./AdmissionAidFields";

// Les zones « [à compléter] », les cases « ☐ » et le choix de durée du DIPEC de la
// structure, remplis sur la tablette (copie préparée par dipc-tablet-preparation).
// Une zone de texte laissée vide reste une ligne à compléter à la main ; la durée,
// elle, se choisit toujours quand le DIPEC en propose une. L'aide et ses heures se
// choisissent ici, avec le contrat : elles vont aussi au formulaire du Département.
export function AdmissionProjectStep({ aid, onAid, freeFields, checkFields, durationChoice, duration, onDuration, texts, checks, onText, onCheck }: {
  aid: AdmissionAid;
  onAid: (next: AdmissionAid) => void;
  freeFields: readonly DipcFreeField[];
  checkFields: readonly DipcCheckField[];
  durationChoice: DipcDurationChoice | null;
  duration: DipcDuration;
  onDuration: (next: DipcDuration) => void;
  texts: Record<string, string>;
  checks: Record<string, boolean>;
  onText: (id: string, value: string) => void;
  onCheck: (id: string, value: boolean) => void;
}) {
  const filled = freeFields.filter((f) => (texts[f.id] ?? "").trim()).length;
  const chosen = durationChoice?.options.find((o) => o.number === duration.choice);
  return (
    <div className="flex max-w-[860px] flex-col gap-7">
      <AdmissionAidFields aid={aid} onAid={onAid} />
      {freeFields.length === 0 && checkFields.length === 0 && !durationChoice && (
        <p className="text-[19px]">Le DIPEC de la structure n&apos;a rien d&apos;autre à compléter ici.</p>
      )}
      {durationChoice && (
        <section aria-labelledby="projet-duree" className="flex flex-col gap-2.5">
          <h2 id="projet-duree" className="text-[24px] font-bold">Durée du contrat</h2>
          {durationChoice.options.map((option) => (
            <button
              key={option.number}
              type="button"
              aria-pressed={duration.choice === option.number}
              onClick={() => onDuration({ ...duration, choice: option.number })}
              className={cn("min-h-[64px] rounded-xl border-2 px-4 py-2 text-left text-[19px]", duration.choice === option.number ? TABLET_CHOICE_ON : TABLET_CHOICE_OFF)}
            >
              <span className="font-bold">Option n°{option.number}</span> — {option.label.replace(/\s*du JJ\/MM\/AAAA au JJ\/MM\/AAAA/, "")}
            </button>
          ))}
          {chosen?.hasDates && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-[19px] font-bold">
                Du
                <input type="date" value={duration.start} onChange={(e) => onDuration({ ...duration, start: e.target.value })} className={TABLET_INPUT} />
              </label>
              <label className="flex flex-col gap-1.5 text-[19px] font-bold">
                Au
                <input type="date" value={duration.end} onChange={(e) => onDuration({ ...duration, end: e.target.value })} className={TABLET_INPUT} />
              </label>
            </div>
          )}
        </section>
      )}

      {freeFields.length > 0 && (
        <p className="text-[19px]">
          Écrivez avec la personne ce que le contrat demande. Une zone laissée vide restera à compléter à la main.
          <span className="ml-2 tabular-nums font-bold">{filled} sur {freeFields.length}</span>
        </p>
      )}
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
