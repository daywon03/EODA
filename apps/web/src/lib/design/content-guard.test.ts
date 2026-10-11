import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// RÈGLE ZÉRO pour trois décisions écrites qu'aucun outil ne vérifiait :
//   1. Sigle DIPC partout, jamais « DIPEC » ni « DPEC » (décision 9 des maquettes v2,
//      bilan du 08/10 §3.2) — dans l'interface, les contenus ET les tests.
//   2. Aucune donnée du client pilote dans le code, les tests, les fixtures, les seeds
//      (CLAUDE.md §7) : ni son nom, ni sa commune, ni son FINESS. Données fictives
//      marquées (« SAD Les Glycines (fictif) »).
//   3. Un seul champ de mot de passe, avec son œil (`PasswordInput`) : aucun
//      `type="password"` écrit ailleurs.
// Les motifs sont assemblés par morceaux pour que ce fichier ne se signale pas
// lui-même. Les migrations déjà commitées sont hors champ : elles ne se modifient
// jamais (une seule porte un commentaire ancien, laissé tel quel).

const WEB_SRC = path.resolve(__dirname, "../..");
const REPO = path.resolve(WEB_SRC, "../../..");
const SEEDS = [
  path.join(REPO, "packages/database/prisma/seed.ts"),
  path.join(REPO, "packages/database/prisma/seed-has-referential.ts"),
];

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return listFiles(full);
    return /\.(ts|tsx|md|json|csv)$/.test(entry) ? [full] : [];
  });
}

function offenders(files: string[], pattern: RegExp, except: string[] = []): string[] {
  return files.flatMap((file) => {
    if (except.some((suffix) => file.endsWith(suffix))) return [];
    return readFileSync(file, "utf8")
      .split("\n")
      .flatMap((line, i) => (pattern.test(line) ? [`${path.relative(REPO, file)}:${i + 1}`] : []));
  });
}

const THIS_FILE = "lib/design/content-guard.test.ts";
const scanned = [...listFiles(WEB_SRC), ...SEEDS];

describe("contenus et données — règles vérifiées", () => {
  it("n'écrit jamais DIPEC ni DPEC", () => {
    const pattern = new RegExp(["\\bDI", "PEC\\b|\\bDP", "EC\\b"].join(""), "i");
    expect(offenders(scanned, pattern, [THIS_FILE, "status-vocabulary.test.ts"])).toEqual([]);
  });

  it("ne contient aucune donnée du client pilote", () => {
    const pattern = new RegExp(
      ["AS", "SAD|BEN", "O[IÎ]T|Blanc-", "Mesnil|9300", "34459|93 00 ", "34 459"].join(""),
      "i"
    );
    expect(offenders(scanned, pattern, [THIS_FILE])).toEqual([]);
  });

  it("n'écrit un champ de mot de passe qu'à un seul endroit", () => {
    const pattern = new RegExp(['type="pass', 'word"'].join(""));
    expect(offenders(listFiles(WEB_SRC), pattern, [THIS_FILE])).toEqual([]);
  });
});
