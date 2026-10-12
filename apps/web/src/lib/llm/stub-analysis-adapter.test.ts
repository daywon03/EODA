import { afterEach, describe, expect, it, vi } from "vitest";
import { StubAnalysisAdapter, STUB_ANALYSIS_REASON } from "./stub-analysis-adapter";

// Retour du test de bout en bout (12/10/2026) : le message annonçait « ANTHROPIC_API_KEY
// absent » alors que l'adaptateur de repli n'est choisi que quand NI OpenRouter NI
// Anthropic ne sont configurés (getLLMAnalysisPort) — et qu'OpenRouter est la voie
// décidée (D2). Un message qui désigne la mauvaise clé envoie chercher au mauvais endroit.

describe("StubAnalysisAdapter", () => {
  afterEach(() => vi.restoreAllMocks());

  it("nomme les deux clés possibles, OpenRouter d'abord", () => {
    expect(STUB_ANALYSIS_REASON).toContain("OPENROUTER_API_KEY");
    expect(STUB_ANALYSIS_REASON).toContain("ANTHROPIC_API_KEY");
    expect(STUB_ANALYSIS_REASON.indexOf("OPENROUTER_API_KEY")).toBeLessThan(
      STUB_ANALYSIS_REASON.indexOf("ANTHROPIC_API_KEY")
    );
  });

  it("journalise ce motif (avertissement, pas un log sauvage) et rend une analyse vide", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await new StubAnalysisAdapter().analyze({
      documentTypeLabel: "Livret d'accueil",
    } as Parameters<StubAnalysisAdapter["analyze"]>[0]);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining(STUB_ANALYSIS_REASON));
    expect(result.sembleConforme).toBe(false);
    expect(result.elementsPresents).toEqual([]);
  });
});
