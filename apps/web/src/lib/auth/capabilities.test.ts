import { describe, expect, it } from "vitest";
import {
  CABINET_CAPABILITIES,
  CABINET_ROLES,
  cabinetCapabilityFor,
  cabinetLandingPath,
  capabilityRequiredForPath,
  hasCabinetCapability,
  isInStructureScope,
  resolveStructureScope,
  roleHomePath,
  structureAccessFor,
  type CabinetCapability,
  type CabinetRole,
} from "./capabilities";

// La matrice ATTENDUE, écrite une seconde fois ici volontairement : chaque case est
// une décision (maquette « Équipe EODA », décision 5 du plan v2). Une case qui change
// dans capabilities.ts sans changer ici fait rougir ce test — c'est le but.
const EXPECTED: Record<CabinetRole, Record<CabinetCapability, boolean>> = {
  CABINET_ADMIN: {
    STRUCTURES_READ: true,
    STRUCTURES_WRITE: true,
    STRUCTURE_CONTRACT: true,
    COMMERCIAL: true,
    LIBRARY_READ: true,
    TEAM_MANAGE: true,
    CABINET_SETTINGS: true,
  },
  CABINET_EVALUATOR: {
    STRUCTURES_READ: true,
    STRUCTURES_WRITE: true,
    STRUCTURE_CONTRACT: false,
    COMMERCIAL: false,
    LIBRARY_READ: true,
    TEAM_MANAGE: false,
    CABINET_SETTINGS: false,
  },
  CABINET_COMMERCIAL: {
    STRUCTURES_READ: false,
    STRUCTURES_WRITE: false,
    STRUCTURE_CONTRACT: false,
    COMMERCIAL: true,
    LIBRARY_READ: false,
    TEAM_MANAGE: false,
    CABINET_SETTINGS: false,
  },
  CABINET_READONLY: {
    STRUCTURES_READ: true,
    STRUCTURES_WRITE: false,
    STRUCTURE_CONTRACT: false,
    COMMERCIAL: false,
    LIBRARY_READ: true,
    TEAM_MANAGE: false,
    CABINET_SETTINGS: false,
  },
};

describe("matrice des capacités cabinet — chaque rôle × chaque capacité", () => {
  const cases = CABINET_ROLES.flatMap((role) => CABINET_CAPABILITIES.map((cap) => [role, cap] as const));

  it("couvre 4 rôles × 7 capacités", () => {
    expect(cases).toHaveLength(28);
  });

  it.each(cases)("%s / %s", (role, capability) => {
    expect(hasCabinetCapability(role, capability)).toBe(EXPECTED[role][capability]);
  });

  it.each(CABINET_CAPABILITIES)("un compte client n'a jamais %s", (capability) => {
    expect(hasCabinetCapability("CLIENT_USER", capability)).toBe(false);
  });

  it("aucun rôle autre que l'administration n'écrit sans pouvoir lire", () => {
    for (const role of CABINET_ROLES) {
      if (hasCabinetCapability(role, "STRUCTURES_WRITE")) {
        expect(hasCabinetCapability(role, "STRUCTURES_READ")).toBe(true);
      }
    }
  });
});

describe("pages d'arrivée", () => {
  it("le commercial arrive sur le commercial, les autres sur l'accueil, le client sur son portail", () => {
    expect(cabinetLandingPath("CABINET_COMMERCIAL")).toBe("/dashboard/cabinet/commercial");
    expect(cabinetLandingPath("CABINET_READONLY")).toBe("/dashboard/cabinet");
    expect(roleHomePath("CABINET_ADMIN")).toBe("/dashboard/cabinet");
    expect(roleHomePath("CABINET_EVALUATOR")).toBe("/dashboard/cabinet");
    expect(roleHomePath("CLIENT_USER")).toBe("/dashboard/client");
  });
});

describe("périmètre des structures (affectation consultante)", () => {
  it("l'administration voit tout, même avec des affectations", () => {
    expect(resolveStructureScope("CABINET_ADMIN", ["e1"])).toEqual({ kind: "ALL" });
  });

  it("une consultante SANS affectation voit tout (compatibilité des comptes existants)", () => {
    expect(resolveStructureScope("CABINET_EVALUATOR", [])).toEqual({ kind: "ALL" });
  });

  it("une consultante affectée ne voit que ses structures", () => {
    const scope = resolveStructureScope("CABINET_EVALUATOR", ["e1", "e2"]);
    expect(scope).toEqual({ kind: "ONLY", establishmentIds: ["e1", "e2"] });
    expect(isInStructureScope(scope, "e1")).toBe(true);
    expect(isInStructureScope(scope, "e3")).toBe(false);
  });

  it("la lecture seule voit tout, l'affectation ne la restreint pas", () => {
    expect(resolveStructureScope("CABINET_READONLY", ["e1"])).toEqual({ kind: "ALL" });
  });

  it("fail-closed : un rôle sans lecture des structures n'en voit AUCUNE", () => {
    const commercial = resolveStructureScope("CABINET_COMMERCIAL", []);
    expect(commercial).toEqual({ kind: "ONLY", establishmentIds: [] });
    expect(isInStructureScope(commercial, "e1")).toBe(false);
    expect(isInStructureScope(resolveStructureScope("CLIENT_USER", []), "e1")).toBe(false);
  });
});

describe("traduction d'un besoin en capacité", () => {
  it("READ, WRITE, CONTRACT", () => {
    expect(cabinetCapabilityFor("READ")).toBe("STRUCTURES_READ");
    expect(cabinetCapabilityFor("WRITE")).toBe("STRUCTURES_WRITE");
    expect(cabinetCapabilityFor("CONTRACT")).toBe("STRUCTURE_CONTRACT");
  });

  it("le module CONTRAT exige les montants, quel que soit le mode", () => {
    expect(structureAccessFor({ module: "CONTRACT", mode: "READ" })).toBe("CONTRACT");
    expect(structureAccessFor({ module: "DOCUMENTS", mode: "READ" })).toBe("READ");
    expect(structureAccessFor({ module: "TASKS", mode: "WRITE" })).toBe("WRITE");
  });
});

describe("filet du middleware", () => {
  it.each([
    ["/dashboard/cabinet/commercial", "COMMERCIAL"],
    ["/dashboard/cabinet/commercial/devis/1", "COMMERCIAL"],
    ["/imprimer/devis/1", "COMMERCIAL"],
    ["/dashboard/cabinet/equipe", "TEAM_MANAGE"],
    ["/imprimer/contrat/e1", "STRUCTURE_CONTRACT"],
    ["/imprimer/avenant/e1", "STRUCTURE_CONTRACT"],
  ])("%s exige %s", (pathname, capability) => {
    expect(capabilityRequiredForPath(pathname)).toBe(capability);
  });

  it("ne confond pas un préfixe avec un mot plus long, ni le contrat du portail client", () => {
    expect(capabilityRequiredForPath("/dashboard/cabinet/commerciale")).toBeNull();
    expect(capabilityRequiredForPath("/imprimer/client/contrat")).toBeNull();
    expect(capabilityRequiredForPath("/dashboard/cabinet")).toBeNull();
  });
});
