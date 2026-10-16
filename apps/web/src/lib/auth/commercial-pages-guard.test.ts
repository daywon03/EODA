import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CABINET_ROLES, hasCabinetCapability } from "./capabilities";

// ─────────────────────────────────────────────────────────────────────────────
// Le module commercial est réservé à la capacité COMMERCIAL — CABINET_ADMIN et
// CABINET_COMMERCIAL (CLAUDE.md §7, N9). La barre latérale MASQUE la section aux
// autres rôles ; ce test vérifie qu'elle est aussi PROTÉGÉE côté serveur, page par
// page — masquer un lien n'a jamais fermé une adresse qu'on tape à la main (Règle
// zéro : une règle sans contrôle est un souhait).
//
// Trois contrôles :
//   1. chaque page du module appelle requireCommercialSession(), ou lit ses données
//      par un module d'actions commercial ;
//   2. chaque fonction exportée de ces modules appelle requireCommercialSession()
//      — sinon le contrôle 1 ne prouverait rien ;
//   3. la garde elle-même exige bien la capacité COMMERCIAL, et la matrice ne la
//      donne qu'à l'administration et au commercial.
// ─────────────────────────────────────────────────────────────────────────────

const SRC = path.resolve(__dirname, "../..");
const COMMERCIAL_DIR = path.join(SRC, "app/dashboard/cabinet/commercial");
const ADMIN_ONLY_ACTION_MODULES = ["prospect", "prospect-pipeline", "commercial-overview", "devis", "devis-read", "devis-email", "catalogue", "conversion", "discovery", "option-request"];
const GUARD = "requireCommercialSession()";

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
    "%s passe par la garde commerciale",
    (_name, page) => {
      const source = readFileSync(page, "utf8");
      expect(source.includes(GUARD) || importsAdminModule(source)).toBe(true);
    }
  );
});

describe("la garde commerciale — capacité COMMERCIAL, et elle seule", () => {
  it("requireCommercialSession exige la capacité COMMERCIAL", () => {
    const guards = readFileSync(path.join(SRC, "lib/auth/guards.ts"), "utf8");
    expect(guards).toMatch(/export async function requireCommercialSession\(\)[^{]*\{\s*return requireCabinetSession\("COMMERCIAL"\);/);
  });

  it("seuls l'administration et le commercial ont la capacité", () => {
    const allowed = CABINET_ROLES.filter((role) => hasCabinetCapability(role, "COMMERCIAL"));
    expect(allowed).toEqual(["CABINET_ADMIN", "CABINET_COMMERCIAL"]);
    expect(hasCabinetCapability("CLIENT_USER", "COMMERCIAL")).toBe(false);
  });
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
