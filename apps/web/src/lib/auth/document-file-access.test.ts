import { describe, expect, it } from "vitest";
import { CLIENT_ACCESS_ROLES } from "./capabilities";
import {
  canDepositDocumentFile,
  canOpenDocumentFile,
  documentFileOpenerOf,
  type DocumentFileOpener,
} from "./document-file-access";

// Case par case (ADR 20261110) : cabinet × rôle client × tablette × document restreint ou
// non, et la règle de restitution des brouillons d'EODA qu'elle absorbe. Le rôle CABINET
// n'entre pas dans la règle : la garde (`tryEstablishmentAccess`) a déjà décidé, rôle par
// rôle, qui voit la structure — un document restreint est fermé à TOUT le cabinet.

const RESTRICTED = "DEPARTEMENT_TAMPON";
const ORDINARY = "L2002_LIVRET_ACCUEIL";

const own = { producedByCabinet: false, validatedAt: null };
const eodaDraft = { producedByCabinet: true, validatedAt: null };
const eodaValidated = { producedByCabinet: true, validatedAt: new Date("2026-11-01T00:00:00Z") };
const ALL_VERSIONS = [own, eodaDraft, eodaValidated];

const cabinet: DocumentFileOpener = { side: "CABINET" };
const tablet: DocumentFileOpener = { side: "TABLET" };
const client = (accessRole: (typeof CLIENT_ACCESS_ROLES)[number]): DocumentFileOpener => ({ side: "CLIENT", accessRole });

describe("canOpenDocumentFile — document ordinaire", () => {
  it("le cabinet ouvre toute version (la garde a déjà vérifié la structure)", () => {
    for (const version of ALL_VERSIONS) {
      expect(canOpenDocumentFile(cabinet, { documentTypeCode: ORDINARY, ...version })).toBe(true);
    }
  });

  it.each(CLIENT_ACCESS_ROLES)("structure (%s) : ses dépôts et ce qu'EODA a validé, jamais un brouillon d'EODA", (role) => {
    expect(canOpenDocumentFile(client(role), { documentTypeCode: ORDINARY, ...own })).toBe(true);
    expect(canOpenDocumentFile(client(role), { documentTypeCode: ORDINARY, ...eodaValidated })).toBe(true);
    expect(canOpenDocumentFile(client(role), { documentTypeCode: ORDINARY, ...eodaDraft })).toBe(false);
  });

  it("un document sans type suit la règle ordinaire", () => {
    expect(canOpenDocumentFile(cabinet, { documentTypeCode: null, ...own })).toBe(true);
  });

  it("la tablette n'ouvre pas un document ordinaire par cette règle (elle a ses propres sélections)", () => {
    expect(canOpenDocumentFile(tablet, { documentTypeCode: ORDINARY, ...eodaValidated })).toBe(false);
  });
});

describe("canOpenDocumentFile — document à accès restreint", () => {
  it("aucun compte du cabinet, administration comprise, quelle que soit la version", () => {
    for (const version of ALL_VERSIONS) {
      expect(canOpenDocumentFile(cabinet, { documentTypeCode: RESTRICTED, ...version })).toBe(false);
    }
  });

  it("la direction de la structure ouvre toutes les versions, dépôt d'EODA pour son compte compris", () => {
    for (const version of ALL_VERSIONS) {
      expect(canOpenDocumentFile(client("DIRECTION"), { documentTypeCode: RESTRICTED, ...version })).toBe(true);
    }
  });

  it.each(["RESPONSABLE_QUALITE", "ADMINISTRATIF", "INTERVENANT"] as const)("%s : jamais", (role) => {
    for (const version of ALL_VERSIONS) {
      expect(canOpenDocumentFile(client(role), { documentTypeCode: RESTRICTED, ...version })).toBe(false);
    }
  });

  it("la tablette enregistrée de la structure l'ouvre, pour la pose du tampon", () => {
    expect(canOpenDocumentFile(tablet, { documentTypeCode: RESTRICTED, ...own })).toBe(true);
    expect(canOpenDocumentFile(tablet, { documentTypeCode: RESTRICTED, ...eodaDraft })).toBe(true);
  });
});

describe("canDepositDocumentFile", () => {
  it("document ordinaire : la garde d'écriture suffit", () => {
    expect(canDepositDocumentFile(cabinet, ORDINARY)).toBe(true);
    for (const role of CLIENT_ACCESS_ROLES) expect(canDepositDocumentFile(client(role), ORDINARY)).toBe(true);
  });

  it("document restreint : la direction, ou le cabinet pour son compte — personne d'autre", () => {
    expect(canDepositDocumentFile(cabinet, RESTRICTED)).toBe(true);
    expect(canDepositDocumentFile(client("DIRECTION"), RESTRICTED)).toBe(true);
    expect(canDepositDocumentFile(client("RESPONSABLE_QUALITE"), RESTRICTED)).toBe(false);
    expect(canDepositDocumentFile(client("ADMINISTRATIF"), RESTRICTED)).toBe(false);
    expect(canDepositDocumentFile(client("INTERVENANT"), RESTRICTED)).toBe(false);
    expect(canDepositDocumentFile(tablet, RESTRICTED)).toBe(false);
  });
});

describe("documentFileOpenerOf — depuis le contexte rendu par la garde", () => {
  it("cabinet", () => {
    expect(documentFileOpenerOf({ isClient: false, clientAccessRole: null })).toEqual({ side: "CABINET" });
  });

  it("structure, avec son rôle d'accès", () => {
    expect(documentFileOpenerOf({ isClient: true, clientAccessRole: "ADMINISTRATIF" })).toEqual({
      side: "CLIENT",
      accessRole: "ADMINISTRATIF",
    });
  });

  it("un compte de structure sans rôle connu est traité comme le moins habilité (fail-closed)", () => {
    const opener = documentFileOpenerOf({ isClient: true, clientAccessRole: null });
    expect(canOpenDocumentFile(opener, { documentTypeCode: RESTRICTED, ...own })).toBe(false);
    expect(canDepositDocumentFile(opener, RESTRICTED)).toBe(false);
  });
});
