import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// RÈGLE ZÉRO pour trois décisions écrites qu'aucun outil ne vérifiait :
//   1. Sigle « DIPEC » partout, comme l'écrit Sandrine (décision de Damon du 27/10/2026,
//      qui renverse la décision 9 des maquettes v2) — dans l'interface, les contenus,
//      les noms de fichiers ET les tests. Seuls restent les identifiants internes, qui
//      sont des clés et non des mots : le code de type `L2002_DIPC`, les constantes
//      (`TABLET_DIPC_…`), et la valeur d'énumération écrite seule entre guillemets.
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

// Délai élargi : le parcours de tout `src` peut dépasser 5 s quand la suite tourne en parallèle.
describe("contenus et données — règles vérifiées", { timeout: 30_000 }, () => {
  it("écrit DIPEC, jamais DIPC ni DPEC", () => {
    // `\b` ne coupe pas sur `_` : L2002_DIPC et TABLET_DIPC_… ne sont pas des mots.
    // « DIPC » seul entre guillemets est une valeur d'énumération, jamais affichée.
    // Sensible à la casse : `dipc-tablet-preparation`, `t-dipc` sont des noms de code.
    const pattern = new RegExp(["(?<![\"'])\\bDI", "PC\\b|\\bDI", "PC\\b(?![\"'])|\\bDP", "EC\\b"].join(""));
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
