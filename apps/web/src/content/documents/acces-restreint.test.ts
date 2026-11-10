import { describe, expect, it } from "vitest";
import { DOCUMENT_TYPE_SEEDS } from "@eoda/database/document-types";
import { isRestrictedDocumentType, RESTRICTED_DOCUMENT_TYPE_CODES } from "./acces-restreint";

// RÈGLE ZÉRO : une ligne restreinte qui n'existe pas en base ne protège rien — un code mal
// orthographié laisserait le vrai tampon ouvert à tous, en silence.
describe("types de document à accès restreint (ADR 20261110)", () => {
  it("le tampon de la structure est restreint, et lui seul à ce jour", () => {
    expect([...RESTRICTED_DOCUMENT_TYPE_CODES]).toEqual(["DEPARTEMENT_TAMPON"]);
  });

  it("chaque code listé est un type du référentiel", () => {
    const known = new Set(DOCUMENT_TYPE_SEEDS.map((type) => type.code));
    for (const code of RESTRICTED_DOCUMENT_TYPE_CODES) expect(known.has(code)).toBe(true);
  });

  it("reconnaît un code restreint, rien d'autre, et pas l'absence de type", () => {
    expect(isRestrictedDocumentType("DEPARTEMENT_TAMPON")).toBe(true);
    expect(isRestrictedDocumentType("DEPARTEMENT_CONTRAT_RECAPITULATIF")).toBe(false);
    expect(isRestrictedDocumentType("departement_tampon")).toBe(false);
    expect(isRestrictedDocumentType(null)).toBe(false);
    expect(isRestrictedDocumentType(undefined)).toBe(false);
  });
});
