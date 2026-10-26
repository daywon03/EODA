"use client";

import { cn } from "@/lib/utils";
import {
  AID_KIND_LABELS,
  CONTACT_KIND_LABELS,
  EMPTY_CONTACT,
  type AdmissionAid,
  type AdmissionContact,
  type AdmissionIdentity,
  type AidKind,
  type Civility,
  type ContactKind,
} from "@/lib/services/admission-service";
import { TABLET_CHOICE_OFF, TABLET_CHOICE_ON, TABLET_INPUT } from "../tablet-ui";

// Fiche de la personne, saisie UNE fois : elle remplit le contrat, la liste de
// l'enquête et l'index d'export. Seuls le nom de naissance et le prénom sont exigés ;
// le reste sert le DIPC et le formulaire de désignation du Département.

const LABEL = "flex flex-col gap-1.5 text-[19px] font-bold";
const CHOICE = "min-h-[60px] rounded-xl border-2 px-5 text-[19px] font-bold";

function Field({ label, value, onChange, type = "text", optional = true, autoComplete = "off", inputMode }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  optional?: boolean;
  autoComplete?: string;
  inputMode?: "numeric" | "tel" | "email" | "decimal";
}) {
  return (
    <label className={LABEL}>
      <span>
        {label}
        {optional && <span className="font-normal text-ink2"> (facultatif)</span>}
      </span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={TABLET_INPUT} autoComplete={autoComplete} inputMode={inputMode} maxLength={120} />
    </label>
  );
}

function Choices<T extends string>({ legend, options, value, onChange }: { legend: string; options: { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
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

export function AdmissionIdentityStep({ identity, aid, contact, onIdentity, onAid, onContact }: {
  identity: AdmissionIdentity;
  aid: AdmissionAid;
  contact: AdmissionContact;
  onIdentity: (next: AdmissionIdentity) => void;
  onAid: (next: AdmissionAid) => void;
  onContact: (next: AdmissionContact) => void;
}) {
  const setI = (patch: Partial<AdmissionIdentity>) => onIdentity({ ...identity, ...patch });
  const setA = (patch: Partial<AdmissionAid>) => onAid({ ...aid, ...patch });
  const setC = (patch: Partial<AdmissionContact>) => onContact({ ...contact, ...patch });
  const toggleAid = (kind: AidKind) => setA({ kinds: aid.kinds.includes(kind) ? aid.kinds.filter((k) => k !== kind) : [...aid.kinds, kind] });

  return (
    <div className="flex max-w-[860px] flex-col gap-8">
      <section aria-labelledby="fiche-personne" className="flex flex-col gap-4">
        <h2 id="fiche-personne" className="text-[26px] font-bold">La personne</h2>
        <Choices<Civility>
          legend="Civilité"
          value={identity.civility}
          onChange={(civility) => setI({ civility })}
          options={[{ value: "MADAME", label: "Madame" }, { value: "MONSIEUR", label: "Monsieur" }, { value: "", label: "Ne pas préciser" }]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom de naissance" value={identity.birthName} onChange={(birthName) => setI({ birthName })} optional={false} />
          <Field label="Nom d'usage (d'époux ou d'épouse)" value={identity.usedName} onChange={(usedName) => setI({ usedName })} />
          <Field label="Prénom" value={identity.firstName} onChange={(firstName) => setI({ firstName })} optional={false} />
          <Field label="Date de naissance" type="date" value={identity.birthDate} onChange={(birthDate) => setI({ birthDate })} />
        </div>
        <Field label="Adresse" value={identity.address} onChange={(address) => setI({ address })} />
        <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
          <Field label="Code postal" value={identity.postalCode} onChange={(postalCode) => setI({ postalCode })} inputMode="numeric" />
          <Field label="Ville" value={identity.city} onChange={(city) => setI({ city })} />
          <Field label="Téléphone" type="tel" value={identity.phone} onChange={(phone) => setI({ phone })} inputMode="tel" />
          <Field label="E-mail" type="email" value={identity.email} onChange={(email) => setI({ email })} inputMode="email" />
        </div>
      </section>

      <section aria-labelledby="fiche-aide" className="flex flex-col gap-4">
        <h2 id="fiche-aide" className="text-[26px] font-bold">L&apos;aide prévue</h2>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[19px] font-bold">Aide(s) <span className="font-normal text-ink2">(facultatif)</span></legend>
          <div className="flex flex-wrap gap-3">
            {(Object.keys(AID_KIND_LABELS) as AidKind[]).map((kind) => (
              <button key={kind} type="button" aria-pressed={aid.kinds.includes(kind)} onClick={() => toggleAid(kind)} className={cn(CHOICE, aid.kinds.includes(kind) ? TABLET_CHOICE_ON : TABLET_CHOICE_OFF)}>
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

      <section aria-labelledby="fiche-proche" className="flex flex-col gap-4">
        <h2 id="fiche-proche" className="text-[26px] font-bold">Proche à contacter ou représentant légal</h2>
        <Choices<ContactKind | "">
          legend="Qui ?"
          value={contact.kind}
          onChange={(kind) => onContact(kind ? { ...contact, kind, otherPrecision: kind === "AUTRE" ? contact.otherPrecision : "" } : EMPTY_CONTACT)}
          options={[{ value: "", label: "Personne" }, ...(Object.keys(CONTACT_KIND_LABELS) as ContactKind[]).map((k) => ({ value: k, label: CONTACT_KIND_LABELS[k] }))]}
        />
        {(contact.kind === "TUTEUR" || contact.kind === "CURATEUR") && (
          <p className="rounded-xl bg-soft px-4 py-3 text-[18px]">
            {contact.kind === "TUTEUR" ? "Sous tutelle, c'est le tuteur qui signe le contrat." : "Sous curatelle, la personne signe, et son curateur signe aussi."}
          </p>
        )}
        {contact.kind && (
          <>
            {contact.kind === "AUTRE" && <Field label="Lien avec la personne" value={contact.otherPrecision} onChange={(otherPrecision) => setC({ otherPrecision })} optional={false} />}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom" value={contact.lastName} onChange={(lastName) => setC({ lastName })} optional={false} />
              <Field label="Prénom" value={contact.firstName} onChange={(firstName) => setC({ firstName })} />
            </div>
            <Field label="Adresse" value={contact.address} onChange={(address) => setC({ address })} />
            <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
              <Field label="Code postal" value={contact.postalCode} onChange={(postalCode) => setC({ postalCode })} inputMode="numeric" />
              <Field label="Ville" value={contact.city} onChange={(city) => setC({ city })} />
              <Field label="Téléphone" type="tel" value={contact.phone} onChange={(phone) => setC({ phone })} inputMode="tel" />
              <Field label="E-mail" type="email" value={contact.email} onChange={(email) => setC({ email })} inputMode="email" />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
