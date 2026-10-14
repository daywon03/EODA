"use server";

import { prisma } from "@eoda/database";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireEstablishmentAccess, resolveTabletDevice, type EstablishmentAccessContext } from "@/lib/auth/guards";
import { NEED } from "@/lib/auth/capabilities";
import { getEnv } from "@/lib/config/env";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { generateOneTimeToken, hashOneTimeToken } from "@/lib/security/one-time-token";
import { decidePinAttempt, hashPin, pinFormatError, pinMatches, unlockedPinState } from "@/lib/security/tablet-pin";
import { createTabletSessionToken, DEVICE_COOKIE, TABLET_SESSION_COOKIE, TABLET_SESSION_MINUTES, tabletSessionExpiry } from "@/lib/security/tablet-session";
import { requiredString } from "@/lib/validation/form-parsers";

// ─────────────────────────────────────────────────────────────────────────────
// TABLETTE — appareils, codes, connexion (lot C, décision 7). Données de SALARIÉS,
// hors verrou HDS.
//
// Côté portail (direction / responsable qualité, TERRAIN_WRITE) : enregistrer CET
// appareil, retirer un appareil, poser le code d'un salarié, débloquer un code.
// Côté tablette : connexion = appareil enregistré + salarié + code ; 5 échecs
// bloquent le code jusqu'au déblocage par la direction. Journalisé sans nom ni code.
// ─────────────────────────────────────────────────────────────────────────────

type Result = { error: string } | { ok: true };
const DEVICE_COOKIE_DAYS = 365;
const TABLET_PATHS = ["/dashboard/client/personnes", "/tablette"];

function revalidateTablet(): void {
  for (const path of TABLET_PATHS) revalidatePath(path);
}

async function requireTerrainWriter(establishmentId: unknown): Promise<EstablishmentAccessContext & { tenantId: string }> {
  if (typeof establishmentId !== "string" || establishmentId.length === 0) notFound();
  const access = await requireEstablishmentAccess(establishmentId, NEED.TERRAIN_WRITE);
  // Les appareils et les codes sont gérés par la STRUCTURE (elle seule a les
  // tablettes en main) : le cabinet les voit, il ne les pose pas.
  if (!access.isClient) notFound();
  const row = await prisma.establishment.findUniqueOrThrow({ where: { id: access.establishmentId }, select: { tenantId: true } });
  return { ...access, tenantId: row.tenantId };
}

function secureCookie(maxAgeSeconds: number) {
  return { httpOnly: true, secure: getEnv().isProduction, sameSite: "strict" as const, path: "/", maxAge: maxAgeSeconds };
}

export type TabletAdminView = {
  devices: { id: string; label: string; enrolledAt: Date; isThisDevice: boolean }[];
  staff: { id: string; displayName: string; jobTitle: string; pin: "AUCUN" | "ACTIF" | "BLOQUE" }[];
};

export async function getTabletAdmin(establishmentId: string): Promise<TabletAdminView> {
  const access = await requireEstablishmentAccess(establishmentId, NEED.TERRAIN_READ);
  const thisDevice = await resolveTabletDevice();
  const [devices, staff] = await Promise.all([
    prisma.deviceEnrollment.findMany({
      where: { establishmentId: access.establishmentId, revokedAt: null },
      select: { id: true, label: true, enrolledAt: true },
      orderBy: { enrolledAt: "asc" },
    }),
    prisma.staffMember.findMany({
      where: { establishmentId: access.establishmentId, active: true },
      select: { id: true, displayName: true, jobTitle: true, pin: { select: { lockedAt: true } } },
      orderBy: { displayName: "asc" },
    }),
  ]);
  return {
    devices: devices.map((d) => ({ ...d, isThisDevice: thisDevice?.deviceEnrollmentId === d.id })),
    staff: staff.map((s) => ({
      id: s.id,
      displayName: s.displayName,
      jobTitle: s.jobTitle,
      pin: !s.pin ? "AUCUN" : s.pin.lockedAt ? "BLOQUE" : "ACTIF",
    })),
  };
}

export async function enrollThisDevice(formData: FormData): Promise<Result> {
  const access = await requireTerrainWriter(formData.get("establishmentId"));
  const label = requiredString(formData, "label", "Le nom de la tablette", 60);
  if (!label.ok) return { error: label.error };
  const token = generateOneTimeToken();
  const device = await prisma.deviceEnrollment.create({
    data: {
      tenantId: access.tenantId,
      establishmentId: access.establishmentId,
      label: label.value,
      tokenHash: hashOneTimeToken(token),
      enrolledByUserId: access.userId,
    },
    select: { id: true },
  });
  (await cookies()).set(DEVICE_COOKIE, token, secureCookie(DEVICE_COOKIE_DAYS * 24 * 60 * 60));
  await recordAuditEvent({ action: "DEVICE_ENROLLED", actorUserId: access.userId, actorRole: access.session.user.role, establishmentId: access.establishmentId, targetId: device.id });
  revalidateTablet();
  return { ok: true };
}

export async function revokeDevice(formData: FormData): Promise<Result> {
  const access = await requireTerrainWriter(formData.get("establishmentId"));
  const deviceId = String(formData.get("deviceId") ?? "");
  const updated = await prisma.deviceEnrollment.updateMany({
    where: { id: deviceId, establishmentId: access.establishmentId, revokedAt: null },
    data: { revokedAt: new Date(), revokedByUserId: access.userId },
  });
  if (updated.count === 0) return { error: "Tablette introuvable." };
  await recordAuditEvent({ action: "DEVICE_REVOKED", actorUserId: access.userId, actorRole: access.session.user.role, establishmentId: access.establishmentId, targetId: deviceId });
  revalidateTablet();
  return { ok: true };
}

async function staffOf(access: { establishmentId: string }, staffMemberId: unknown): Promise<{ id: string } | null> {
  if (typeof staffMemberId !== "string") return null;
  return prisma.staffMember.findFirst({ where: { id: staffMemberId, establishmentId: access.establishmentId, active: true }, select: { id: true } });
}

export async function setStaffPin(formData: FormData): Promise<Result> {
  const access = await requireTerrainWriter(formData.get("establishmentId"));
  const staff = await staffOf(access, formData.get("staffMemberId"));
  if (!staff) return { error: "Salarié introuvable." };
  const pin = String(formData.get("pin") ?? "");
  const formatError = pinFormatError(pin);
  if (formatError) return { error: formatError };
  const pinHash = await hashPin(pin);
  await prisma.staffPin.upsert({
    where: { staffMemberId: staff.id },
    create: { staffMemberId: staff.id, pinHash, setByUserId: access.userId },
    update: { pinHash, setByUserId: access.userId, ...unlockedPinState() },
  });
  await recordAuditEvent({ action: "STAFF_PIN_SET", actorUserId: access.userId, actorRole: access.session.user.role, establishmentId: access.establishmentId, targetId: staff.id });
  revalidateTablet();
  return { ok: true };
}

export async function unlockStaffPin(formData: FormData): Promise<Result> {
  const access = await requireTerrainWriter(formData.get("establishmentId"));
  const staff = await staffOf(access, formData.get("staffMemberId"));
  if (!staff) return { error: "Salarié introuvable." };
  const updated = await prisma.staffPin.updateMany({ where: { staffMemberId: staff.id }, data: unlockedPinState() });
  if (updated.count === 0) return { error: "Ce salarié n'a pas encore de code." };
  await recordAuditEvent({ action: "STAFF_PIN_UNLOCKED", actorUserId: access.userId, actorRole: access.session.user.role, establishmentId: access.establishmentId, targetId: staff.id });
  revalidateTablet();
  return { ok: true };
}

// Écran de connexion d'une tablette ENREGISTRÉE : les salariés actifs qui ont un
// code. Sans appareil enregistré : liste vide, rien n'est révélé.
export async function listTabletSignInStaff(): Promise<{ id: string; displayName: string }[]> {
  const device = await resolveTabletDevice();
  if (!device) return [];
  return prisma.staffMember.findMany({
    where: { establishmentId: device.establishmentId, active: true, pin: { isNot: null } },
    select: { id: true, displayName: true },
    orderBy: { displayName: "asc" },
  });
}

// Connexion sur la tablette. Un message unique pour « code faux » et « salarié
// inconnu » ; le blocage, lui, est dit (la personne doit aller voir la direction).
const WRONG = "Code incorrect.";

export async function tabletSignIn(formData: FormData): Promise<Result> {
  const device = await resolveTabletDevice();
  if (!device) return { error: "Cette tablette n'est pas enregistrée par la direction." };
  const staffMemberId = String(formData.get("staffMemberId") ?? "");
  const staff = await prisma.staffMember.findFirst({
    where: { id: staffMemberId, establishmentId: device.establishmentId, active: true },
    select: { id: true, pin: { select: { pinHash: true, failedAttempts: true, lockedAt: true } } },
  });
  if (!staff?.pin) return { error: WRONG };
  const now = new Date();
  const decision = decidePinAttempt(staff.pin, await pinMatches(staff.pin.pinHash, String(formData.get("pin") ?? "")), now);
  if (decision.outcome !== "ACCEPTED" || staff.pin.failedAttempts !== 0) {
    await prisma.staffPin.update({ where: { staffMemberId: staff.id }, data: decision.next });
  }
  if (decision.outcome === "LOCKED") {
    await recordAuditEvent({ action: "TABLET_PIN_LOCKED", establishmentId: device.establishmentId, targetId: staff.id });
    return { error: "Code bloqué après 5 essais. Demandez à la direction de le débloquer." };
  }
  if (decision.outcome === "REJECTED") {
    await recordAuditEvent({ action: "TABLET_SIGN_IN_FAILED", establishmentId: device.establishmentId, targetId: staff.id });
    return { error: `${WRONG} Encore ${decision.remaining} essai${decision.remaining > 1 ? "s" : ""}.` };
  }
  const token = createTabletSessionToken(
    { staffMemberId: staff.id, deviceEnrollmentId: device.deviceEnrollmentId, expiresAt: tabletSessionExpiry(now) },
    getEnv().authSecret
  );
  (await cookies()).set(TABLET_SESSION_COOKIE, token, secureCookie(TABLET_SESSION_MINUTES * 60));
  await prisma.deviceEnrollment.update({ where: { id: device.deviceEnrollmentId }, data: { lastSeenAt: now } });
  await recordAuditEvent({ action: "TABLET_SIGNED_IN", establishmentId: device.establishmentId, targetId: staff.id });
  return { ok: true };
}

export async function tabletSignOut(): Promise<void> {
  (await cookies()).delete(TABLET_SESSION_COOKIE);
  revalidatePath("/tablette");
}
