import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// ENQUÊTE ANONYME — garde mécanique (Règle zéro, 21/10/2026).
//
// L'enquête anonyme vit HORS du verrou HDS pour une seule raison : ses tables ne
// peuvent pas contenir de donnée de personne. Ce test lit le schéma et échoue si un
// champ qui le permettrait y apparaît — lien vers une personne ou un salarié, texte
// libre, horodatage d'une réponse. Ajouter un tel champ, c'est remettre l'enquête
// sous le verrou HDS, pas modifier ce test.
// ─────────────────────────────────────────────────────────────────────────────

const SCHEMA = readFileSync(path.resolve(__dirname, "../../../../../packages/database/prisma/schema.prisma"), "utf8");

function modelBody(name: string): string {
  const match = new RegExp(`^model ${name} \\{([\\s\\S]*?)^\\}`, "m").exec(SCHEMA);
  if (!match?.[1]) throw new Error(`Modèle ${name} introuvable dans le schéma.`);
  return match[1];
}

function fieldNames(body: string): string[] {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("//") && !line.startsWith("@@"))
    .map((line) => line.split(/\s+/)[0]!);
}

const ALLOWED: Record<string, string[]> = {
  AnonymousSurveyResponse: [
    "id",
    "tenantId",
    "establishmentId",
    "templateCode",
    "templateVersion",
    "respondentKind",
    "mode",
    "channel",
    "completedOn",
    "tenant",
    "establishment",
    "answers",
  ],
  AnonymousSurveyAnswer: ["id", "responseId", "questionId", "choice", "response"],
};

describe("tables de l'enquête anonyme — aucune donnée de personne possible", () => {
  it.each(Object.entries(ALLOWED))("%s n'a que des champs d'échelle", (model, allowed) => {
    expect(fieldNames(modelBody(model)).sort()).toEqual([...allowed].sort());
  });

  it("la réponse est datée au JOUR, jamais à l'heure", () => {
    expect(modelBody("AnonymousSurveyResponse")).toMatch(/completedOn\s+DateTime\s+@map\("completed_on"\)\s+@db\.Date/);
  });

  it("une réponse est un choix d'échelle obligatoire, jamais un texte", () => {
    expect(modelBody("AnonymousSurveyAnswer")).toMatch(/choice\s+SurveyChoice\s*\n/);
  });

  it("le lien à usage unique ne désigne personne et ne garde que l'empreinte du jeton", () => {
    const invite = fieldNames(modelBody("AnonymousSurveyInvite"));
    expect(invite).toContain("tokenHash");
    expect(invite.some((f) => /beneficiary|staff|email|phone|name|token$/i.test(f))).toBe(false);
  });
});
