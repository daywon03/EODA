// Port d'analyse documentaire par LLM (Dependency Inversion) — le métier ne dépend
// jamais directement d'un SDK LLM externe. cf. specs/02-architecture-technique.md §1,
// même principe que FileStoragePort/EmailPort.

export type LinkedCriterion = { code: string; label: string };

export type DocumentAnalysisInput = {
  documentTypeLabel: string;
  extractedText: string;
  linkedCriteria: LinkedCriterion[];
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
  // Ce que les images extraites du document représentent (cf. image-vision-service.ts)
  // — un panneau affiché photographié, un organigramme… Toujours optionnel : sans
  // image, ou si leur description a échoué, l'analyse fonctionne comme avant.
  imageDescriptions?: string[];
};

// Un élément retrouvé, avec la citation qui le justifie (demande de Damon,
// 15/09/2026) : un extrait court, tiré mot pour mot du document, qui confirme la
// présence affirmée. Sans citation vérifiable, une affirmation de présence n'est
// qu'une déduction du modèle — exactement ce que "Reste factuel" (le prompt
// d'analyse) est censé exclure. `elementsManquants` et `suggestionsCorrection`
// n'ont pas cette forme : on ne cite pas un passage qui n'existe pas.
export type AnalysisFinding = {
  text: string;
  source: string;
};

// Un statut de couverture PAR CRITÈRE rattaché au document (pas un jugement
// global) : « pour le critère 1.1, ça... » (Sandrine, façon dont elle travaille
// elle-même, call du 15/09/2026) — jusqu'ici l'analyse listait des manques sans
// dire à quel critère ils se rattachaient.
export type CriterionCoverage = {
  criterionCode: string;
  criterionLabel: string;
  status: "couvert" | "partiel" | "absent";
  note: string;
};

export type DocumentAnalysisResult = {
  elementsPresents: AnalysisFinding[];
  elementsManquants: string[];
  suggestionsCorrection: string[];
  // true si le document semble globalement satisfaire les attendus (utilisé par
  // DocumentStatusService pour dériver COMPLIANT/INCOMPLETE — jamais appliqué
  // sans validation humaine, cf. specs/01-mvp-v1.md §Module 1).
  sembleConforme: boolean;
  // Absent sur les analyses stockées avant cette date (repli `?? []` partout où
  // c'est lu) — jamais un champ requis rétroactivement sur des données existantes.
  criteriaCoverage: CriterionCoverage[];
};

// Entrée de la génération d'un document corrigé (demande de Damon, 15/09/2026) —
// même forme que l'entrée d'analyse plus ce que l'analyse a déjà relevé (D1 : la
// génération ne relit pas le document pour redécider ce qui manque, elle complète
// à partir d'un constat déjà fait ailleurs, cf. analysis-prompt.ts).
export type DocumentGenerationInput = {
  documentTypeLabel: string;
  extractedText: string;
  linkedCriteria: LinkedCriterion[];
  knowledgeExcerpts?: string[];
  criterionGuidelines?: string[];
  modelId?: string;
  elementsManquants: string[];
  suggestionsCorrection: string[];
};

export interface LLMAnalysisPort {
  analyze(input: DocumentAnalysisInput): Promise<DocumentAnalysisResult>;
  // Rend le document ENTIER corrigé, en Markdown — cf. buildGenerationSystemPrompt
  // pour la consigne complète. Aucun schéma structuré ici : c'est un texte libre,
  // converti en .docx ensuite (markdown-to-docx-service.ts), jamais du JSON.
  generateCorrectedDocument(input: DocumentGenerationInput): Promise<string>;
}

// Défensif, partagé par tous les adaptateurs (D1) : un modèle qui ignore le schéma
// demandé (surtout probable côté OpenRouter, où le schéma structuré n'est qu'une
// consigne de prompt, pas une garantie d'API comme chez Anthropic) peut renvoyer de
// simples chaînes au lieu de {text, source}. Une chaîne nue devient un constat sans
// citation plutôt qu'une entrée rejetée — mieux vaut un élément affiché sans preuve
// qu'une analyse qui perd cet élément en silence.
export function normalizeFindings(value: unknown): AnalysisFinding[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): AnalysisFinding | null => {
      if (typeof entry === "string") {
        const text = entry.trim();
        return text.length > 0 ? { text, source: "" } : null;
      }
      if (typeof entry === "object" && entry !== null && "text" in entry) {
        const text = String((entry as { text: unknown }).text).trim();
        const source = "source" in entry ? String((entry as { source: unknown }).source).trim() : "";
        return text.length > 0 ? { text, source } : null;
      }
      return null;
    })
    .filter((entry): entry is AnalysisFinding => entry !== null);
}

// Même défense que normalizeFindings : un modèle qui s'écarte du schéma (chaîne
// au lieu d'objet, statut hors énumération) ne doit jamais faire planter
// l'analyse entière — l'entrée malformée est simplement ignorée.
const VALID_COVERAGE_STATUSES = ["couvert", "partiel", "absent"] as const;

export function normalizeCriteriaCoverage(value: unknown): CriterionCoverage[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is CriterionCoverage => {
    if (typeof entry !== "object" || entry === null) return false;
    const e = entry as Record<string, unknown>;
    return (
      typeof e.criterionCode === "string" &&
      typeof e.criterionLabel === "string" &&
      typeof e.note === "string" &&
      typeof e.status === "string" &&
      (VALID_COVERAGE_STATUSES as readonly string[]).includes(e.status)
    );
  });
}
