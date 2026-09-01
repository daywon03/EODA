import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, generateCspNonce } from "./content-security-policy";

function directive(csp: string, name: string): string {
  const found = csp.split("; ").find((part) => part.startsWith(`${name} `));
  return found ?? "";
}

describe("buildContentSecurityPolicy", () => {
  const production = buildContentSecurityPolicy({ nonce: "n0nc3", isProduction: true });
  const development = buildContentSecurityPolicy({ nonce: "n0nc3", isProduction: false });

  it("n'autorise AUCUN script inline sans nonce en production", () => {
    // C'est l'invariant de tout ce chantier : avec `'unsafe-inline'`, une injection
    // de <script> réussie s'exécute, et la CSP ne protège pas de ce qu'elle est
    // censée arrêter en premier.
    expect(directive(production, "script-src")).not.toContain("'unsafe-inline'");
  });

  it("porte le nonce de la requête sur script-src", () => {
    expect(directive(production, "script-src")).toContain("'nonce-n0nc3'");
  });

  it("laisse le script d'amorçage charger les chunks (strict-dynamic)", () => {
    expect(directive(production, "script-src")).toContain("'strict-dynamic'");
  });

  it("n'autorise jamais eval en production", () => {
    // Le rechargement à chaud en a besoin, la production non — et une CSP de
    // production qui traîne un `'unsafe-eval'` de développement est une faille
    // silencieuse.
    expect(directive(production, "script-src")).not.toContain("'unsafe-eval'");
    expect(directive(development, "script-src")).toContain("'unsafe-eval'");
  });

  it("force HTTPS en production seulement", () => {
    expect(production).toContain("upgrade-insecure-requests");
    expect(development).not.toContain("upgrade-insecure-requests");
  });

  it("interdit toute mise en cadre et tout plugin", () => {
    expect(production).toContain("frame-ancestors 'none'");
    expect(production).toContain("object-src 'none'");
  });

  it("garde les styles inline — Tailwind et styled-jsx en produisent", () => {
    // Documenté comme un écart assumé : le risque est d'une autre nature que
    // l'exécution de code.
    expect(directive(production, "style-src")).toContain("'unsafe-inline'");
  });
});

describe("generateCspNonce", () => {
  it("produit une valeur différente à chaque appel", () => {
    // Un nonce réutilisé entre deux réponses n'en est plus un : il devient une
    // valeur devinable par quiconque a vu une page.
    const nonces = new Set(Array.from({ length: 50 }, () => generateCspNonce()));
    expect(nonces.size).toBe(50);
  });

  it("produit 128 bits encodés en base64", () => {
    expect(generateCspNonce()).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});
