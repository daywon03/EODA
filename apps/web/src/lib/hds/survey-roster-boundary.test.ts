import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// LISTE DES PERSONNES À ENQUÊTER — elle ne quitte jamais la tablette (22/10/2026).
//
// Nom + prénom d'une personne accompagnée = donnée de santé (ADR 20261014) : la liste
// vit dans le navigateur seulement, les réponses partent anonymes. « Jamais envoyée au
// serveur » n'est pas une consigne, c'est ce test : tout fichier qui importe le
// service de la liste ou le lecteur Excel DOIT être un composant client
// (`"use client"` en tête). Une action serveur, une route API ou une page serveur qui
// l'importerait — donc recevrait des noms — échoue en CI.
// ─────────────────────────────────────────────────────────────────────────────

// Depuis le 26/10/2026, la même frontière tient l'accueil d'une nouvelle personne et
// son DIPC signé (admission-*) : fiche d'identité, signatures et contrat ne quittent
// pas la tablette. Un import dynamique (`import("…/admission-pdf")`) est surveillé
// comme un import statique.
const SRC = path.resolve(__dirname, "../..");
const GUARDED_MODULES = ["survey-roster-service", "xlsx-rows-reader", "admission-service", "admission-document-service", "admission-pdf"];
const GUARDED = new RegExp(`(?:from\\s+|import\\(\\s*)["'][^"']*\\/(?:${GUARDED_MODULES.join("|")})["']`);
const OWN = GUARDED_MODULES.map((name) => path.join("lib", "services", `${name}.ts`));

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return listSourceFiles(full);
    return /\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });
}

function isClientModule(source: string): boolean {
  const firstStatement = source.replace(/^(?:\s*\/\/[^\n]*\n|\s*\/\*[\s\S]*?\*\/)*/, "").trimStart();
  return /^["']use client["']/.test(firstStatement);
}

function importers(): string[] {
  return listSourceFiles(SRC)
    .filter((file) => !OWN.includes(path.relative(SRC, file)))
    .filter((file) => GUARDED.test(readFileSync(file, "utf8")))
    .map((file) => path.relative(SRC, file));
}

describe("liste des personnes — côté navigateur seulement", () => {
  it("seuls des composants client importent la liste ou le lecteur Excel", () => {
    const serverSide = importers().filter((file) => !isClientModule(readFileSync(path.join(SRC, file), "utf8")));
    expect(serverSide).toEqual([]);
  });

  it("la liste et le contrat sont réellement utilisés (le garde ne surveille pas le vide)", () => {
    const sources = importers().map((file) => readFileSync(path.join(SRC, file), "utf8"));
    for (const name of ["survey-roster-service", "admission-service", "admission-pdf"]) {
      expect(sources.some((source) => source.includes(`/${name}"`))).toBe(true);
    }
  });

  it("le test sait échouer", () => {
    expect(GUARDED.test('import { planRosterImport } from "@/lib/services/survey-roster-service";')).toBe(true);
    expect(GUARDED.test('import { readXlsxRows } from "@/lib/services/xlsx-rows-reader";')).toBe(true);
    expect(GUARDED.test('import { planAdmissionDocument } from "@/lib/services/admission-document-service";')).toBe(true);
    expect(GUARDED.test('const pdf = await import("@/lib/services/admission-pdf");')).toBe(true);
    expect(GUARDED.test('import { selectTabletDipc } from "@/lib/services/tablet-dipc-service";')).toBe(false);
    expect(isClientModule('"use client";\nimport x from "y";')).toBe(true);
    expect(isClientModule('// commentaire\n"use client";')).toBe(true);
    expect(isClientModule('"use server";\nimport x from "y";')).toBe(false);
    expect(isClientModule('import x from "y";\n"use client";')).toBe(false);
  });
});
