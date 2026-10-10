import { describe, expect, it } from "vitest";
import {
  canAnswerNotConcerned,
  missingAnswerError,
  missingAnswerWrite,
  normaliseMissingState,
  parseMissingAnswer,
} from "./missing-answer-service";

describe("parseMissingAnswer — entrée non fiable", () => {
  it("accepte les trois réponses exactes", () => {
    expect(parseMissingAnswer("WILL_PROVIDE")).toBe("WILL_PROVIDE");
    expect(parseMissingAnswer("DONT_HAVE")).toBe("DONT_HAVE");
    expect(parseMissingAnswer("NOT_CONCERNED")).toBe("NOT_CONCERNED");
  });

  it("refuse l'ancien booléen et toute autre valeur", () => {
    for (const raw of [true, false, "dont_have", "", null, undefined]) {
      expect(parseMissingAnswer(raw)).toBeNull();
    }
  });
});

describe("« non concerné » interdit sur la loi 2002-2", () => {
  it("n'est pas une réponse possible pour les sept documents obligatoires", () => {
    expect(canAnswerNotConcerned("LOI_2002_2")).toBe(false);
    expect(missingAnswerError("NOT_CONCERNED", "LOI_2002_2")).toMatch(/Je ne l'ai pas/);
  });

  it("reste possible ailleurs, et les autres réponses passent partout", () => {
    for (const category of ["FONCTIONNEMENT", "QUALITE_RISQUES", "RH"] as const) {
      expect(canAnswerNotConcerned(category)).toBe(true);
      expect(missingAnswerError("NOT_CONCERNED", category)).toBeNull();
    }
    expect(missingAnswerError("DONT_HAVE", "LOI_2002_2")).toBeNull();
    expect(missingAnswerError("WILL_PROVIDE", "LOI_2002_2")).toBeNull();
  });
});

describe("missingAnswerWrite — « Je ne l'ai pas » ne pose plus NOT_APPLICABLE", () => {
  it("DONT_HAVE : MISSING + fait « déclaré absent »", () => {
    expect(missingAnswerWrite("DONT_HAVE")).toEqual({ status: "MISSING", statusOverriddenByUser: true });
  });

  it("WILL_PROVIDE : MISSING, sans fait", () => {
    expect(missingAnswerWrite("WILL_PROVIDE")).toEqual({ status: "MISSING", statusOverriddenByUser: false });
  });

  it("NOT_CONCERNED : NOT_APPLICABLE", () => {
    expect(missingAnswerWrite("NOT_CONCERNED")).toEqual({ status: "NOT_APPLICABLE", statusOverriddenByUser: true });
  });
});

describe("normaliseMissingState — lecture", () => {
  const base = { category: "RH" as const, statusOverriddenByUser: false, hasVersion: false };

  it("MISSING répondu « Je ne l'ai pas » = à produire", () => {
    expect(normaliseMissingState({ ...base, status: "MISSING", statusOverriddenByUser: true })).toEqual({
      status: "MISSING",
      declaredMissing: true,
    });
  });

  it("MISSING sans réponse = à déposer", () => {
    expect(normaliseMissingState({ ...base, status: "MISSING" })).toEqual({ status: "MISSING", declaredMissing: false });
  });

  it("rattrape un ancien « Non » sur la loi 2002-2 comme « Je ne l'ai pas », sans réécrire la base", () => {
    expect(
      normaliseMissingState({ ...base, category: "LOI_2002_2", status: "NOT_APPLICABLE", statusOverriddenByUser: true })
    ).toEqual({ status: "MISSING", declaredMissing: true });
  });

  it("laisse NOT_APPLICABLE hors loi 2002-2", () => {
    expect(normaliseMissingState({ ...base, status: "NOT_APPLICABLE", statusOverriddenByUser: true })).toEqual({
      status: "NOT_APPLICABLE",
      declaredMissing: false,
    });
  });

  it("une version déposée efface la notion d'absence", () => {
    expect(
      normaliseMissingState({ ...base, category: "LOI_2002_2", status: "UPLOADED", statusOverriddenByUser: true, hasVersion: true })
    ).toEqual({ status: "UPLOADED", declaredMissing: false });
  });
});
