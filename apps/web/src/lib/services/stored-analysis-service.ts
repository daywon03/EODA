import type { DocumentAnalysisResult } from "@/lib/llm/llm-analysis-port";
import { markForeignScriptDeep } from "@/lib/llm/script-guard";
import { parseAnalysisResult } from "./analysis-view-service";

// Lecture d'une analyse ENREGISTRÉE pour l'afficher ou la reprendre (côté serveur).
// Une analyse produite avant le garde d'écriture (29/10/2026) peut contenir un mot
// chinois ou cyrillique glissé par le modèle : il est montré « [mot illisible] »,
// jamais tel quel. Séparé de `parseAnalysisResult`, que des composants client
// importent : le garde n'a pas à peser sur le navigateur.
export function readStoredAnalysis(value: unknown): DocumentAnalysisResult | null {
  const analysis = parseAnalysisResult(value);
  return analysis && markForeignScriptDeep(analysis);
}
