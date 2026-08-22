// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION DES ENTRÉES — parseurs purs, sans dépendance framework ni Prisma
//
// Toute valeur issue d'un FormData ou d'un argument d'action serveur est une
// entrée non fiable, même quand le formulaire côté client est un <select> : une
// action serveur est une route HTTP publique, appelable directement.
//
// Ces parseurs remplacent les casts `formData.get("x") as "A" | "B"`, qui ne
// valident rien à l'exécution et laissent passer une valeur arbitraire jusqu'à
// Prisma (exception non gérée → 500, message technique fuité côté client).
//
// Volontairement sans dépendance externe (pas de Zod) : le besoin est couvert par
// une poignée de parseurs typés, et l'enum Prisma sert déjà de source de vérité
// pour les valeurs admissibles (Open/Closed — une valeur ajoutée au schéma est
// acceptée sans toucher ce fichier).
// ─────────────────────────────────────────────────────────────────────────────

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function ok<T>(value: T): ParseResult<T> {
  return { ok: true, value };
}

export function fail<T>(error: string): ParseResult<T> {
  return { ok: false, error };
}

function raw(formData: FormData, field: string): string | null {
  const value = formData.get(field);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Chaîne obligatoire, bornée en longueur — la borne évite qu'un champ libre serve
// de vecteur de saturation (stockage, coût de tokens LLM en aval).
export function requiredString(
  formData: FormData,
  field: string,
  label: string,
  maxLength = 500
): ParseResult<string> {
  const value = raw(formData, field);
  if (!value) return fail(`${label} est obligatoire.`);
  if (value.length > maxLength) {
    return fail(`${label} ne peut pas dépasser ${maxLength} caractères.`);
  }
  return ok(value);
}

export function optionalString(
  formData: FormData,
  field: string,
  label: string,
  maxLength = 2000
): ParseResult<string | null> {
  const value = raw(formData, field);
  if (!value) return ok(null);
  if (value.length > maxLength) {
    return fail(`${label} ne peut pas dépasser ${maxLength} caractères.`);
  }
  return ok(value);
}

// Appartenance à un enum Prisma. `allowed` est l'objet enum exporté par
// @eoda/database (ex: `UserRole`), donc toujours aligné sur le schéma.
export function requiredEnum<T extends string>(
  formData: FormData,
  field: string,
  label: string,
  allowed: Record<string, T>
): ParseResult<T> {
  const value = raw(formData, field);
  if (!value) return fail(`${label} est obligatoire.`);
  const values = Object.values(allowed) as string[];
  if (!values.includes(value)) return fail(`${label} a une valeur invalide.`);
  return ok(value as T);
}

export function optionalEnum<T extends string>(
  formData: FormData,
  field: string,
  label: string,
  allowed: Record<string, T>
): ParseResult<T | null> {
  const value = raw(formData, field);
  if (!value) return ok(null);
  const values = Object.values(allowed) as string[];
  if (!values.includes(value)) return fail(`${label} a une valeur invalide.`);
  return ok(value as T);
}

// Vérifie l'appartenance d'une valeur déjà reçue comme argument d'action (pas via
// FormData) — même exigence : un argument d'action serveur n'est pas fiable.
export function isEnumValue<T extends string>(
  value: unknown,
  allowed: Record<string, T>
): value is T {
  return typeof value === "string" && (Object.values(allowed) as string[]).includes(value);
}

// Entier borné. Rejette NaN explicitement : `Number("abc")` vaut NaN et passe
// silencieusement jusqu'à Prisma sinon.
export function requiredInt(
  formData: FormData,
  field: string,
  label: string,
  options: { min?: number; max?: number; defaultValue?: number } = {}
): ParseResult<number> {
  const { min, max, defaultValue } = options;
  const value = raw(formData, field);

  if (!value) {
    if (defaultValue !== undefined) return ok(defaultValue);
    return fail(`${label} est obligatoire.`);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return fail(`${label} doit être un nombre entier.`);
  }
  if (min !== undefined && parsed < min) return fail(`${label} doit être supérieur ou égal à ${min}.`);
  if (max !== undefined && parsed > max) return fail(`${label} doit être inférieur ou égal à ${max}.`);

  return ok(parsed);
}

export function optionalInt(
  formData: FormData,
  field: string,
  label: string,
  options: { min?: number; max?: number } = {}
): ParseResult<number | null> {
  const value = raw(formData, field);
  if (!value) return ok(null);
  const parsed = requiredInt(formData, field, label, options);
  return parsed.ok ? ok(parsed.value) : fail(parsed.error);
}

// Date obligatoire — rejette une date invalide (`new Date("zzz")` produit
// Invalid Date, que Prisma refuse ensuite avec une erreur technique).
export function requiredDate(
  formData: FormData,
  field: string,
  label: string
): ParseResult<Date> {
  const value = raw(formData, field);
  if (!value) return fail(`${label} est obligatoire.`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fail(`${label} n'est pas une date valide.`);
  return ok(parsed);
}

export function optionalDate(
  formData: FormData,
  field: string,
  label: string
): ParseResult<Date | null> {
  const value = raw(formData, field);
  if (!value) return ok(null);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fail(`${label} n'est pas une date valide.`);
  return ok(parsed);
}

// Validation d'adresse email volontairement permissive sur la forme (pas de
// regex exhaustive RFC, source de faux négatifs) mais stricte sur ce qui compte
// pour la création de compte : une seule arobase, pas d'espace, un domaine pointé.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

export function requiredEmail(
  formData: FormData,
  field: string,
  label: string
): ParseResult<string> {
  const parsed = requiredString(formData, field, label, 254);
  if (!parsed.ok) return parsed;
  // Normalisation en minuscules — l'unicité de User.email est sensible à la casse
  // en base : sans ça, "A@x.fr" et "a@x.fr" créent deux comptes distincts.
  const normalized = parsed.value.toLowerCase();
  if (!EMAIL_SHAPE.test(normalized)) return fail(`${label} n'est pas une adresse email valide.`);
  return ok(normalized);
}

// Agrège plusieurs ParseResult : renvoie la première erreur rencontrée, sinon
// laisse l'appelant utiliser les valeurs déjà validées.
export function firstError(...results: ParseResult<unknown>[]): string | null {
  for (const result of results) {
    if (!result.ok) return result.error;
  }
  return null;
}
