import { describe, expect, it } from "vitest";
import {
  ANALYSIS_ESTIMATE_CEILING,
  analysisRunPercent,
  describeAnalysisRun,
  estimateAnalysisPercent,
  formatElapsed,
} from "./analysis-progress-service";

describe("estimateAnalysisPercent — une estimation, jamais 100 % à l'horloge", () => {
  it("part de 0, croît, et plafonne sous 100 % quelle que soit la durée", () => {
    expect(estimateAnalysisPercent(0)).toBe(0);
    expect(estimateAnalysisPercent(-5)).toBe(0);
    expect(estimateAnalysisPercent(Number.NaN)).toBe(0);
    const a = estimateAnalysisPercent(5_000);
    const b = estimateAnalysisPercent(30_000);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(estimateAnalysisPercent(60 * 60_000)).toBe(ANALYSIS_ESTIMATE_CEILING);
    expect(ANALYSIS_ESTIMATE_CEILING).toBeLessThan(100);
  });
});

describe("analysisRunPercent — seule la réponse du serveur fait passer à 100 %", () => {
  it("100 % dès que l'analyse est finie, pendant la mise à jour comprise", () => {
    expect(analysisRunPercent("running", 10 * 60_000)).toBeLessThan(100);
    expect(analysisRunPercent("refreshing", 0)).toBe(100);
    expect(analysisRunPercent("done", 0)).toBe(100);
    expect(analysisRunPercent("idle", 50_000)).toBe(0);
  });
});

describe("describeAnalysisRun — ce que l'écran dit", () => {
  it("dit « environ » pendant l'analyse, et « terminée » avant la mise à jour de l'affichage", () => {
    expect(describeAnalysisRun("running", 12_000)).toMatch(/^Analyse en cours — environ \d+ % · 12 s$/);
    expect(describeAnalysisRun("refreshing", 0)).toBe("Analyse terminée — mise à jour de l'affichage…");
    expect(describeAnalysisRun("done", 0, "Lecture du document")).toBe("Lecture du document terminée.");
    expect(describeAnalysisRun("idle", 0)).toBeNull();
  });

  it("formate la durée en secondes puis en minutes", () => {
    expect(formatElapsed(59_900)).toBe("59 s");
    expect(formatElapsed(65_000)).toBe("1 min 05");
  });
});
