import { describe, expect, it } from "vitest";
import { safeCallbackPath } from "./routes";

// Recette (14/10/2026) : la connexion ignorait `callbackUrl` et renvoyait toujours
// vers l'accueil. La reprise du chemin demandé ne doit JAMAIS ouvrir une redirection
// vers un autre site (open redirect) : chaque contournement connu est refusé ici.
describe("safeCallbackPath — chemin interne uniquement", () => {
  it.each([
    ["/dashboard/client/documents", "/dashboard/client/documents"],
    ["/dashboard/cabinet/etablissements/abc?onglet=documents", "/dashboard/cabinet/etablissements/abc?onglet=documents"],
    ["/espace#diagnostic", "/espace#diagnostic"],
    ["/dashboard/../dashboard/cabinet", "/dashboard/cabinet"],
  ])("accepte %s", (raw, expected) => {
    expect(safeCallbackPath(raw)).toBe(expected);
  });

  it.each([
    ["URL absolue", "https://piege.example/login"],
    ["schéma sans barre", "javascript:alert(1)"],
    ["données", "data:text/html,<script>alert(1)</script>"],
    ["protocole relatif", "//piege.example"],
    ["protocole relatif triple", "///piege.example"],
    ["barre inverse", "/\\piege.example"],
    ["barre inverse seule", "\\\\piege.example"],
    ["tabulation retirée par le navigateur", "/\t/piege.example"],
    ["retour à la ligne", "/\n/piege.example"],
    ["espace", "/ /piege.example"],
    ["caractère nul", "/dashboard\u0000"],
    ["chemin relatif", "dashboard"],
    ["vide", ""],
    ["trop long", `/${"a".repeat(600)}`],
    ["page de connexion (boucle)", "/login"],
    ["page d'accueil publique", "/"],
    ["déconnexion", "/deconnexion?motif=x"],
  ])("refuse : %s", (_label, raw) => {
    expect(safeCallbackPath(raw)).toBeNull();
  });

  it("refuse une valeur qui n'est pas une chaîne (paramètre répété, absent)", () => {
    expect(safeCallbackPath(["/dashboard", "//piege.example"])).toBeNull();
    expect(safeCallbackPath(undefined)).toBeNull();
    expect(safeCallbackPath(null)).toBeNull();
  });
});
