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

  it("autorise l'aperçu depuis l'URL signée du STOCKAGE, et plus n'importe quel site (audit du 28/10/2026)", () => {
    // Régression du 16/09/2026 : sans l'origine du stockage, un document déposé en
    // .jpg/.png ne s'affichait pas (icône cassée). La correction d'alors ouvrait
    // `https:` entier ; seule l'origine du stockage est désormais admise.
    const withStorage = buildContentSecurityPolicy({ nonce: "n", isProduction: true, storageOrigin: "https://abc.supabase.co" });
    for (const name of ["img-src", "frame-src", "connect-src"]) {
      expect(directive(withStorage, name)).toContain("https://abc.supabase.co");
      expect(directive(withStorage, name).split(" ")).not.toContain("https:");
      expect(directive(production, name).split(" ")).not.toContain("https:");
    }
  });

  it("refuse une origine de stockage mal formée (rien d'injecté dans la politique), n'admet vercel.live qu'en prévisualisation", () => {
    const odd = buildContentSecurityPolicy({ nonce: "n", isProduction: true, storageOrigin: "https://x.co; script-src *" });
    expect(odd).not.toContain("x.co");
    expect(production).not.toContain("vercel.live");
    expect(buildContentSecurityPolicy({ nonce: "n", isProduction: true, vercelPreview: true })).toContain("https://vercel.live");
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
