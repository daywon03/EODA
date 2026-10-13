import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { classifyPath } from "./routes";
import { CABINET_ROLES, hasCabinetCapability, isCabinetRole, portalRedirectFor, roleHomePath } from "./capabilities";

// Libre-service (D5, 13/10/2026) : deux routes publiques EXACTES (landing et
// inscription), un espace réservé au rôle PROSPECT_USER, qui n'a aucune capacité.

describe("routes publiques du libre-service — exclusion explicite et étroite", () => {
  it.each([
    ["/", "AUTH"],
    ["/inscription", "AUTH"],
    ["/inscription/", "PROTECTED"],
    ["/inscription/etape", "PROTECTED"],
    ["/espace", "PROTECTED"],
    ["/espace/diagnostic", "PROTECTED"],
    ["/inscriptions", "PROTECTED"],
  ])("%s → %s", (pathname, expected) => {
    expect(classifyPath(pathname)).toBe(expected);
  });

  it("le middleware applique le cloisonnement des portails et garde la CSP à nonce partout", () => {
    const middleware = readFileSync(path.resolve(__dirname, "../../middleware.ts"), "utf8");
    expect(middleware).toContain("portalRedirectFor(session.user.role, nextUrl.pathname)");
    expect(middleware).not.toMatch(/matcher:[^\]]*(inscription|espace)/);
  });
});

describe("rôle PROSPECT_USER", () => {
  it("n'est pas un rôle cabinet et n'a aucune capacité", () => {
    expect(isCabinetRole("PROSPECT_USER")).toBe(false);
    expect(CABINET_ROLES).not.toContain("PROSPECT_USER");
    for (const capability of ["COMMERCIAL", "STRUCTURES_READ", "STRUCTURE_CONTRACT", "TEAM_MANAGE"] as const) {
      expect(hasCabinetCapability("PROSPECT_USER", capability)).toBe(false);
    }
  });

  it("arrive dans son espace", () => {
    expect(roleHomePath("PROSPECT_USER")).toBe("/espace");
  });
});

describe("portalRedirectFor", () => {
  it.each([
    ["PROSPECT_USER", "/espace", null],
    ["PROSPECT_USER", "/espace/diagnostic", null],
    ["PROSPECT_USER", "/dashboard/client", "/espace"],
    ["PROSPECT_USER", "/dashboard/cabinet/commercial", "/espace"],
    ["PROSPECT_USER", "/imprimer/devis/x", "/espace"],
    ["PROSPECT_USER", "/changer-mot-de-passe", null],
    ["CLIENT_USER", "/espace", "/dashboard/client"],
    ["CABINET_ADMIN", "/espace/diagnostic", "/dashboard/cabinet"],
    ["CABINET_COMMERCIAL", "/espace", "/dashboard/cabinet/commercial"],
    ["CLIENT_USER", "/dashboard/client", null],
    ["CABINET_ADMIN", "/espaces", null],
  ] as const)("%s sur %s → %s", (role, pathname, expected) => {
    expect(portalRedirectFor(role, pathname)).toBe(expected);
  });
});
