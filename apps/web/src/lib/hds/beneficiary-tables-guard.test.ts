import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// VERROU HDS — garde mécanique n° 1 (Règle zéro, ADR 20261014).
//
// « Tout passe par le port » n'est pas une consigne, c'est ce test : il lit TOUT le
// code de apps/web/src et échoue si une ligne touche une table usager (délégué
// Prisma ou SQL brut) ailleurs que dans l'adaptateur Prisma du port. Un raccourci
// `prisma.beneficiary.create(...)` dans une action contournerait le verrou ; il ne
// passe pas la CI.
// ─────────────────────────────────────────────────────────────────────────────

const SRC = path.resolve(__dirname, "../..");
const ADAPTER = path.join("lib", "hds", "prisma-beneficiary-data-adapter.ts");

// Délégués Prisma des tables usager (camelCase du modèle).
const DELEGATES = [
  "beneficiary",
  "beneficiaryRepresentative",
  "beneficiaryDocument",
  "signatureEvidence",
  "deliveryRecord",
  "beneficiaryJournalEntry",
  "surveyResponse",
  "surveyAnswer",
];
const DELEGATE_PATTERN = new RegExp(`\\.\\s*(?:${DELEGATES.join("|")})\\s*\\.\\s*(?:\\w+)\\s*\\(`);
// Noms de tables SQL (@@map) — pour un $queryRaw / $executeRaw.
const TABLE_PATTERN =
  /\b(?:beneficiaries|beneficiary_representatives|beneficiary_documents|signature_evidences|delivery_records|beneficiary_journal_entries|survey_responses|survey_answers)\b/;

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return listSourceFiles(full);
    return /\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });
}

function offenders(pattern: RegExp): string[] {
  return listSourceFiles(SRC)
    .filter((file) => path.relative(SRC, file) !== ADAPTER)
    .filter((file) => pattern.test(readFileSync(file, "utf8")))
    .map((file) => path.relative(SRC, file));
}

describe("tables usager — accessibles par le port seulement", () => {
  it("aucun délégué Prisma usager hors de l'adaptateur", () => {
    expect(offenders(DELEGATE_PATTERN)).toEqual([]);
  });

  it("aucun SQL brut sur une table usager hors de l'adaptateur", () => {
    expect(offenders(TABLE_PATTERN)).toEqual([]);
  });

  it("le motif reconnaît bien un accès direct (le test sait échouer)", () => {
    expect(DELEGATE_PATTERN.test("await prisma.beneficiary.create({ data })")).toBe(true);
    expect(DELEGATE_PATTERN.test("tx.surveyAnswer.createMany({})")).toBe(true);
    expect(DELEGATE_PATTERN.test("prisma.staffMember.findMany()")).toBe(false);
    expect(TABLE_PATTERN.test("SELECT * FROM survey_responses")).toBe(true);
  });
});
