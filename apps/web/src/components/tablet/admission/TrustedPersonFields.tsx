"use client";

import { EMPTY_TRUSTED_PERSON, type TrustedPerson, type TrustedPersonPresence } from "@/lib/services/trusted-person-service";
import { Choices, Field } from "./admission-fields";

// Personne de confiance (annexe 3.2 du DIPEC). Un droit, pas une obligation :
// « aucune » se choisit. Présente, elle cosigne sur la tablette ; absente, la
// tablette lui enverra le formulaire à cosigner, par sa propre messagerie.
export function TrustedPersonFields({ trusted, onTrusted }: { trusted: TrustedPerson; onTrusted: (next: TrustedPerson) => void }) {
  const set = (patch: Partial<TrustedPerson>) => onTrusted({ ...trusted, ...patch });
  return (
    <section aria-labelledby="fiche-confiance" className="flex flex-col gap-4">
      <h2 id="fiche-confiance" className="text-[26px] font-bold">Personne de confiance</h2>
      <p className="text-[18px] text-ink2">La personne peut en désigner une (annexe 3.2 du contrat). Ce n&apos;est pas obligatoire.</p>
      <Choices<TrustedPersonPresence>
        legend="Une personne de confiance est-elle désignée ?"
        value={trusted.presence}
        onChange={(presence) => onTrusted(presence ? { ...trusted, presence } : EMPTY_TRUSTED_PERSON)}
        options={[
          { value: "", label: "Non, aucune" },
          { value: "PRESENTE", label: "Oui, elle est là" },
          { value: "ABSENTE", label: "Oui, elle n'est pas là" },
        ]}
      />
      {trusted.presence === "ABSENTE" && (
        <p className="rounded-xl bg-soft px-4 py-3 text-[18px]">Après la signature, la tablette lui enverra le contrat pour qu&apos;elle cosigne sa désignation.</p>
      )}
      {trusted.presence && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom" value={trusted.lastName} onChange={(lastName) => set({ lastName })} optional={false} />
            <Field label="Prénom" value={trusted.firstName} onChange={(firstName) => set({ firstName })} optional={false} />
            <Field label="Date de naissance" type="date" value={trusted.birthDate} onChange={(birthDate) => set({ birthDate })} />
            <Field label="Lieu de naissance" value={trusted.birthPlace} onChange={(birthPlace) => set({ birthPlace })} />
          </div>
          <Field label="Qualité (lien avec la personne)" value={trusted.relation} onChange={(relation) => set({ relation })} />
          <Field label="Adresse" value={trusted.address} onChange={(address) => set({ address })} />
          <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
            <Field label="Code postal" value={trusted.postalCode} onChange={(postalCode) => set({ postalCode })} inputMode="numeric" />
            <Field label="Ville" value={trusted.city} onChange={(city) => set({ city })} />
            <Field label="Téléphone" type="tel" value={trusted.phone} onChange={(phone) => set({ phone })} inputMode="tel" />
            <Field label="E-mail" type="email" value={trusted.email} onChange={(email) => set({ email })} inputMode="email" optional={trusted.presence !== "ABSENTE"} />
          </div>
        </>
      )}
    </section>
  );
}
