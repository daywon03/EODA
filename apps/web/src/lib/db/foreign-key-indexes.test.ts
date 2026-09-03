import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// RÈGLE ZÉRO appliquée à la performance (convention P6).
//
// PostgreSQL n'indexe PAS les clés étrangères automatiquement — contrairement à
// MySQL, et contrairement à ce qu'on suppose en lisant un schéma Prisma. Le
// 03/09/2026, trente-quatre des nôtres n'en avaient aucune : chaque jointure faisait
// un parcours séquentiel de la table entière. Invisible sur quatre fiches, décisif au
// volume visé.
//
// Ce test EST le garde-fou. Il lit le SCHÉMA, pas la base : il tourne en CI sans
// connexion, et il échoue au moment où quelqu'un ajoute une relation sans index —
// c'est-à-dire au seul moment où la corriger est gratuit.
//
// Ce qu'il ne fait pas : vérifier que la base réelle porte ces index. C'est le rôle du
// manifeste de migrations, qui garantit que le schéma et la base ne divergent pas.
// ─────────────────────────────────────────────────────────────────────────────

// Colonnes de clé étrangère DÉLIBÉRÉMENT non indexées : les « qui a fait quoi ». On ne
// cherche jamais « tous les documents déposés par X », et un index qu'aucune lecture
// n'emprunte se paie à chaque écriture.
//
// ⚠️ Cette liste ne peut que DÉCROÎTRE. Y ajouter une entrée pour faire passer le test
// est le geste qui vide la règle de son sens : si une de ces colonnes devient un
// critère de recherche, elle sort de la liste et gagne son index.
const UNINDEXED_ON_PURPOSE = new Set([
  "DocumentVersion.uploadedByUserId",
  "DocumentVersion.analysisReviewedByUserId",
  "DocumentVersion.regeneratedFromVersionId",
  "Document.validatedByUserId",
  "EvaluationSession.performedByUserId",
  "ClientOptionRequest.requestedByUserId",
  "ProspectTimelineEntry.authorUserId",
  "MissionMessage.authorUserId",
  "TemplateVersion.uploadedByUserId",
  "Appointment.createdByUserId",
]);

const SCHEMA_PATH = path.resolve(__dirname, "../../../../../packages/database/prisma/schema.prisma");

type Model = {
  name: string;
  /** Premières colonnes de chaque index, contrainte unique ou clé primaire. */
  coveredFirstFields: Set<string>;
  /** Colonnes locales portant une relation, dans l'ordre déclaré. */
  relationFields: string[];
};

function parseModels(schema: string): Model[] {
  const models: Model[] = [];
  // Découpage par bloc `model X { ... }`. Volontairement naïf : le schéma est du texte
  // que nous écrivons nous-mêmes, une analyse complète serait de la cérémonie.
  const blocks = schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm);

  for (const block of blocks) {
    const name = block[1]!;
    const body = block[2]!;
    const coveredFirstFields = new Set<string>();
    const relationFields: string[] = [];

    for (const line of body.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("//")) continue;

      // Un index composite couvre les recherches sur son PREMIER champ — c'est la
      // règle du préfixe le plus à gauche, et c'est pour ça qu'on ne regarde que lui.
      const composite = trimmed.match(/^@@(?:index|unique|id)\(\[([^\]]+)\]/);
      if (composite) {
        const first = composite[1]!.split(",")[0]!.trim();
        coveredFirstFields.add(first);
        continue;
      }

      const fieldName = trimmed.match(/^(\w+)\s+\S/)?.[1];
      if (!fieldName) continue;

      // `@unique` et `@id` au niveau du champ créent un index sur ce champ.
      if (/@(unique|id)\b/.test(trimmed)) coveredFirstFields.add(fieldName);

      const relation = trimmed.match(/@relation\([^)]*fields:\s*\[([^\]]+)\]/);
      if (relation) {
        relationFields.push(relation[1]!.split(",")[0]!.trim());
      }
    }

    models.push({ name, coveredFirstFields, relationFields });
  }

  return models;
}

describe("index des clés étrangères (convention P6)", () => {
  const models = parseModels(readFileSync(SCHEMA_PATH, "utf8"));

  it("lit bien le schéma", () => {
    // Sans ce contrôle, un chemin cassé rendrait le test vert sur zéro modèle — le
    // scénario exact que la Règle zéro décrit : une règle qui ne vérifie plus rien.
    expect(models.length).toBeGreaterThan(20);
  });

  it("indexe toute clé étrangère qui n'est pas explicitement exclue", () => {
    const missing: string[] = [];

    for (const model of models) {
      for (const field of model.relationFields) {
        const key = `${model.name}.${field}`;
        if (UNINDEXED_ON_PURPOSE.has(key)) continue;
        if (model.coveredFirstFields.has(field)) continue;
        missing.push(key);
      }
    }

    expect(
      missing,
      `Clés étrangères sans index : ${missing.join(", ")}.\n` +
        "Ajoutez @@index([champ]) au modèle ET la migration correspondante, ou " +
        "justifiez l'exclusion dans UNINDEXED_ON_PURPOSE (cf. convention P6)."
    ).toEqual([]);
  });

  it("ne garde aucune exclusion devenue caduque", () => {
    // Une liste d'exceptions qui ne peut que décroître doit être vérifiée dans les
    // DEUX sens : une entrée qui ne désigne plus rien laisse croire qu'un choix est
    // toujours en vigueur alors que la colonne a disparu ou a gagné son index.
    const stale = [...UNINDEXED_ON_PURPOSE].filter((key) => {
      const [modelName, field] = key.split(".");
      const model = models.find((m) => m.name === modelName);
      if (!model) return true;
      return !model.relationFields.includes(field!) || model.coveredFirstFields.has(field!);
    });

    expect(stale, `Exclusions caduques à retirer : ${stale.join(", ")}`).toEqual([]);
  });
});
