import { describe, expect, it } from "vitest";
import {
  MAX_ANALYSIS_DIRECTIVE_LENGTH,
  decideAnalysisDirective,
  directiveForAnalysis,
} from "@/lib/services/analysis-directive-service";

// La consigne d'analyse est du TEXTE LIBRE qui part vers un modèle. Deux choses
// peuvent mal tourner, et les deux se vérifient ici plutôt qu'à l'écran :
//   - elle est acceptée alors qu'elle est vide ou démesurée ;
//   - ou elle est transmise alors que la consultante a éteint le bouton.
describe("decideAnalysisDirective", () => {
  it("garde le texte et le drapeau ensemble", () => {
    expect(decideAnalysisDirective("  Synthèse 2025, pas le questionnaire.  ", true)).toEqual({
      directive: "Synthèse 2025, pas le questionnaire.",
      includeInAnalysis: true,
    });
  });

  it("conserve une consigne éteinte — une note de travail ne s'efface pas", () => {
    expect(decideAnalysisDirective("À revoir avec Sandrine", false)).toEqual({
      directive: "À revoir avec Sandrine",
      includeInAnalysis: false,
    });
  });

  it("range une consigne blanche en `null`, pas en chaîne vide", () => {
    expect(decideAnalysisDirective("   \n  ", false)).toEqual({
      directive: null,
      includeInAnalysis: false,
    });
  });

  it("refuse d'activer une consigne vide : un bouton qui n'envoie rien est un mensonge", () => {
    const decision = decideAnalysisDirective("   ", true);
    expect("error" in decision && decision.error).toMatch(/avant de la faire prendre en compte/);
  });

  it("refuse le texte trop long au lieu de le tronquer en silence", () => {
    const tooLong = "x".repeat(MAX_ANALYSIS_DIRECTIVE_LENGTH + 1);
    const decision = decideAnalysisDirective(tooLong, true);
    expect("error" in decision && decision.error).toContain(String(MAX_ANALYSIS_DIRECTIVE_LENGTH));
  });

  it("accepte exactement la longueur maximale", () => {
    const exact = "x".repeat(MAX_ANALYSIS_DIRECTIVE_LENGTH);
    expect(decideAnalysisDirective(exact, true)).toMatchObject({ includeInAnalysis: true });
  });

  it("refuse tout ce qui n'est pas une chaîne et un booléen", () => {
    expect(decideAnalysisDirective(42, true)).toEqual({ error: "Valeur invalide." });
    expect(decideAnalysisDirective("texte", "oui")).toEqual({ error: "Valeur invalide." });
  });
});

describe("directiveForAnalysis", () => {
  it("ne transmet rien quand le bouton est éteint, même si un texte existe", () => {
    expect(
      directiveForAnalysis({ analysisDirective: "Une consigne", directiveInAnalysis: false })
    ).toBeUndefined();
  });

  it("transmet la consigne découpée quand le bouton est allumé", () => {
    expect(
      directiveForAnalysis({ analysisDirective: "  Une consigne  ", directiveInAnalysis: true })
    ).toBe("Une consigne");
  });

  it("ne fabrique pas de bloc de consigne à partir d'un texte blanc", () => {
    expect(
      directiveForAnalysis({ analysisDirective: "   ", directiveInAnalysis: true })
    ).toBeUndefined();
    expect(
      directiveForAnalysis({ analysisDirective: null, directiveInAnalysis: true })
    ).toBeUndefined();
  });
});
