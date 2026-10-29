import { describe, expect, it, vi } from "vitest";
import {
  ForeignScriptResponseError,
  foreignCharacters,
  markForeignScript,
  markForeignScriptDeep,
  responseHasForeignScript,
  withScriptGuard,
} from "./script-guard";
import type { DocumentAnalysisResult, LLMAnalysisPort } from "./llm-analysis-port";

// Cas RELEVÉS en base le 29/10/2026 (capture de Sandrine et requête en lecture) :
// des mots chinois et russes glissés par le modèle au milieu du français.
const REAL_CASES = [
  "ce qui规范ise la coordination",
  "à le faire expliquer，表明 les professionnels",
  "la charte de bientraitance,构成uant le plan",
  "les questions [...] существование de directives",
  "d'un запрос de clarification",
];

describe("foreignCharacters", () => {
  it("repère chaque cas relevé en base", () => {
    for (const text of REAL_CASES) expect(foreignCharacters(text).length).toBeGreaterThan(0);
  });

  it("laisse passer le français, ses accents, ses guillemets et les cases du DIPEC", () => {
    expect(foreignCharacters("Élément présent : « réévaluation annuelle », coût 12 € ★ ☐ ☒ œ ç ë — 3.14.2")).toEqual([]);
  });

  it("permet un caractère que le document contient lui-même", () => {
    expect(foreignCharacters("Nom cité : 王", new Set(["王"]))).toEqual([]);
  });
});

describe("markForeignScript", () => {
  it("montre le mot étranger comme « [mot illisible] » au lieu de l'afficher", () => {
    expect(markForeignScript("ce qui规范ise la coordination")).toBe("ce qui [mot illisible] ise la coordination");
    expect(markForeignScript("expliquer，表明 les professionnels")).toBe("expliquer [mot illisible] les professionnels");
    expect(markForeignScript("Texte propre.")).toBe("Texte propre.");
  });

  it("parcourt toute une analyse enregistrée, sans en changer la forme", () => {
    const marked = markForeignScriptDeep({ elementsManquants: ["d'un запрос"], sembleConforme: false, n: 2 });
    expect(marked).toEqual({ elementsManquants: ["d'un [mot illisible]"], sembleConforme: false, n: 2 });
  });
});

describe("withScriptGuard — aucune réponse contaminée n'atteint la base", () => {
  const clean: DocumentAnalysisResult = {
    elementsPresents: [{ text: "Coordination décrite", source: "La coordination est assurée." }],
    elementsManquants: [],
    suggestionsCorrection: [],
    sembleConforme: false,
    criteriaCoverage: [],
    criteresSupplementaires: [{ criterionCode: "2.9.1", justification: "ce qui sécurise la coordination" }],
  };
  const dirty: DocumentAnalysisResult = {
    ...clean,
    criteresSupplementaires: [{ criterionCode: "2.9.1", justification: "ce qui规范ise la coordination" }],
  };
  const input = { documentTypeLabel: "DIPEC", extractedText: "Texte du document.", linkedCriteria: [] };
  const portWith = (analyze: LLMAnalysisPort["analyze"]) =>
    ({ analyze, describeAnalysisCall: vi.fn(), generateCorrectedDocument: vi.fn() }) as unknown as LLMAnalysisPort;

  it("réponse propre : rendue telle quelle, un seul appel", async () => {
    const analyze = vi.fn().mockResolvedValue(clean);
    await expect(withScriptGuard(portWith(analyze)).analyze(input)).resolves.toBe(clean);
    expect(analyze).toHaveBeenCalledTimes(1);
  });

  it("réponse contaminée : redemandée une fois, la propre est gardée", async () => {
    const analyze = vi.fn().mockResolvedValueOnce(dirty).mockResolvedValueOnce(clean);
    await expect(withScriptGuard(portWith(analyze)).analyze(input)).resolves.toBe(clean);
    expect(analyze).toHaveBeenCalledTimes(2);
  });

  it("deux fois contaminée : refusée, rien n'est rendu à enregistrer", async () => {
    const analyze = vi.fn().mockResolvedValue(dirty);
    await expect(withScriptGuard(portWith(analyze)).analyze(input)).rejects.toBeInstanceOf(ForeignScriptResponseError);
    expect(analyze).toHaveBeenCalledTimes(2);
  });

  it("une citation d'un document qui contient lui-même ces caractères n'est pas refusée", async () => {
    const quoting = { ...clean, elementsPresents: [{ text: "Nom", source: "王" }] };
    const analyze = vi.fn().mockResolvedValue(quoting);
    await expect(withScriptGuard(portWith(analyze)).analyze({ ...input, extractedText: "Signé : 王" })).resolves.toBe(quoting);
  });

  it("le contrôle porte aussi sur la mise en conformité", async () => {
    const generateCorrectedDocument = vi.fn().mockResolvedValue({ segments: [{ kind: "AJOUT", text: "d'un запрос" }] });
    const port = { analyze: vi.fn(), describeAnalysisCall: vi.fn(), generateCorrectedDocument } as unknown as LLMAnalysisPort;
    await expect(
      withScriptGuard(port).generateCorrectedDocument({
        documentTypeLabel: "DIPEC",
        extractedText: "Texte.",
        linkedCriteria: [],
        elementsManquants: [],
        suggestionsCorrection: [],
      })
    ).rejects.toBeInstanceOf(ForeignScriptResponseError);
  });

  it("responseHasForeignScript parcourt objets et tableaux imbriqués", () => {
    expect(responseHasForeignScript({ a: [{ b: "ok" }, { c: "ce qui规范ise" }] }, new Set())).toBe(true);
    expect(responseHasForeignScript({ a: [{ b: "ok" }], n: 1, v: null }, new Set())).toBe(false);
  });
});
