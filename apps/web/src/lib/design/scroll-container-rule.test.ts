import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Recette du 13/10/2026, à 390 px : la page Prospects défilait horizontalement
// (document de 883 px). Cause : un `sr-only` (position: absolute) dans un conteneur
// `overflow-x-auto` NON positionné échappe au conteneur et s'aligne sur la page —
// l'en-tête « Action » d'un tableau de 1 000 px, les compteurs des onglets. Un
// conteneur de défilement horizontal est donc toujours `relative`.
const ROOTS = ["app", "components"].map((dir) => path.resolve(__dirname, "../..", dir));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(tsx|ts)$/.test(name) && !/\.test\.ts$/.test(name) ? [full] : [];
  });
}

describe("conteneurs de défilement horizontal", () => {
  it("toute classe `overflow-x-auto` est accompagnée de `relative`", () => {
    const offenders: string[] = [];
    for (const file of ROOTS.flatMap(sourceFiles)) {
      for (const [index, line] of readFileSync(file, "utf8").split("\n").entries()) {
        for (const literal of line.match(/"[^"]*overflow-x-auto[^"]*"/g) ?? []) {
          if (!/(^|[\s"])relative(\s|")/.test(literal)) offenders.push(`${path.relative(process.cwd(), file)}:${index + 1}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
