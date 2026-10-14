import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "@/lib/config/env";

// ─────────────────────────────────────────────────────────────────────────────
// VERROU HDS — garde mécanique n° 2 (ADR 20261014) : avec la configuration par
// défaut, aucun adaptateur ne sait écrire une donnée de personne accompagnée.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/config/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/config/env")>()),
  getEnv: vi.fn(),
}));

import { getEnv, parseHdsFlag } from "@/lib/config/env";
import {
  getBeneficiaryDataPort,
  getHdsFileStoragePort,
  HdsNotAvailableError,
  resolveHdsBackendState,
} from "./index";

const S3 = { endpoint: "https://s3.exemple", region: "fr", bucket: "eoda-documents", accessKeyId: "a", secretAccessKey: "b" };
const HDS_STORAGE = { ...S3, endpoint: "https://s3.hds.exemple", bucket: "eoda-hds" };
const LOCKED_ENV = { s3: S3, hds: { enabled: false, provider: null, storage: null } } as unknown as AppEnv;
const SCOPE = { tenantId: "t1", establishmentId: "e1" };

beforeEach(() => {
  vi.mocked(getEnv).mockReturnValue(LOCKED_ENV);
});

describe("resolveHdsBackendState", () => {
  it("reste fermé par défaut", () => {
    expect(resolveHdsBackendState(LOCKED_ENV)).toBe("LOCKED");
  });

  it("reste fermé si HDS_BACKEND_ENABLED=true sans hébergeur déclaré", () => {
    expect(resolveHdsBackendState({ s3: S3, hds: { enabled: true, provider: null, storage: HDS_STORAGE } })).toBe("LOCKED");
  });

  it("reste fermé si le stockage HDS manque ou désigne le bucket institutionnel", () => {
    expect(resolveHdsBackendState({ s3: S3, hds: { enabled: true, provider: "X", storage: null } })).toBe("LOCKED");
    expect(resolveHdsBackendState({ s3: S3, hds: { enabled: true, provider: "X", storage: S3 } })).toBe("LOCKED");
  });

  it("ne s'ouvre qu'avec une configuration complète", () => {
    expect(resolveHdsBackendState({ s3: S3, hds: { enabled: true, provider: "X", storage: HDS_STORAGE } })).toBe("OPEN");
  });
});

describe("parseHdsFlag", () => {
  it("n'ouvre que sur la chaîne exacte true", () => {
    expect(parseHdsFlag(undefined)).toBe(false);
    expect(parseHdsFlag("false")).toBe(false);
    expect(parseHdsFlag("true")).toBe(true);
    for (const raw of ["True", "1", "yes", "oui"]) expect(parseHdsFlag(raw)).toBe("INVALID");
  });
});

describe("adaptateur par défaut — verrouillé", () => {
  it("se déclare indisponible", () => {
    expect(getBeneficiaryDataPort().isAvailable).toBe(false);
  });

  it("refuse chaque écriture", async () => {
    const port = getBeneficiaryDataPort();
    const now = new Date("2026-10-14T10:00:00Z");
    const writes: Array<() => Promise<unknown>> = [
      () =>
        port.createBeneficiary(SCOPE, {
          civility: "MADAME",
          firstName: "Prénom (fictif)",
          lastName: "Nom (fictif)",
          address: "1 rue Exemple",
          girLevel: 3,
          monthlyHours: 10,
          startedOn: now,
          referentStaffMemberId: null,
          birthDate: null,
          phone: null,
          email: null,
          externalErpId: null,
          representative: null,
        }),
      () =>
        port.recordSignedDocument(SCOPE, {
          beneficiaryId: "b1",
          kind: "FEUILLE_RECEPTION",
          sourceTemplateVersionId: null,
          renderedFileKey: "k",
          sha256: "0".repeat(64),
          issuedAt: now,
          renewDueOn: null,
          evidence: {
            signerRole: "PERSONNE",
            signerName: "Nom (fictif)",
            witnessStaffMemberId: "s1",
            deviceEnrollmentId: "d1",
            signedAt: now,
            signatureImageKey: "k2",
            documentSha256: "0".repeat(64),
            checklist: [],
          },
          delivery: null,
        }),
      () =>
        port.appendJournalEntry(SCOPE, {
          beneficiaryId: "b1",
          authorStaffMemberId: null,
          authorUserId: "u1",
          text: "Événement (fictif)",
          possibleAdverseEvent: false,
          occurredAt: now,
        }),
      () =>
        port.recordSurveyResponse(SCOPE, {
          beneficiaryId: null,
          templateCode: "PERSONNE",
          templateVersion: 1,
          respondentKind: "PERSONNE",
          mode: "ASSISTEE",
          collectedByStaffMemberId: null,
          completedAt: now,
          answers: [],
        }),
    ];
    for (const write of writes) await expect(write()).rejects.toBeInstanceOf(HdsNotAvailableError);
  });

  it("rend vide chaque lecture", async () => {
    const port = getBeneficiaryDataPort();
    expect(await port.listBeneficiaries(SCOPE)).toEqual([]);
    expect(await port.listBeneficiaryDocuments(SCOPE)).toEqual([]);
    expect(await port.listJournal(SCOPE, "b1")).toEqual([]);
    expect(await port.listSurveyResponses(SCOPE, null)).toEqual([]);
  });

  it("verrouille aussi le stockage des fichiers signés, lecture comprise", async () => {
    const storage = getHdsFileStoragePort();
    await expect(storage.upload("k", Buffer.from("x"), "image/png")).rejects.toBeInstanceOf(HdsNotAvailableError);
    await expect(storage.getSignedDownloadUrl("k")).rejects.toBeInstanceOf(HdsNotAvailableError);
    await expect(storage.download("k")).rejects.toBeInstanceOf(HdsNotAvailableError);
    await expect(storage.delete("k")).rejects.toBeInstanceOf(HdsNotAvailableError);
  });
});
