import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// UNE MIGRATION ÉCRITE À LA MAIN VISE UNE TABLE QUI EXISTE (Règle zéro, 21/10/2026).
//
// Le 21/10/2026, `20261021090000_blank_model_personalized_labels` visait
// "DocumentType" — le nom du MODÈLE — au lieu de "document_types" (son @@map). Le
// SQL n'est relu par aucun test, `prisma validate` ne le lit pas : la migration a
// échoué au déploiement, et Prisma a bloqué toutes les suivantes (P3009) sur la base
// que le poste partage avec la production. Ce test compare chaque table citée par une
// migration aux tables du schéma et à celles que les migrations ont créées.
// ─────────────────────────────────────────────────────────────────────────────

const DATABASE = path.resolve(__dirname, "../../../../../packages/database/prisma");
const MIGRATIONS = path.join(DATABASE, "migrations");

const schema = readFileSync(path.join(DATABASE, "schema.prisma"), "utf8");
const mappedTables = new Set([...schema.matchAll(/@@map\("([^"]+)"\)/g)].map((m) => m[1]!));

const migrations = readdirSync(MIGRATIONS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => ({ name: entry.name, sql: readFileSync(path.join(MIGRATIONS, entry.name, "migration.sql"), "utf8") }));

// Retire les commentaires SQL : un nom cité en commentaire n'est pas une requête.
const code = (sql: string) => sql.replace(/--.*$/gm, "");

const createdTables = new Set(
  migrations.flatMap((m) => [...code(m.sql).matchAll(/CREATE TABLE (?:IF NOT EXISTS )?"([^"]+)"/g)].map((x) => x[1]!))
);
const renamedTables = new Set(
  migrations.flatMap((m) => [...code(m.sql).matchAll(/RENAME TO "([^"]+)"/g)].map((x) => x[1]!))
);
const known = new Set([...mappedTables, ...createdTables, ...renamedTables, "_prisma_migrations"]);

const REFERENCE = /\b(?:UPDATE|INSERT INTO|DELETE FROM|ALTER TABLE(?: ONLY)?|REFERENCES|FROM|JOIN)\s+"([^"]+)"/g;

describe("migrations — chaque table citée existe", () => {
  it.each(migrations.map((m) => [m.name, m.sql] as const))("%s", (_name, sql) => {
    const cited = [...code(sql).matchAll(REFERENCE)].map((m) => m[1]!);
    expect(cited.filter((table) => !known.has(table))).toEqual([]);
  });

  it("le motif reconnaît l'erreur du 21/10/2026 (le test sait échouer)", () => {
    const cited = [...code('UPDATE "DocumentType" SET "label" = 1').matchAll(REFERENCE)].map((m) => m[1]!);
    expect(cited.filter((table) => !known.has(table))).toEqual(["DocumentType"]);
  });
});
