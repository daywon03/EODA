"use client";

import {
  CONTACT_KIND_LABELS,
  EMPTY_CONTACT,
  type AdmissionContact,
  type AdmissionIdentity,
  type Civility,
  type ContactKind,
} from "@/lib/services/admission-service";
import type { TrustedPerson } from "@/lib/services/trusted-person-service";
import { Choices, Field } from "./admission-fields";
import { TrustedPersonFields } from "./TrustedPersonFields";

// Fiche de la personne, saisie UNE fois : elle remplit le contrat, la liste de
// l'enquête et l'index d'export. Seuls le nom de naissance et le prénom sont exigés ;
// le reste sert le DIPEC et le formulaire de désignation du Département. L'aide et
// ses heures se choisissent avec le contrat, à l'étape « Le projet ».
export function AdmissionIdentityStep({ identity, contact, trusted, onIdentity, onContact, onTrusted }: {
  identity: AdmissionIdentity;
  contact: AdmissionContact;
  trusted: TrustedPerson;
  onIdentity: (next: AdmissionIdentity) => void;
  onContact: (next: AdmissionContact) => void;
  onTrusted: (next: TrustedPerson) => void;
}) {
  const setI = (patch: Partial<AdmissionIdentity>) => onIdentity({ ...identity, ...patch });
  const setC = (patch: Partial<AdmissionContact>) => onContact({ ...contact, ...patch });

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
          <Field label="Lieu de naissance" value={identity.birthPlace} onChange={(birthPlace) => setI({ birthPlace })} />
        </div>
        <Field label="Adresse" value={identity.address} onChange={(address) => setI({ address })} />
        <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
          <Field label="Code postal" value={identity.postalCode} onChange={(postalCode) => setI({ postalCode })} inputMode="numeric" />
          <Field label="Ville" value={identity.city} onChange={(city) => setI({ city })} />
          <Field label="Téléphone" type="tel" value={identity.phone} onChange={(phone) => setI({ phone })} inputMode="tel" />
          <Field label="E-mail" type="email" value={identity.email} onChange={(email) => setI({ email })} inputMode="email" />
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

      <TrustedPersonFields trusted={trusted} onTrusted={onTrusted} />
    </div>
  );
}
