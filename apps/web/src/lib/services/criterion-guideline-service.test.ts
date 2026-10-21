import { describe, expect, it } from "vitest";
import { guidelineReach, MAX_GUIDELINE_LENGTH, validateGuidelineNote } from "./criterion-guideline-service";

describe("validateGuidelineNote", () => {
  it("accepte un aide-mémoire court, en le nettoyant des espaces superflus", () => {
    const result = validateGuidelineNote("  Vérifier la date de révision annuelle.  ");
    expect(result).toEqual({ ok: true, value: "Vérifier la date de révision annuelle." });
  });

  it("refuse un commentaire vide ou uniquement composé d'espaces", () => {
    expect(validateGuidelineNote("").ok).toBe(false);
    expect(validateGuidelineNote("   ").ok).toBe(false);
  });

  it("refuse un commentaire au-delà de la longueur maximale — ce n'est pas un paragraphe", () => {
    const tooLong = "a".repeat(MAX_GUIDELINE_LENGTH + 1);
    const result = validateGuidelineNote(tooLong);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(String(MAX_GUIDELINE_LENGTH));
  });

  it("accepte un commentaire exactement à la longueur maximale", () => {
    const exact = "a".repeat(MAX_GUIDELINE_LENGTH);
    expect(validateGuidelineNote(exact).ok).toBe(true);
  });
});

describe("guidelineReach — les critères dont la guideline est relue pour UN document", () => {
  it("réunit la matrice du type et les critères reconnus dans le document, sans doublon", () => {
    expect(guidelineReach(["c-131", "c-151"], ["c-151", "c-227"])).toEqual(["c-131", "c-151", "c-227"]);
  });

  it("n'atteint pas un critère ni rattaché ni reconnu (call du 21/10/2026)", () => {
    expect(guidelineReach(["c-111"], [])).not.toContain("c-131");
    expect(guidelineReach([], [])).toEqual([]);
  });
});
