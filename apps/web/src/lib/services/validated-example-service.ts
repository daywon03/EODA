import type { ValidatedExample } from "@/lib/llm/llm-analysis-port";
import { anonymizeText } from "./anonymization-service";

// ─────────────────────────────────────────────────────────────────────────────
// EXEMPLES VALIDÉS — assemblage pur (N8, context/10 §9).
//
// Les morceaux arrivent de `knowledge_chunks` (nature EXEMPLE_VALIDE), déjà filtrés
// par TENANT et par TYPE DE DOCUMENT dans la requête (lib/db/read-validated-examples) :
// ce service ne fait que les remettre bout à bout par gabarit, dans l'ordre, et borner
// ce qui part dans le prompt. Une seconde passe d'anonymisation (e-mails, téléphones,
// NIR) s'ajoute à celle exigée AVANT dépôt — elle ne la remplace pas.
// ─────────────────────────────────────────────────────────────────────────────

export type ExampleChunkRow = { templateVersionId: string; title: string; chunkIndex: number; content: string };

export const MAX_EXAMPLES = 2;
export const MAX_EXAMPLE_CHARS = 12_000;

export function assembleValidatedExamples(
  rows: readonly ExampleChunkRow[],
  limits: { maxExamples?: number; maxChars?: number } = {}
): ValidatedExample[] {
  const maxExamples = limits.maxExamples ?? MAX_EXAMPLES;
  let budget = limits.maxChars ?? MAX_EXAMPLE_CHARS;

  // Ordre d'arrivée des versions = ordre de priorité (la plus récente d'abord).
  const order: string[] = [];
  const byVersion = new Map<string, ExampleChunkRow[]>();
  for (const row of rows) {
    if (!byVersion.has(row.templateVersionId)) {
      order.push(row.templateVersionId);
      byVersion.set(row.templateVersionId, []);
    }
    byVersion.get(row.templateVersionId)!.push(row);
  }

  const examples: ValidatedExample[] = [];
  for (const versionId of order.slice(0, maxExamples)) {
    if (budget <= 0) break;
    const chunks = [...byVersion.get(versionId)!].sort((a, b) => a.chunkIndex - b.chunkIndex);
    const full = anonymizeText(chunks.map((c) => c.content).join("\n"));
    const content = full.length > budget ? `${full.slice(0, budget)}\n[…]` : full;
    budget -= content.length;
    examples.push({ title: chunks[0]!.title, content });
  }
  return examples;
}
