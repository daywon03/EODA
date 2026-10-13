import type { CommercialTier, EstablishmentType, StructureType } from "@eoda/database";
import { finessFormatError, normaliseFiness } from "./structure-identity-service";
import { isEmailShaped } from "@/lib/validation/form-parsers";
import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH } from "@/lib/security/password-policy";

// ─────────────────────────────────────────────────────────────────────────────
// INSCRIPTION EN LIBRE-SERVICE — règles pures (D5, décision 1 du plan v2, 13/10/2026).
//
// Une inscription crée un PROSPECT (canal LIBRE_SERVICE) et un compte rattaché —
// jamais un établissement : la fiche ne naît que de la signature d'un devis
// (CLAUDE.md §7). Les entrées arrivent d'une route PUBLIQUE : tout est validé ici,
// borné, et rien n'est casté.
// ─────────────────────────────────────────────────────────────────────────────

// Réponse IDENTIQUE que l'adresse ait déjà un compte ou non (pas d'énumération des
// comptes, S9) : seul l'e-mail reçu diffère.
export const SIGNUP_NEUTRAL_MESSAGE =
  "C'est noté. Si un espace peut être créé avec cette adresse, vous recevez un e-mail dans quelques minutes. Cliquez sur le lien qu'il contient pour confirmer votre adresse : votre espace s'ouvre ensuite avec votre adresse et votre mot de passe.";

export const SIGNUP_CLOSED_MESSAGE = "L'inscription en ligne n'est pas ouverte pour le moment. Écrivez-nous, nous vous rappelons.";
export const SIGNUP_RATE_LIMITED_MESSAGE = "Trop de demandes depuis votre connexion. Réessayez dans une heure.";

// Offres proposées à l'inscription (décision 2 du plan v2) : Essentiel et
// Performance seuls, Excellence avec EODA. Prix : « à partir de xx € / mois » tant
// qu'ils ne sont pas fixés (décision 11) — le montant vient du catalogue, jamais d'ici.
export const SELF_SERVICE_FORMULES = ["ESSENTIEL", "PERFORMANCE", "EXCELLENCE"] as const satisfies readonly CommercialTier[];
export type SelfServiceFormule = (typeof SELF_SERVICE_FORMULES)[number];

export const SELF_SERVICE_OFFERS: Record<
  SelfServiceFormule,
  { name: string; who: string; short: string; what: string; items: readonly string[]; cta: string }
> = {
  ESSENTIEL: {
    name: "Essentiel",
    who: "Seul",
    short: "Les critères impératifs et les 7 documents de la loi 2002-2. Rapport et plan d'action.",
    what: "Vous faites le diagnostic vous-même, avec la plateforme.",
    items: ["Les critères impératifs de votre service", "Les 7 documents de la loi 2002-2", "Rapport de diagnostic et plan d'action"],
    cta: "Choisir Essentiel",
  },
  PERFORMANCE: {
    name: "Performance",
    who: "Seul",
    short: "Tous les critères qui s'appliquent à votre service. Tous vos documents analysés.",
    what: "Toute votre organisation passée en revue. Vous faites la mise en conformité.",
    items: ["Tous les critères applicables à votre service", "Analyse de tous vos documents", "Plan d'action suivi"],
    cta: "Choisir Performance",
  },
  EXCELLENCE: {
    name: "Excellence",
    who: "Avec EODA",
    short: "Tous les critères. EODA met vos documents en conformité avec vous.",
    what: "EODA relit, corrige et valide chaque document avec vous.",
    items: ["Tout ce que fait la plateforme", "Mise en conformité faite par EODA", "Relecture humaine de chaque document"],
    cta: "Demander un accompagnement",
  },
};

// Offre demandée dans l'adresse (?offre=…) : entrée non fiable, jamais castée.
export function parseSelfServiceFormule(raw: unknown): SelfServiceFormule | null {
  return SELF_SERVICE_FORMULES.find((f) => f === raw) ?? null;
}

export const STRUCTURE_TYPES = ["ASSOCIATION", "PRIVE", "PUBLIC"] as const satisfies readonly StructureType[];
export const ESTABLISHMENT_TYPES = ["SAD_AIDE", "SAD_MIXTE"] as const satisfies readonly EstablishmentType[];

export type SignupInput = {
  structureName: string;
  structureType: StructureType;
  establishmentType: EstablishmentType;
  finessNumber: string | null;
  formule: SelfServiceFormule;
  firstName: string;
  email: string;
  password: string;
};

export type SignupCheck = { ok: true; value: SignupInput } | { ok: false; error: string };

function text(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

function oneOf<T extends string>(raw: unknown, values: readonly T[]): T | null {
  return typeof raw === "string" && (values as readonly string[]).includes(raw) ? (raw as T) : null;
}

function checkPassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`;
  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) return `Le mot de passe est trop long (${MAX_PASSWORD_BYTES} octets au plus).`;
  return null;
}

// Les trois étapes, vérifiées ensemble côté serveur : le navigateur peut sauter une
// étape, le serveur ne la saute jamais. Le premier problème rencontré est rendu, en
// mots simples.
export function validateSignupInput(raw: Record<string, unknown>): SignupCheck {
  const structureName = text(raw.structureName);
  if (structureName.length < 2 || structureName.length > 200) return { ok: false, error: "Écrivez le nom de votre structure." };
  const establishmentType = oneOf(raw.establishmentType, ESTABLISHMENT_TYPES);
  if (!establishmentType) return { ok: false, error: "Choisissez le type de service : SAD Aide ou SAD Mixte." };
  const structureType = oneOf(raw.structureType, STRUCTURE_TYPES);
  if (!structureType) return { ok: false, error: "Choisissez le statut de la structure : association, privé ou public." };
  const finessNumber = normaliseFiness(text(raw.finessNumber) || null);
  const finessError = finessFormatError(finessNumber);
  if (finessError) return { ok: false, error: finessError };
  const formule = oneOf(raw.formule, SELF_SERVICE_FORMULES);
  if (!formule) return { ok: false, error: "Choisissez une offre." };
  const firstName = text(raw.firstName);
  if (firstName.length < 1 || firstName.length > 100) return { ok: false, error: "Écrivez votre prénom." };
  const email = text(raw.email).toLowerCase();
  if (!isEmailShaped(email)) return { ok: false, error: "Votre adresse e-mail n'est pas valide." };
  const password = typeof raw.password === "string" ? raw.password : "";
  const passwordError = checkPassword(password);
  if (passwordError) return { ok: false, error: passwordError };

  return { ok: true, value: { structureName, structureType, establishmentType, finessNumber, formule, firstName, email, password } };
}

// L'inscription publique rattache le prospect au SEUL cabinet de la base. Tant que le
// multi-cabinet n'existe pas, un nombre de tenants différent de 1 ferme l'inscription
// (fail-closed) : deviner un cabinet enverrait une structure chez le mauvais.
export function resolveSignupTenant(tenantIds: readonly string[]): string | null {
  return tenantIds.length === 1 ? tenantIds[0]! : null;
}

// Clés de limitation de débit : l'IP, ET l'adresse demandée (S8 : « indexée sur autre
// chose que la seule IP »). L'adresse n'est jamais journalisée (attempt-throttle).
export const SIGNUP_IP_RATE_LIMIT = { limit: 5, windowSeconds: 60 * 60 };
export const SIGNUP_EMAIL_RATE_LIMIT = { limit: 3, windowSeconds: 24 * 60 * 60 };

export function signupThrottleKeys(ip: string, email: string): { ip: string; email: string } {
  return { ip: `signup:ip:${ip}`, email: `signup:email:${email.trim().toLowerCase()}` };
}
