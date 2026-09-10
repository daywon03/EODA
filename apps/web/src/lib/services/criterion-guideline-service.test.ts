import { describe, expect, it } from "vitest";
import { MAX_GUIDELINE_LENGTH, validateGuidelineNote } from "./criterion-guideline-service";

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
