import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// ─────────────────────────────────────────────────────────────────────────────
// CODE DU SALARIÉ SUR LA TABLETTE — décision 7 des maquettes v2 : appareil enregistré
// + fiche salarié + code, blocage après 5 échecs. « Jamais un code seul » : ce code
// n'ouvre rien hors d'un appareil enregistré par la direction (garde
// requireTabletSession).
//
// Six chiffres, refus des suites évidentes. Empreinte scrypt salée (jamais le code
// en clair), comparée en temps constant. Le blocage est un fait (`lockedAt`), levé par
// la direction seulement — jamais par l'écoulement du temps.
// ─────────────────────────────────────────────────────────────────────────────

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const PIN_LENGTH = 6;
export const MAX_PIN_FAILURES = 5;
const KEY_LENGTH = 32;
const PIN_PATTERN = /^\d{6}$/;

export function pinFormatError(pin: string): string | null {
  if (!PIN_PATTERN.test(pin)) return `Le code doit faire ${PIN_LENGTH} chiffres.`;
  if (/^(\d)\1+$/.test(pin)) return "Le code ne doit pas répéter le même chiffre.";
  const digits = [...pin].map(Number);
  const steps = digits.slice(1).map((digit, i) => digit - digits[i]!);
  if (steps.every((step) => step === 1) || steps.every((step) => step === -1)) {
    return "Le code ne doit pas être une suite (123456, 654321).";
  }
  return null;
}

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pin, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function pinMatches(storedHash: string, candidate: string): Promise<boolean> {
  const [scheme, saltHex, keyHex] = storedHash.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex || !PIN_PATTERN.test(candidate)) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(candidate, Buffer.from(saltHex, "hex"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export type PinState = { failedAttempts: number; lockedAt: Date | null };
export type PinAttemptOutcome =
  | { outcome: "ACCEPTED"; next: PinState }
  | { outcome: "REJECTED"; next: PinState; remaining: number }
  | { outcome: "LOCKED"; next: PinState };

// Décide de l'issue d'une tentative. Un code bloqué reste bloqué, même juste.
export function decidePinAttempt(state: PinState, isMatch: boolean, now: Date): PinAttemptOutcome {
  if (state.lockedAt) return { outcome: "LOCKED", next: state };
  if (isMatch) return { outcome: "ACCEPTED", next: { failedAttempts: 0, lockedAt: null } };
  const failedAttempts = state.failedAttempts + 1;
  if (failedAttempts >= MAX_PIN_FAILURES) return { outcome: "LOCKED", next: { failedAttempts, lockedAt: now } };
  return { outcome: "REJECTED", next: { failedAttempts, lockedAt: null }, remaining: MAX_PIN_FAILURES - failedAttempts };
}

// Déblocage par la direction : compteur remis à zéro.
export function unlockedPinState(): PinState {
  return { failedAttempts: 0, lockedAt: null };
}
