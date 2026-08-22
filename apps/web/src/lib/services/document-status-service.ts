import type { DocumentStatus } from "@eoda/database";
import type { DocumentAnalysisResult } from "@/lib/llm";

// Dérive le statut document depuis le JSON d'analyse LLM — pur. L'appelant (action)
// doit vérifier statusOverriddenByUser avant d'appliquer ce statut (jamais
// écraser un surclassement manuel, cf. specs/01-mvp-v1.md §Module 1).
export function deriveDocumentStatus(analysis: DocumentAnalysisResult): DocumentStatus {
  if (analysis.sembleConforme && analysis.elementsManquants.length === 0) return "COMPLIANT";
  return "INCOMPLETE";
}
