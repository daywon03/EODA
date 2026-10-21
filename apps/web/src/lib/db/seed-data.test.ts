import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  REQUESTED_FROM_CLIENT_DOCUMENT_CODES,
  SAD_MIXTE_CRITERIA,
  SEED_CLIENT_USER,
  SEED_TENANT_ID,
} from "@eoda/database/seed-data";
import { DOCUMENT_TYPE_SEEDS, PILOT_DOCUMENT_TYPES } from "@eoda/database/document-types";

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

// Les corrections d'intitulé : `UPDATE "criteria" SET "label" = '…' WHERE "code" = 'x' …`.
function labelUpdatesIn(sql: string): Map<string, string> {
  const pattern = /UPDATE "criteria"\s+SET "label" = '((?:[^']|'')*)'\s+WHERE "code" = '([\d.]+)'/g;
  return new Map([...sql.matchAll(pattern)].map((m) => [m[2]!, m[1]!.replace(/''/g, "'")]));
}

// État FINAL des critères SAD mixte sur une base existante : insertion d'origine, puis
// corrections d'intitulé des migrations suivantes, dans l'ordre.
function sadMixteCriteriaAfterMigrations() {
  const corrections = labelUpdatesIn(migrationSql("20261014110000_sad_mixte_full_labels"));
  return sadMixteCriteriaIn(migrationSql("20261011110000_sad_mixte_criteria")).map((criterion) => ({
    ...criterion,
    label: corrections.get(criterion.code!) ?? criterion.label,
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
  it("reprend à l'identique les 15 critères de 20261011110000, intitulés corrigés par 20261014110000", () => {
    const fromMigrations = sadMixteCriteriaAfterMigrations();

    expect(fromMigrations).toHaveLength(15);
    expect(SAD_MIXTE_CRITERIA.map((c) => ({ ...c, applicableTo: "SAD_MIXTE" }))).toEqual(fromMigrations);
  });

  it("la migration corrective ne vise que les trois intitulés tronqués, et elle est idempotente", () => {
    const sql = migrationSql("20261014110000_sad_mixte_full_labels");

    expect([...labelUpdatesIn(sql).keys()]).toEqual(["3.6.1", "3.6.3", "3.6.5"]);
    for (const [code, label] of labelUpdatesIn(sql)) {
      const guard = `WHERE "code" = '${code}' AND "applicable_to" = 'SAD_MIXTE'::"ApplicableTo"\n  AND "label" <> '${label.replace(/'/g, "''")}'`;
      expect(sql).toContain(guard);
    }
  });

  it("plus aucun intitulé tronqué : chaque intitulé est une phrase complète du manuel", () => {
    for (const criterion of SAD_MIXTE_CRITERIA) {
      expect(criterion.label).not.toMatch(/tronqué|\[…\]/);
      expect(criterion.label.endsWith(".")).toBe(true);
    }
  });

  it("un seul impératif (3.6.2), conformément au context/02 §4 (17 impératifs SAD mixte)", () => {
    expect(SAD_MIXTE_CRITERIA.filter((c) => c.requirementLevel === "IMPERATIF").map((c) => c.code)).toEqual([
      "3.6.2",
    ]);
  });
});

// Les lignes `('doctype-…', 'CODE', 'CATEGORIE'::"DocumentCategory", 'Libellé', false, NULL, false)`.
function insertedDocumentTypesIn(sql: string) {
  const pattern =
    /\('(doctype-[a-z0-9-]+)', '([A-Z0-9_]+)', '([A-Z0-9_]+)'::"DocumentCategory", '((?:[^']|'')*)', false, NULL, false\)/g;
  return [...sql.matchAll(pattern)].map((m) => ({
    id: m[1],
    code: m[2],
    category: m[3],
    label: m[4]!.replace(/''/g, "'"),
  }));
}

describe("seed — types de document du référentiel du pilote", () => {
  const sql = migrationSql("20261014120000_pilot_document_types");
  const inserted = insertedDocumentTypesIn(sql);

  // 20261021090000 renomme quatre gabarits (« modèle vierge » → « … personnalisé ») :
  // le seed reflète l'état APRÈS les deux migrations, rejouées ici.
  const renameSql = migrationSql("20261021090000_blank_model_personalized_labels");
  const renamedCodes = new Set([...renameSql.matchAll(/'([A-Z0-9_]+)'/g)].map((m) => m[1]!));

  it("reprend exactement les 19 types insérés par 20261014120000, libellés renommés le 21/10 compris", () => {
    expect(inserted).toHaveLength(19);
    expect(renamedCodes.size).toBe(4);
    expect(PILOT_DOCUMENT_TYPES.map(({ code, category, label }) => ({ code, category, label }))).toEqual(
      inserted.map(({ code, category, label }) => ({
        code,
        category,
        label: code && renamedCodes.has(code) ? `${label} personnalisé` : label,
      }))
    );
  });

  it("la migration est idempotente et n'écrase jamais un type existant", () => {
    expect(sql).toMatch(/ON CONFLICT \("code"\) DO NOTHING;\s*$/);
    expect(sql).not.toMatch(/\b(UPDATE|DELETE|DROP|ALTER)\b/);
  });

  it("identifiants stables dérivés du code", () => {
    for (const row of inserted) expect(row.id).toBe(`doctype-${row.code!.toLowerCase().replace(/_/g, "-")}`);
  });

  it("aucun type réclamé à la structure, aucun dans la catégorie des sept documents de la loi 2002-2", () => {
    for (const type of PILOT_DOCUMENT_TYPES) {
      expect(REQUESTED_FROM_CLIENT_DOCUMENT_CODES).not.toContain(type.code);
      expect(type.category).not.toBe("LOI_2002_2");
    }
  });

  it("aucune périodicité posée : elles portent sur le document individuel, pas sur le modèle", () => {
    for (const type of PILOT_DOCUMENT_TYPES) expect(type.expectedFrequency).toBeUndefined();
  });

  it("HDS : PAP, fiche des tâches et grille d'évaluation des besoins ne désignent que le modèle vierge", () => {
    for (const code of ["FONCT_PAP_GABARIT", "FONCT_FICHE_TACHES_GABARIT", "FONCT_GRILLE_EVAL_BESOINS"]) {
      expect(PILOT_DOCUMENT_TYPES.find((t) => t.code === code)?.label).toMatch(/modèle vierge/);
    }
  });

  it("aucun code en double dans la liste complète du seed (66 types)", () => {
    const codes = DOCUMENT_TYPE_SEEDS.map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toHaveLength(66);
  });
});

describe("seed — compte client de test", () => {
  it("rattaché au tenant du seed, sinon aucun cabinet ne peut jamais le rattacher (fail-closed)", () => {
    expect(SEED_CLIENT_USER.tenantId).toBe(SEED_TENANT_ID);
    expect(SEED_CLIENT_USER.email.endsWith("@eoda-test.local")).toBe(true);
  });
});
