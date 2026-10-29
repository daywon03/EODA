// ─────────────────────────────────────────────────────────────────────────────
// MANIFESTE DES MIGRATIONS — GÉNÉRÉ, jamais écrit à la main (29/10/2026).
//
// La liste des migrations attendues était recopiée à la main dans
// src/migrations.ts : chaque PR qui ajoutait une migration ajoutait une ligne À LA FIN
// de la même liste, et deux PR en vol se heurtaient à chaque merge (conflit
// systématique). La liste est désormais LUE dans prisma/migrations et écrite dans
// src/migrations.generated.ts (non versionné), à chaque `prisma generate` : à
// l'installation (postinstall), en CI et dans le build Vercel (`pnpm db:generate`).
//
// Pourquoi un fichier et pas une lecture du dossier à l'exécution : l'application
// déployée ne contient pas prisma/migrations (artefact Next.js tracé). La liste est
// donc figée au BUILD, à partir du dossier — la même source, sans copie à la main.
// ─────────────────────────────────────────────────────────────────────────────
import { readdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "prisma", "migrations");
const target = join(root, "src", "migrations.generated.ts");

const names = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const content = `// FICHIER GÉNÉRÉ par scripts/generate-migration-manifest.mjs — ne pas modifier.
// Régénéré à chaque \`pnpm db:generate\` depuis prisma/migrations (non versionné).
export const EXPECTED_MIGRATIONS: readonly string[] = ${JSON.stringify(names, null, 2)} as const;
`;

// N'écrit que si le contenu change : pas de rebuild inutile en développement.
if (!existsSync(target) || readFileSync(target, "utf8") !== content) {
  writeFileSync(target, content);
}
console.log(`Manifeste des migrations : ${names.length} migration(s).`);
