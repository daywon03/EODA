// Port d'analyse documentaire par LLM (Dependency Inversion) — le métier ne dépend
// jamais directement d'un SDK LLM externe. cf. specs/02-architecture-technique.md §1,
// même principe que FileStoragePort/EmailPort.

export type DocumentAnalysisInput = {
  documentTypeLabel: string;
  extractedText: string;
  linkedCriteriaLabels: string[];
  // Extraits de la base de connaissances (documents de RÉFÉRENCE de la bibliothèque
  // de modèles — manuel HAS, textes réglementaires), retrouvés par recherche
  // vectorielle. Toujours optionnel : la base de connaissances est un
  // enrichissement, l'analyse fonctionne sans (cf. lib/knowledge/index.ts).
  knowledgeExcerpts?: string[];
  // Modèle demandé par l'appelant (cf. lib/llm/openrouter-models.ts), pour comparer
  // les résultats entre IA sur un même document. Honoré uniquement par un
  // adaptateur multi-modèles (OpenRouterAnalysisAdapter) ; un adaptateur à modèle
  // fixe (AnthropicAnalysisAdapter) l'ignore silencieusement.
  modelId?: string;
  // Guidelines que le cabinet a ajoutées sur les critères HAS rattachés à ce
  // document (cf. CriterionGuideline) — les plus récentes d'abord. Toujours
  // optionnel : sans guideline, l'analyse fonctionne comme avant (cf.
  // criterion-guideline-service.ts).
  criterionGuidelines?: string[];
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
