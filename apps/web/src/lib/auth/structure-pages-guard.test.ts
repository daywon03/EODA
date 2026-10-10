import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Fiche structure en onglets (routes enfants de etablissements/[id]) : CHAQUE page
// re-vérifie l'appartenance de la fiche au tenant. Le gabarit commun (layout.tsx)
// se rend en parallèle de la page : une garde posée là seulement ne protégerait
// pas les lectures de la page (Règle zéro : la règle a son contrôle).
//
// Une page passe si elle appelle requireEstablishmentInTenant(), ou une lecture
// dont la PREMIÈRE instruction est cette garde (liste ci-dessous, vérifiée aussi).
// ─────────────────────────────────────────────────────────────────────────────

const SRC = path.resolve(__dirname, "../..");
const STRUCTURE_DIR = path.join(SRC, "app/dashboard/cabinet/etablissements/[id]");
const GUARD = "requireEstablishmentInTenant(";

// Lecture gardée → module qui la définit.
const GUARDED_READS: Record<string, string> = {
  "getEstablishment(": "lib/actions/establishment.ts",
  "getEstablishmentChecklist(": "lib/actions/checklist.ts",
};

function findFiles(dir: string, names: readonly string[]): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return findFiles(full, names);
    return names.includes(entry) ? [full] : [];
  });
}

function functionBody(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = source.indexOf("\nexport ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

describe("fiche structure — chaque route enfant re-vérifie le tenant", () => {
  const pages = findFiles(STRUCTURE_DIR, ["page.tsx", "layout.tsx"]);

  it("trouve les pages de la fiche (le contrôle ne tourne pas à vide)", () => {
    const names = pages.map((p) => path.relative(STRUCTURE_DIR, p));
    for (const expected of ["page.tsx", "layout.tsx", "documents/page.tsx", "reglages/page.tsx", "mission/page.tsx"]) {
      expect(names).toContain(expected);
    }
  });

  it.each(pages.map((page) => [path.relative(STRUCTURE_DIR, page), page]))("%s est gardée", (_name, page) => {
    const source = readFileSync(page, "utf8");
    const guarded = source.includes(GUARD) || Object.keys(GUARDED_READS).some((call) => source.includes(call));
    expect(guarded).toBe(true);
  });

  it.each(Object.entries(GUARDED_READS))("%s commence par la garde du tenant", (call, file) => {
    const body = functionBody(readFileSync(path.join(SRC, file), "utf8"), call.slice(0, -1));
    const firstAwait = body.slice(body.indexOf("{"), body.indexOf("{") + 400);
    expect(firstAwait).toMatch(/await (requireEstablishmentInTenant|requireCabinetSession)\(/);
    // getEstablishment borne SA lecture au tenant et répond notFound() sinon.
    if (call === "getEstablishment(") {
      expect(body).toContain("where: { id, tenantId }");
      expect(body).toContain("notFound()");
    }
  });
});
