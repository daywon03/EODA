import { createHmac, timingSafeEqual } from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────────
// SESSION TABLETTE — jeton signé (HMAC-SHA256) porté par un cookie httpOnly.
//
// Il dit « tel salarié, sur tel appareil enregistré, jusqu'à telle heure » et rien
// d'autre (S3 : identifiants, type, durée — jamais l'objet complet). Court : une
// tournée, pas une journée (`TABLET_SESSION_MINUTES`). Le type est dans la charge
// utile et vérifié : un autre jeton signé avec le même secret ne s'y substitue pas.
// La garde relit à chaque requête l'appareil (révoqué ?), le salarié (actif ?) et
// le code (bloqué ?) : le jeton seul n'ouvre rien.
// ─────────────────────────────────────────────────────────────────────────────

export const TABLET_SESSION_COOKIE = "eoda_tablet_session";
export const DEVICE_COOKIE = "eoda_device";
export const TABLET_SESSION_MINUTES = 30;
const TOKEN_TYPE = "tablet";

export type TabletSessionClaims = { staffMemberId: string; deviceEnrollmentId: string; expiresAt: number };

function sign(payload: string, secret: string): string {
  return createHmac("sha256", `${secret}:tablet-session`).update(payload).digest("base64url");
}

export function createTabletSessionToken(claims: TabletSessionClaims, secret: string): string {
  const payload = Buffer.from(JSON.stringify({ t: TOKEN_TYPE, ...claims })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

function isClaims(value: unknown): value is TabletSessionClaims & { t: string } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.t === TOKEN_TYPE &&
    typeof v.staffMemberId === "string" &&
    typeof v.deviceEnrollmentId === "string" &&
    typeof v.expiresAt === "number"
  );
}

export function readTabletSessionToken(token: string | undefined, secret: string, now: Date): TabletSessionClaims | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!isClaims(parsed) || parsed.expiresAt <= now.getTime()) return null;
  return { staffMemberId: parsed.staffMemberId, deviceEnrollmentId: parsed.deviceEnrollmentId, expiresAt: parsed.expiresAt };
}

export function tabletSessionExpiry(now: Date): number {
  return now.getTime() + TABLET_SESSION_MINUTES * 60 * 1000;
}
