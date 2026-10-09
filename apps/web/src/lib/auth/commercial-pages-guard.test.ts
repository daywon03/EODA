import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Le module commercial est réservé à CABINET_ADMIN (CLAUDE.md §7). La barre
// latérale MASQUE la section aux autres rôles ; ce test vérifie qu'elle est aussi
// PROTÉGÉE côté serveur, page par page — masquer un lien n'a jamais fermé une
// adresse qu'on tape à la main (Règle zéro : une règle sans contrôle est un souhait).
//
// Deux contrôles :
//   1. chaque page du module appelle requireCabinetAdminSession(), ou lit ses
//      données par un module d'actions réservé à l'admin ;
//   2. chaque fonction exportée de ces modules appelle requireCabinetAdminSession()
//      — sinon le contrôle 1 ne prouverait rien.
// ─────────────────────────────────────────────────────────────────────────────

const SRC = path.resolve(__dirname, "../..");
const COMMERCIAL_DIR = path.join(SRC, "app/dashboard/cabinet/commercial");
const ADMIN_ONLY_ACTION_MODULES = ["prospect", "devis", "catalogue", "conversion", "discovery", "option-request"];
const GUARD = "requireCabinetAdminSession()";

function findPages(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return findPages(full);
    return entry === "page.tsx" ? [full] : [];
  });
}

function importsAdminModule(source: string): boolean {
  return ADMIN_ONLY_ACTION_MODULES.some((name) => source.includes(`from "@/lib/actions/${name}"`));
}

describe("module commercial — protection serveur de chaque page", () => {
  const pages = findPages(COMMERCIAL_DIR);

  it("trouve les pages du module (le contrôle ne tourne pas à vide)", () => {
    expect(pages.length).toBeGreaterThanOrEqual(10);
  });

  it.each(pages.map((page) => [path.relative(COMMERCIAL_DIR, page), page]))(
    "%s passe par la garde admin",
    (_name, page) => {
      const source = readFileSync(page, "utf8");
      expect(source.includes(GUARD) || importsAdminModule(source)).toBe(true);
    }
  );
});

describe("modules d'actions commerciales — chaque export est gardé", () => {
  it.each(ADMIN_ONLY_ACTION_MODULES)("lib/actions/%s.ts", (name) => {
    const source = readFileSync(path.join(SRC, "lib/actions", `${name}.ts`), "utf8");
    const exported = source.split(/^export async function /m).slice(1);
    expect(exported.length).toBeGreaterThan(0);
    for (const body of exported) {
      const functionName = body.slice(0, body.indexOf("("));
      expect({ functionName, guarded: body.includes(GUARD) }).toEqual({ functionName, guarded: true });
    }
  });
});
