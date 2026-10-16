import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// LECTURE SEULE (N9) — une action gardée en LECTURE n'écrit rien.
//
// CABINET_READONLY passe toutes les gardes de lecture. Si une action gardée en
// « READ » contient une écriture, la lecture seule écrit — sans qu'aucun test
// d'autorisation ne le voie, puisque la garde, elle, fait exactement ce qu'on lui
// demande. Ce test lit chaque action exportée de lib/actions et refuse qu'une
// fonction dont la garde est de LECTURE contienne une écriture Prisma.
//
// Ce qu'il ne fait pas : deviner qu'une écriture est gardée en READ par une fonction
// auxiliaire appelée plus bas. Les gardes sont toujours la première instruction des
// actions de ce dépôt ; c'est ce que regarde le test.
// ─────────────────────────────────────────────────────────────────────────────

const ACTIONS_DIR = path.resolve(__dirname, "../actions");

const READ_GUARDS = [
  /requireEstablishmentInTenant\([^)]*"READ"\)/,
  /requireCabinetSession\("STRUCTURES_READ"\)/,
  /requireCabinetSession\("LIBRARY_READ"\)/,
  /tryCabinetSession\("STRUCTURES_READ"\)/,
  /(require|try)EstablishmentAccess\([^)]*NEED\.\w+_READ\)/,
];
const WRITE = /prisma\.\w+\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(|\$transaction\(/;

function exportedFunctions(source: string): { name: string; body: string }[] {
  const parts = source.split(/^export async function /m).slice(1);
  // Le corps s'arrête à la première accolade fermante en colonne 0 : la fin de la
  // fonction, pas celle du fichier (sinon une fonction auxiliaire non exportée
  // placée après serait comptée dans le corps).
  return parts.map((part) => {
    const end = part.indexOf("\n}\n");
    return { name: part.slice(0, part.indexOf("(")), body: end === -1 ? part : part.slice(0, end) };
  });
}

const files = readdirSync(ACTIONS_DIR).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

describe("une garde de lecture ne couvre aucune écriture", () => {
  it("parcourt bien les actions (le contrôle ne tourne pas à vide)", () => {
    const guardedReads = files.flatMap((file) =>
      exportedFunctions(readFileSync(path.join(ACTIONS_DIR, file), "utf8")).filter((fn) =>
        READ_GUARDS.some((guard) => guard.test(fn.body))
      )
    );
    expect(guardedReads.length).toBeGreaterThan(20);
  });

  it.each(files)("lib/actions/%s", (file) => {
    for (const fn of exportedFunctions(readFileSync(path.join(ACTIONS_DIR, file), "utf8"))) {
      const guardedForRead = READ_GUARDS.some((guard) => guard.test(fn.body));
      if (!guardedForRead) continue;
      expect({ fn: fn.name, writes: WRITE.test(fn.body) }).toEqual({ fn: fn.name, writes: false });
    }
  });
});
