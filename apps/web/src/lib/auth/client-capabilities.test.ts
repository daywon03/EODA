import { describe, expect, it } from "vitest";
import {
  CLIENT_ACCESS_ROLES,
  CLIENT_MODULES,
  clientAccessLevel,
  clientAllows,
  clientOwnOnly,
  type ClientAccessLevel,
  type ClientAccessRole,
  type ClientModule,
} from "./capabilities";

// Matrice CLIENT attendue, écrite une seconde fois ici volontairement (décisions N9).
const EXPECTED: Record<ClientAccessRole, Record<ClientModule, ClientAccessLevel>> = {
  DIRECTION: { DOCUMENTS: "FULL", DIAGNOSTIC: "FULL", TASKS: "FULL", TEAM: "FULL", MESSAGES: "FULL", CONTRACT: "FULL", ACCESS: "FULL", TERRAIN: "FULL" },
  RESPONSABLE_QUALITE: { DOCUMENTS: "FULL", DIAGNOSTIC: "FULL", TASKS: "FULL", TEAM: "FULL", MESSAGES: "FULL", CONTRACT: "NONE", ACCESS: "NONE", TERRAIN: "FULL" },
  ADMINISTRATIF: { DOCUMENTS: "FULL", DIAGNOSTIC: "NONE", TASKS: "FULL", TEAM: "NONE", MESSAGES: "FULL", CONTRACT: "NONE", ACCESS: "NONE", TERRAIN: "NONE" },
  INTERVENANT: { DOCUMENTS: "NONE", DIAGNOSTIC: "NONE", TASKS: "OWN", TEAM: "OWN", MESSAGES: "NONE", CONTRACT: "NONE", ACCESS: "NONE", TERRAIN: "NONE" },
};

describe("matrice client — chaque rôle d'accès × chaque module", () => {
  const cases = CLIENT_ACCESS_ROLES.flatMap((role) => CLIENT_MODULES.map((module) => [role, module] as const));

  it("couvre 4 rôles × 8 modules", () => {
    expect(cases).toHaveLength(32);
  });

  it.each(cases)("%s / %s", (role, module) => {
    expect(clientAccessLevel(role, module)).toBe(EXPECTED[role][module]);
  });

  it("seule la direction gère les accès", () => {
    const managers = CLIENT_ACCESS_ROLES.filter((role) => clientAllows(role, { module: "ACCESS", mode: "WRITE" }));
    expect(managers).toEqual(["DIRECTION"]);
  });
});

describe("traduction d'un besoin", () => {
  it("NONE refuse tout, FULL accepte tout", () => {
    expect(clientAllows("INTERVENANT", { module: "DOCUMENTS", mode: "READ" })).toBe(false);
    expect(clientAllows("ADMINISTRATIF", { module: "DOCUMENTS", mode: "WRITE" })).toBe(true);
  });

  it("OWN accepte, en limitant l'action à ce qui est à soi", () => {
    expect(clientAllows("INTERVENANT", { module: "TASKS", mode: "WRITE" })).toBe(true);
    expect(clientOwnOnly("INTERVENANT", "TASKS")).toBe(true);
    expect(clientOwnOnly("DIRECTION", "TASKS")).toBe(false);
  });
});
