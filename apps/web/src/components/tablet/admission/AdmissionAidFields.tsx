"use client";

import { cn } from "@/lib/utils";
import { AID_KIND_LABELS, type AdmissionAid, type AidKind } from "@/lib/services/admission-service";
import { TABLET_CHOICE_OFF, TABLET_CHOICE_ON } from "../tablet-ui";
import { CHOICE, Field } from "./admission-fields";

// L'aide et ses heures se choisissent AVEC le contrat (27/10/2026, demande de Damon :
// « les champs choisis dans le contrat doivent aller directement dans le formulaire »).
// Un seul choix, trois places : l'article 3.4 du DIPEC (rythme convenu), le
// formulaire du Département (« Bénéficiaire de l'aide suivante », « Pour l'APA,
// préciser ») et l'index d'export.
export function AdmissionAidFields({ aid, onAid }: { aid: AdmissionAid; onAid: (next: AdmissionAid) => void }) {
  const setA = (patch: Partial<AdmissionAid>) => onAid({ ...aid, ...patch });
  const toggle = (kind: AidKind) => setA({ kinds: aid.kinds.includes(kind) ? aid.kinds.filter((k) => k !== kind) : [...aid.kinds, kind] });
  return (
    <section aria-labelledby="projet-aide" className="flex flex-col gap-4">
      <h2 id="projet-aide" className="text-[24px] font-bold">L&apos;aide et le rythme</h2>
      <p className="text-[18px] text-ink2">Écrit dans le contrat (article 3.4) et dans le formulaire du Département.</p>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[19px] font-bold">
          Bénéficiaire de l&apos;aide suivante <span className="font-normal text-ink2">(facultatif)</span>
        </legend>
        <div className="flex flex-wrap gap-3">
          {(Object.keys(AID_KIND_LABELS) as AidKind[]).map((kind) => (
            <button key={kind} type="button" aria-pressed={aid.kinds.includes(kind)} onClick={() => toggle(kind)} className={cn(CHOICE, aid.kinds.includes(kind) ? TABLET_CHOICE_ON : TABLET_CHOICE_OFF)}>
              {AID_KIND_LABELS[kind]}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Début de l'accompagnement" type="date" value={aid.startDate} onChange={(startDate) => setA({ startDate })} />
        <Field label="Heures par mois en semaine" value={aid.weekdayHours} onChange={(weekdayHours) => setA({ weekdayHours })} inputMode="decimal" />
        <Field label="Heures par mois le dimanche" value={aid.sundayHours} onChange={(sundayHours) => setA({ sundayHours })} inputMode="decimal" />
      </div>
    </section>
  );
}
