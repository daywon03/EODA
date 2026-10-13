import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Titres d'onglet (test de bout en bout du 12/10/2026) : neuf écrans du portail
// s'affichaient sous le titre générique de l'application — dix onglets ouverts,
// dix fois le même nom. La règle est vérifiée ici, pas seulement écrite :
//   1. chaque page de /dashboard déclare son titre (`metadata` ou `generateMetadata`) ;
//   2. le suffixe « — EODA » vient du gabarit du layout racine (`title.template`),
//      donc aucune page ne l'écrit elle-même — sinon il s'afficherait deux fois.

const APP_DIR = path.resolve(__dirname);
const DASHBOARD_DIR = path.join(APP_DIR, "dashboard");

// Pages qui ne rendent rien : elles redirigent selon le rôle.
const REDIRECT_ONLY = new Set([path.join(DASHBOARD_DIR, "page.tsx")]);

function listPages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listPages(full);
    return entry.name === "page.tsx" ? [full] : [];
  });
}

const pages = listPages(DASHBOARD_DIR).filter((p) => !REDIRECT_ONLY.has(p));

describe("titres d'onglet", () => {
  it("le layout racine porte le gabarit « {Page} — EODA »", () => {
    const layout = readFileSync(path.join(APP_DIR, "layout.tsx"), "utf8");
    expect(layout).toContain('template: "%s — EODA"');
  });

  it.each(pages.map((p) => [path.relative(APP_DIR, p), p]))(
    "%s déclare son titre",
    (_relative, file) => {
      const source = readFileSync(file, "utf8");
      expect(source).toMatch(/export (const metadata|async function generateMetadata)/);
    }
  );

  it.each(listPages(APP_DIR).map((p) => [path.relative(APP_DIR, p), p]))(
    "%s n'écrit pas le suffixe lui-même",
    (_relative, file) => {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/title:[^\n]*(EODA Conseil|Modèles EODA)/);
    }
  );
});
