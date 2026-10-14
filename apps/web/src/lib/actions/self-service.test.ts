import { beforeEach, describe, expect, it, vi } from "vitest";

// Inscription en libre-service (route publique) : débit sur l'IP et l'adresse,
// validation serveur, même réponse que le compte existe ou non, prospect + compte
// PROSPECT_USER créés — jamais un établissement.

class P2002 extends Error {
  code = "P2002";
}

const tx = {
  prospect: { create: vi.fn() },
  user: { create: vi.fn() },
  prospectAccount: { create: vi.fn() },
  establishment: { create: vi.fn() },
  emailVerificationToken: { updateMany: vi.fn(), create: vi.fn() },
};
const prismaMock = {
  tenant: { findMany: vi.fn() },
  user: { findUnique: vi.fn() },
  establishment: { create: vi.fn() },
  $transaction: vi.fn((run: (t: typeof tx) => unknown) => run(tx)),
};
const consumeThrottledAttempt = vi.fn();
const recordAuditEvent = vi.fn();
const send = vi.fn();
const hashPassword = vi.fn();
const env = { isDevelopment: false, resend: { apiKey: "k", from: "f" } as { apiKey: string; from: string } | null };

vi.mock("@eoda/database", () => ({
  prisma: prismaMock,
  Prisma: { PrismaClientKnownRequestError: P2002 },
}));
vi.mock("next/headers", () => ({ headers: () => Promise.resolve(new Headers({ "x-forwarded-for": "203.0.113.9" })) }));
vi.mock("@/lib/security/attempt-throttle", () => ({
  consumeThrottledAttempt: (...args: unknown[]) => consumeThrottledAttempt(...args),
}));
vi.mock("@/lib/security/password-hashing", () => ({ hashPassword: (p: string) => hashPassword(p) }));
vi.mock("@/lib/services/audit-log-service", () => ({ recordAuditEvent: (...a: unknown[]) => recordAuditEvent(...a) }));
vi.mock("@/lib/email", () => ({ getEmailPort: () => ({ send }) }));
vi.mock("@/lib/config/app-url", () => ({ appUrl: (p: string) => `https://app.example.org${p}` }));
vi.mock("@/lib/config/env", () => ({ getEnv: () => env }));
// `after()` de Next.js : le travail lourd de l'inscription est DÉFÉRÉ (fuite de durée,
// recette du 14/10). Les tests l'exécutent explicitement avec `runDeferred()`.
const deferred: (() => unknown)[] = [];
vi.mock("next/server", () => ({ after: (work: () => unknown) => deferred.push(work) }));
async function runDeferred(): Promise<void> {
  while (deferred.length > 0) await deferred.shift()!();
}

const { signUpSelfService } = await import("./self-service");
async function signUp(data: FormData) {
  const state = await signUpSelfService({ status: "IDLE" }, data);
  await runDeferred();
  return state;
}
const { SIGNUP_NEUTRAL_MESSAGE } = await import("@/lib/services/self-service-service");

function form(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const values = {
    structureName: "SAD Les Glycines (fictif)",
    structureType: "ASSOCIATION",
    establishmentType: "SAD_AIDE",
    finessNumber: "",
    formule: "ESSENTIEL",
    firstName: "Nadia (fictif)",
    email: "direction@glycines.example.org",
    password: "une phrase de passe longue",
    ...overrides,
  };
  for (const [k, v] of Object.entries(values)) data.set(k, v);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  deferred.length = 0;
  consumeThrottledAttempt.mockResolvedValue(true);
  prismaMock.tenant.findMany.mockResolvedValue([{ id: "tenant-1" }]);
  prismaMock.user.findUnique.mockResolvedValue(null);
  hashPassword.mockResolvedValue("hash");
  tx.prospect.create.mockResolvedValue({ id: "prospect-1" });
  tx.user.create.mockResolvedValue({ id: "user-1" });
  send.mockResolvedValue("SENT");
  env.isDevelopment = false;
  env.resend = { apiKey: "k", from: "f" };
});

const SENT_DISCLOSURE = { emailNotSentLocally: false, devConfirmationPath: null };

describe("signUpSelfService", () => {
  it("crée un prospect LIBRE_SERVICE et un compte PROSPECT_USER rattaché — jamais un établissement", async () => {
    const state = await signUp(form());
    expect(state).toEqual({ status: "DONE", message: SIGNUP_NEUTRAL_MESSAGE, email: "direction@glycines.example.org", disclosure: SENT_DISCLOSURE });
    expect(tx.prospect.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: "tenant-1", channel: "LIBRE_SERVICE", envisagedFormule: "ESSENTIEL", establishmentType: "SAD_AIDE" }),
      })
    );
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "PROSPECT_USER", passwordHash: "hash", mustChangePassword: false, tenantId: null, emailVerifiedAt: null }) })
    );
    expect(tx.prospectAccount.create).toHaveBeenCalledWith({ data: { prospectId: "prospect-1", userId: "user-1" } });
    expect(tx.establishment.create).not.toHaveBeenCalled();
    expect(prismaMock.establishment.create).not.toHaveBeenCalled();
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "SELF_SERVICE_SIGNUP", targetId: "prospect-1" }));
    // Le journal ne porte ni l'adresse ni le nom.
    expect(JSON.stringify(recordAuditEvent.mock.calls)).not.toContain("glycines.example.org");
    expect(send.mock.calls[0]![0]).toMatchObject({ to: "direction@glycines.example.org", subject: "Confirmez votre adresse e-mail — EODA" });
  });

  it("émet un lien de confirmation DANS la transaction : seule l'empreinte est écrite, le lien part par e-mail", async () => {
    await signUp(form());
    const created = tx.emailVerificationToken.create.mock.calls[0]![0] as { data: { userId: string; tokenHash: string; expiresAt: Date } };
    expect(created.data.userId).toBe("user-1");
    expect(created.data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    const html = (send.mock.calls[0]![0] as { html: string }).html;
    const token = /confirmer-email\/([A-Za-z0-9_-]{43})/.exec(html)?.[1];
    expect(token).toBeDefined();
    expect(html).not.toContain(created.data.tokenHash);
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "EMAIL_VERIFICATION_SENT", targetId: "user-1" }));
  });

  it("en développement sans service d'e-mail : « non envoyé » et le lien à l'écran", async () => {
    env.isDevelopment = true;
    env.resend = null;
    const state = await signUp(form());
    expect(state).toMatchObject({ status: "DONE", disclosure: { emailNotSentLocally: true } });
    if (state.status !== "DONE") throw new Error("attendu DONE");
    expect(state.disclosure.devConfirmationPath).toMatch(/^\/confirmer-email\/[A-Za-z0-9_-]{43}$/);
  });

  it("hors développement : jamais de lien à l'écran, même sans service d'e-mail", async () => {
    env.isDevelopment = false;
    env.resend = null;
    const state = await signUp(form());
    expect(state).toMatchObject({ status: "DONE", disclosure: { emailNotSentLocally: true, devConfirmationPath: null } });
  });

  it("adresse déjà utilisée : même réponse, rien de créé, un e-mail au titulaire, même coût bcrypt", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "existing" });
    const state = await signUp(form());
    expect(state).toEqual({ status: "DONE", message: SIGNUP_NEUTRAL_MESSAGE, email: "direction@glycines.example.org", disclosure: SENT_DISCLOSURE });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(hashPassword).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0]).toMatchObject({ subject: "Votre compte EODA existe déjà" });
  });

  it("course sur l'unicité de l'adresse : traitée comme un compte existant", async () => {
    prismaMock.$transaction.mockRejectedValueOnce(new P2002("unique"));
    const state = await signUp(form());
    expect(state.status).toBe("DONE");
    expect(recordAuditEvent).not.toHaveBeenCalledWith(expect.objectContaining({ action: "SELF_SERVICE_SIGNUP" }));
  });

  it("débit dépassé : refus avant toute lecture", async () => {
    consumeThrottledAttempt.mockResolvedValueOnce(false);
    const state = await signUp(form());
    expect(state.status).toBe("ERROR");
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    expect(consumeThrottledAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ key: "signup:ip:203.0.113.9", auditAction: "SELF_SERVICE_SIGNUP_RATE_LIMITED" })
    );
  });

  it("deux compteurs : l'IP puis l'adresse", async () => {
    await signUp(form());
    expect(consumeThrottledAttempt.mock.calls.map((c) => (c[0] as { key: string }).key)).toEqual([
      "signup:ip:203.0.113.9",
      "signup:email:direction@glycines.example.org",
    ]);
  });

  it("saisie invalide : refusée côté serveur, rien n'est lu ni créé", async () => {
    const state = await signUp(form({ password: "court" }));
    expect(state).toMatchObject({ status: "ERROR" });
    expect(prismaMock.tenant.findMany).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("plusieurs cabinets en base : inscription fermée (fail-closed)", async () => {
    prismaMock.tenant.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    const state = await signUp(form());
    expect(state).toMatchObject({ status: "ERROR" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("même chemin synchrone que l'adresse ait un compte ou non : tout le travail lourd est différé", async () => {
    const fresh = await signUpSelfService({ status: "IDLE" }, form());
    expect(deferred).toHaveLength(1);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    deferred.length = 0;
    prismaMock.user.findUnique.mockResolvedValue({ id: "existing" });
    const known = await signUpSelfService({ status: "IDLE" }, form());
    expect(deferred).toHaveLength(1);
    expect(send).not.toHaveBeenCalled();
    expect(known).toEqual(fresh);
    expect(hashPassword).toHaveBeenCalledTimes(2);
    expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(2);
  });

  it("un travail différé en échec est journalisé, jamais avalé", async () => {
    prismaMock.$transaction.mockRejectedValueOnce(new Error("base"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const state = await signUp(form());
    expect(state.status).toBe("DONE");
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("un e-mail qui échoue ne défait pas l'inscription", async () => {
    send.mockRejectedValue(new Error("SMTP"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const state = await signUp(form());
    expect(state.status).toBe("DONE");
    errorSpy.mockRestore();
  });
});
