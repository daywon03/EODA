import { cleanName } from "./survey-roster-service";

// ─────────────────────────────────────────────────────────────────────────────
// PERSONNE DE CONFIANCE (CASF L311-5-1) — service PUR (demande de Damon, 27/10/2026).
//
// Le DIPEC d'EODA porte, en annexe 3.2, le formulaire de désignation : la personne
// accompagnée désigne quelqu'un, qui CONTRESIGNE. Désigner est un droit, pas une
// obligation : « aucune » est un choix valable et le reste.
//   - présente : son identité remplit l'annexe 3.2 et elle cosigne sur la tablette ;
//   - absente : son identité remplit l'annexe, la cosignature reste à recueillir — la
//     tablette lui envoie le document par sa propre messagerie (feuille de partage),
//     jamais par le serveur (verrou HDS).
// Même frontière que le reste de l'accueil : rien de ceci ne quitte la tablette.
// ─────────────────────────────────────────────────────────────────────────────

export type TrustedPersonPresence = "" | "PRESENTE" | "ABSENTE";

export type TrustedPerson = {
  presence: TrustedPersonPresence; // "" : pas de personne de confiance désignée
  lastName: string;
  firstName: string;
  birthDate: string; // AAAA-MM-JJ ou vide
  birthPlace: string;
  relation: string; // « Qualité (lien avec la personne) »
  address: string;
  postalCode: string;
  city: string;
  phone: string;
  email: string;
};

export const EMPTY_TRUSTED_PERSON: TrustedPerson = {
  presence: "",
  lastName: "",
  firstName: "",
  birthDate: "",
  birthPlace: "",
  relation: "",
  address: "",
  postalCode: "",
  city: "",
  phone: "",
  email: "",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s.-]{6,20}$/;
const POSTAL_CODE = /^\d{5}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const TRUSTED_MAX_FIELD = 120;

export function isTrustedPersonDesignated(trusted: TrustedPerson | null | undefined): trusted is TrustedPerson {
  return trusted?.presence === "PRESENTE" || trusted?.presence === "ABSENTE";
}

export function trustedPersonName(trusted: TrustedPerson | null | undefined): string {
  if (!isTrustedPersonDesignated(trusted)) return "";
  return [cleanName(trusted.lastName).toLocaleUpperCase("fr-FR"), cleanName(trusted.firstName)].filter(Boolean).join(" ");
}

export function trustedPersonProblems(trusted: TrustedPerson | null): string[] {
  if (!isTrustedPersonDesignated(trusted)) return [];
  return [
    ...(cleanName(trusted.lastName) && cleanName(trusted.firstName) ? [] : ["Écrivez le nom et le prénom de la personne de confiance."]),
    // Absente, on lui envoie le formulaire : il faut de quoi le lui envoyer.
    ...(trusted.presence === "ABSENTE" && !trusted.email.trim() ? ["Écrivez l'e-mail de la personne de confiance, pour lui envoyer le formulaire à cosigner."] : []),
    ...(trusted.email && !EMAIL.test(trusted.email.trim()) ? ["L'adresse e-mail de la personne de confiance n'est pas valide."] : []),
    ...(trusted.phone && !PHONE.test(trusted.phone.trim()) ? ["Le numéro de téléphone de la personne de confiance n'est pas valide."] : []),
    ...(trusted.postalCode && !POSTAL_CODE.test(trusted.postalCode.trim()) ? ["Le code postal de la personne de confiance doit avoir 5 chiffres."] : []),
    ...(trusted.birthDate && !DAY.test(trusted.birthDate) ? ["La date de naissance de la personne de confiance n'est pas valide."] : []),
    ...(Object.values(trusted).some((v) => v.length > TRUSTED_MAX_FIELD) ? ["Un champ de la personne de confiance est trop long."] : []),
  ];
}

// Valeurs des champs `{{confiance.…}}` de l'annexe 3.2.
export const TRUSTED_FIELDS = [
  "confiance.nom",
  "confiance.naissance",
  "confiance.qualite",
  "confiance.adresse",
  "confiance.telephone",
  "confiance.email",
] as const;

export type TrustedField = (typeof TRUSTED_FIELDS)[number];

export function trustedPersonValues(trusted: TrustedPerson | null, frenchDay: (day: string) => string): Record<TrustedField, string> {
  if (!isTrustedPersonDesignated(trusted)) return Object.fromEntries(TRUSTED_FIELDS.map((f) => [f, ""])) as Record<TrustedField, string>;
  const born = [frenchDay(trusted.birthDate), cleanName(trusted.birthPlace) ? `à ${cleanName(trusted.birthPlace)}` : ""].filter(Boolean).join(" ");
  return {
    "confiance.nom": [cleanName(trusted.firstName), cleanName(trusted.lastName).toLocaleUpperCase("fr-FR")].filter(Boolean).join(" "),
    "confiance.naissance": born,
    "confiance.qualite": cleanName(trusted.relation),
    "confiance.adresse": [cleanName(trusted.address), [trusted.postalCode.trim(), cleanName(trusted.city)].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    "confiance.telephone": trusted.phone.trim(),
    "confiance.email": trusted.email.trim(),
  };
}

// Relecture défensive d'un enregistrement de la tablette (IndexedDB).
export function parseTrustedPerson(raw: unknown): TrustedPerson | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.slice(0, TRUSTED_MAX_FIELD) : "");
  const presence = o.presence === "PRESENTE" || o.presence === "ABSENTE" ? o.presence : "";
  if (!presence) return null;
  return {
    presence,
    lastName: str(o.lastName),
    firstName: str(o.firstName),
    birthDate: DAY.test(str(o.birthDate)) ? str(o.birthDate) : "",
    birthPlace: str(o.birthPlace),
    relation: str(o.relation),
    address: str(o.address),
    postalCode: str(o.postalCode),
    city: str(o.city),
    phone: str(o.phone),
    email: str(o.email),
  };
}
