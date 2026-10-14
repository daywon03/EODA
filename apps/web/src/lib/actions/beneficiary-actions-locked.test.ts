import { beforeEach, describe, expect, it, vi } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// VERROU HDS — garde mécanique n° 3 (ADR 20261014) : avec la configuration PAR
// DÉFAUT (HDS_BACKEND_ENABLED absent), CHAQUE action serveur d'écriture usager
// répond l'état verrouillé et n'écrit rien. Le test énumère les exports de
// terrain-write.ts : une nouvelle action d'écriture ajoutée sans être couverte ici
// fait échouer le premier cas.
// ─────────────────────────────────────────────────────────────────────────────

const writeSpy = vi.fn(() => {
  throw new Error("ÉCRITURE INTERDITE");
});
const prismaMock = new Proxy(
  {},
  {
    get: (_target, model: string) =>
      new Proxy(
        {},
        {
          get: (_t, method: string) =>
            /^(create|update|upsert|delete)/.test(method)
              ? writeSpy
              : vi.fn(async () => (model === "establishment" ? { tenantId: "tenant-1" } : null)),
        }
      ),
  }
);

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/config/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/config/env")>()),
  getEnv: () => ({ s3: null, hds: { enabled: false, provider: null, storage: null } }),
}));
vi.mock("@/lib/auth/guards", () => ({
  requireEstablishmentAccess: vi.fn(async () => ({
    establishmentId: "etab-1",
    userId: "user-1",
    isClient: true,
    missionAccess: "ACTIVE",
    session: { user: { role: "CLIENT_USER" } },
  })),
  resolveTabletSession: vi.fn(async () => ({
    deviceEnrollmentId: "device-1",
    tenantId: "tenant-1",
    establishmentId: "etab-1",
    establishmentName: "SAD Les Glycines (fictif)",
    staffMemberId: "staff-1",
    staffDisplayName: "Intervenant (fictif)",
  })),
}));

const actions = await import("./terrain-write");
const { HDS_LOCKED_MESSAGE } = await import("@/lib/hds");

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

// Un formulaire VALIDE par action : le refus doit venir du verrou, pas d'une erreur
// de saisie.
const VALID_FORMS: Record<string, FormData> = {
  createBeneficiary: form({
    establishmentId: "etab-1",
    civility: "MADAME",
    firstName: "Germaine",
    lastName: "Rousseau (fictif)",
    address: "1 rue Exemple, Ville fictive",
    startedOn: "2026-10-14",
  }),
  appendBeneficiaryJournal: form({ beneficiaryId: "b-1", text: "Événement (fictif)" }),
  recordSurveyResponse: form({
    templateCode: "PERSONNE",
    mode: "ASSISTEE",
    answers: JSON.stringify([{ questionId: "p01-respect", choice: "TRES" }]),
  }),
  recordReceptionSheet: form({ beneficiaryId: "b-1", signerRole: "PERSONNE", signerName: "Germaine Rousseau (fictif)" }),
};

beforeEach(() => {
  writeSpy.mockClear();
});

describe("actions d'écriture usager — verrouillées par défaut", () => {
  it("chaque export de terrain-write.ts est couvert par ce test", () => {
    const exported = Object.entries(actions)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name)
      .sort();
    expect(exported).toEqual(Object.keys(VALID_FORMS).sort());
  });

  it.each(Object.keys(VALID_FORMS))("%s répond l'état verrouillé sans écrire", async (name) => {
    const action = (actions as unknown as Record<string, (fd: FormData) => Promise<unknown>>)[name]!;
    expect(await action(VALID_FORMS[name]!)).toEqual({ error: HDS_LOCKED_MESSAGE, locked: true });
    expect(writeSpy).not.toHaveBeenCalled();
  });
});
