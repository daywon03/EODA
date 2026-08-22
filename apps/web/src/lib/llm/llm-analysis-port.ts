// Port d'analyse documentaire par LLM (Dependency Inversion) — le métier ne dépend
// jamais directement d'un SDK LLM externe. cf. specs/02-architecture-technique.md §1,
// même principe que FileStoragePort/EmailPort.

export type DocumentAnalysisInput = {
  documentTypeLabel: string;
  extractedText: string;
  linkedCriteriaLabels: string[];
};

export type DocumentAnalysisResult = {
  elementsPresents: string[];
  elementsManquants: string[];
  suggestionsCorrection: string[];
  // true si le document semble globalement satisfaire les attendus (utilisé par
  // DocumentStatusService pour dériver COMPLIANT/INCOMPLETE — jamais appliqué
  // sans validation humaine, cf. specs/01-mvp-v1.md §Module 1).
  sembleConforme: boolean;
};

export interface LLMAnalysisPort {
  analyze(input: DocumentAnalysisInput): Promise<DocumentAnalysisResult>;
}
