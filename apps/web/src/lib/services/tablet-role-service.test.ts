import { describe, expect, it } from "vitest";
import { effectiveTabletRole, isDirectionJobTitle, isTabletRole, tabletCan } from "./tablet-role-service";

describe("tabletCan", () => {
  it("l'intervenant fait signer et passe les enquêtes, rien d'autre", () => {
    expect(tabletCan("INTERVENANT", "ADMISSION")).toBe(true);
    expect(tabletCan("INTERVENANT", "SURVEY")).toBe(true);
    expect(tabletCan("INTERVENANT", "PAST_CONTRACTS")).toBe(false);
    expect(tabletCan("INTERVENANT", "EXPORT")).toBe(false);
    expect(tabletCan("INTERVENANT", "ROSTER")).toBe(false);
  });

  it("l'administrateur a tout", () => {
    for (const ability of ["ADMISSION", "SURVEY", "PAST_CONTRACTS", "EXPORT", "ROSTER"] as const) {
      expect(tabletCan("ADMINISTRATEUR", ability)).toBe(true);
    }
  });

  it("une valeur reçue inconnue n'est pas un rôle", () => {
    expect(isTabletRole("ADMINISTRATEUR")).toBe(true);
    expect(isTabletRole("SUPER_ADMIN")).toBe(false);
    expect(isTabletRole(null)).toBe(false);
  });
});

describe("la direction est toujours administrateur", () => {
  it("reconnaît un poste de direction à son métier, accents et casse ignorés", () => {
    for (const title of ["Directrice", "directeur", "DIRECTEUR ADJOINT", "Directrice adjointe", "Direction", "Directeur de l'association"]) {
      expect(isDirectionJobTitle(title)).toBe(true);
    }
    for (const title of ["Aide à domicile", "Coordinateur", "Consultante", "Responsable qualité", "Directives anticipées (référente)", ""]) {
      expect(isDirectionJobTitle(title)).toBe(false);
    }
  });

  it("le rôle effectif d'une directrice est administrateur, quel que soit le rôle posé", () => {
    expect(effectiveTabletRole({ tabletRole: "INTERVENANT", jobTitle: "Directrice" })).toBe("ADMINISTRATEUR");
    expect(effectiveTabletRole({ tabletRole: "INTERVENANT", jobTitle: "Aide à domicile" })).toBe("INTERVENANT");
    expect(effectiveTabletRole({ tabletRole: "ADMINISTRATEUR", jobTitle: "Coordinateur" })).toBe("ADMINISTRATEUR");
  });
});
