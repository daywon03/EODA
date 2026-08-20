import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EXPECTED_MIGRATIONS } from "@eoda/database";

// RÈGLE ZÉRO : le manifeste de migrations (packages/database/src/migrations.ts) est
// une duplication du contenu de prisma/migrations. Une duplication qu'aucune machine
// ne vérifie dérive silencieusement — et ici la dérive est invisible jusqu'au jour
// où le contrôle de démarrage annonce « schéma à jour » sur une base en retard.
// Ce test EST le contrôle mécanique : ajouter une migration sans l'ajouter au
// manifeste fait échouer la CI.
const MIGRATIONS_DIR = path.resolve(
  __dirname,
  "../../../../../packages/database/prisma/migrations"
);

describe("manifeste des migrations", () => {
  it("liste exactement les dossiers de prisma/migrations, dans l'ordre chronologique", () => {
    const onDisk = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    expect([...EXPECTED_MIGRATIONS].sort()).toEqual(onDisk);
    // L'ordre du manifeste doit être celui d'application (préfixe horodaté).
    expect([...EXPECTED_MIGRATIONS]).toEqual([...EXPECTED_MIGRATIONS].sort());
  });
});
