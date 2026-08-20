import { prisma } from "@eoda/database";
import type { MigrationRow } from "./migration-status";

// Lecture de la table de suivi tenue par `prisma migrate deploy`. Requête brute
// assumée : `_prisma_migrations` n'est pas modélisée dans le schéma (elle appartient
// au CLI, pas au domaine) et ne doit surtout pas l'être — la modéliser la rendrait
// candidate à une migration générée, donc modifiable par l'application elle-même.
export async function readMigrationRows(): Promise<MigrationRow[]> {
  const rows = await prisma.$queryRaw<
    { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]
  >`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"`;

  return rows.map((row) => ({
    migrationName: row.migration_name,
    finishedAt: row.finished_at,
    rolledBackAt: row.rolled_back_at,
  }));
}
