import { describe, expect, it } from "vitest";
import { isTabletRole, tabletCan } from "./tablet-role-service";

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
