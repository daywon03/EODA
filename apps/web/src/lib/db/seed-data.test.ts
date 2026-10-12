import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  REQUESTED_FROM_CLIENT_DOCUMENT_CODES,
  SAD_MIXTE_CRITERIA,
  SEED_CLIENT_USER,
  SEED_TENANT_ID,
} from "@eoda/database/seed-data";

// RÈGLE ZÉRO (bug 7 du test de bout en bout, 12/10/2026) : sur une base NEUVE, les
// migrations s'exécutent AVANT le seed. Les mises à jour de données qu'elles portent
// (documents réclamés, critères SAD mixte) ne touchent donc rien : les lignes visées
// n'existent pas encore. Le seed doit reprendre les mêmes données — et cette
// duplication est tenue ici, en relisant le SQL des migrations : si l'une change sans
// l'autre, ce test rougit.

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../../../packages/database/prisma/migrations");

function migrationSql(name: string): string {
  return readFileSync(path.join(MIGRATIONS_DIR, name, "migration.sql"), "utf8");
}

// Codes cités dans les `UPDATE "document_types" SET "requested_from_client" = true WHERE "code" IN (...)`.
function requestedCodesIn(sql: string): string[] {
  const codes: string[] = [];
  const updates = sql.matchAll(
    /UPDATE "document_types"\s+SET "requested_from_client" = true\s+WHERE "code" IN \(([^)]*)\)/g
  );
  for (const update of updates) {
    for (const code of (update[1] ?? "").matchAll(/'([A-Z0-9_]+)'/g)) codes.push(code[1]!);
  }
  return codes;
}

// Un `INSERT INTO "criteria"` par critère : id, code, intitulé (quotes SQL doublées),
// niveau, champ d'application et objectif de rattachement.
function sadMixteCriteriaIn(sql: string) {
  const pattern =
    /SELECT '([^']+)', o\."id", '([\d.]+)', '((?:[^']|'')*)', '(\w+)'::"RequirementLevel", '(\w+)'::"ApplicableTo"[\s\S]*?c\."number" = (\d) AND o\."code" = '([\d.]+)'/g;
  return [...sql.matchAll(pattern)].map((m) => ({
    id: m[1],
    code: m[2],
    label: m[3]!.replace(/''/g, "'"),
    requirementLevel: m[4],
    applicableTo: m[5],
    chapterNumber: Number(m[6]),
    objectiveCode: m[7],
  }));
}

describe("seed — documents réclamés à la structure", () => {
  it("reprend exactement les codes des migrations 20260827140000 et 20261010120000 (les 7 de la loi 2002-2)", () => {
    const fromMigrations = [
      ...requestedCodesIn(migrationSql("20260827140000_document_types_requested")),
      ...requestedCodesIn(migrationSql("20261010120000_support_mode_client_acceptance")),
    ].sort();

    expect(fromMigrations).toHaveLength(7);
    expect([...REQUESTED_FROM_CLIENT_DOCUMENT_CODES].sort()).toEqual(fromMigrations);
    expect(REQUESTED_FROM_CLIENT_DOCUMENT_CODES.every((code) => code.startsWith("L2002_"))).toBe(true);
  });
});

describe("seed — critères SAD mixte", () => {
  it("reprend à l'identique les 15 critères de la migration 20261011110000_sad_mixte_criteria", () => {
    const fromMigration = sadMixteCriteriaIn(migrationSql("20261011110000_sad_mixte_criteria"));

    expect(fromMigration).toHaveLength(15);
    expect(SAD_MIXTE_CRITERIA.map((c) => ({ ...c, applicableTo: "SAD_MIXTE" }))).toEqual(fromMigration);
  });

  it("un seul impératif (3.6.2), conformément au context/02 §4 (17 impératifs SAD mixte)", () => {
    expect(SAD_MIXTE_CRITERIA.filter((c) => c.requirementLevel === "IMPERATIF").map((c) => c.code)).toEqual([
      "3.6.2",
    ]);
  });
});

describe("seed — compte client de test", () => {
  it("rattaché au tenant du seed, sinon aucun cabinet ne peut jamais le rattacher (fail-closed)", () => {
    expect(SEED_CLIENT_USER.tenantId).toBe(SEED_TENANT_ID);
    expect(SEED_CLIENT_USER.email.endsWith("@eoda-test.local")).toBe(true);
  });
});
