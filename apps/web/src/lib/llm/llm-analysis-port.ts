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
  // `position` est le VRAI numéro d'apparition dans le document (DocumentVersionImage.position),
  // celui qui correspond au repère `[Image N]` laissé dans le texte extrait — jamais
  // l'index de ce tableau, qui décale dès qu'une seule image échoue en amont
  // (cf. fetchImageDescriptions dans document-ingestion-service.ts).
  imageDescriptions?: { position: number; description: string }[];
  // Qui a déposé la version analysée — l'adjoint IA qualité ne doit jamais confondre
  // un document initial déposé par un client et une version rehaussée par le cabinet
  // (relecture, correction, restitution). Dérivé du rôle de `DocumentVersion.uploadedBy`
  // (cf. analyzeVersion dans document-ingestion-service.ts) : "CLIENT" pour un compte
  // CLIENT_USER, "CABINET" pour un compte cabinet. Optionnel : absent sur les analyses
  // déjà stockées, et l'analyse fonctionne sans (même repli défensif que les autres
  // enrichissements de ce type).
  documentOrigin?: "CLIENT" | "CABINET";
  // Catalogue FERMÉ des critères que le modèle peut proposer en plus de
  // `linkedCriteria` (cf. `criteresSupplementaires` sur le résultat) — un document
  // peut concerner un critère jamais configuré sur son type, et l'adjoint IA
  // qualité ne doit jamais se limiter aux critères déjà rattachés (persona du
  // 20/09/2026 : « parfois jusqu'à 10 critères, jamais un seul »). Filtré au
  // périmètre de l'établissement (SAD Aide/Mixte) et déjà privé des critères
  // déjà dans `linkedCriteria`, côté appelant (cf. criterion-suggestion-service.ts)
  // — donner un catalogue fermé réduit le risque qu'il invente un code hors
  // référentiel ; la validation contre ce même catalogue se refait après coup,
  // jamais sur la seule confiance dans le prompt. Optionnel : sans catalogue,
  // aucune suggestion supplémentaire n'est demandée.
  additionalCriteriaCatalog?: LinkedCriterion[];
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

// Un critère détecté par le modèle en dehors de `linkedCriteria` — jamais
// appliqué directement : `criterion-suggestion-service.ts` le revalide contre le
// catalogue fermé transmis avant de le persister en `DocumentCriterionSuggestion`
// (statut PENDING), et seule une confirmation humaine le fait compter. `criterionCode`
// est un CODE ("2.2.7"), jamais un identifiant de base — le modèle ne connaît pas
// les identifiants internes.
export type RawCriterionSuggestion = {
  criterionCode: string;
  justification: string;
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
  // Critères HAS évoqués par CE document mais non déjà rattachés à son type — cf.
  // RawCriterionSuggestion. Absent sur les analyses stockées avant cette date et
  // sur toute analyse sans `additionalCriteriaCatalog` fourni (repli `?? []`).
  criteresSupplementaires: RawCriterionSuggestion[];
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

// Même défense que les deux normaliseurs ci-dessus. Ne valide QUE la forme —
// {criterionCode, justification} non vides ; la validation contre le catalogue
// réel de critères (un code qui existe vraiment, pas déjà rattaché) se fait dans
// criterion-suggestion-service.ts, qui seul a accès à la base.
export function normalizeCriterionSuggestions(value: unknown): RawCriterionSuggestion[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): RawCriterionSuggestion | null => {
      if (typeof entry !== "object" || entry === null) return null;
      const e = entry as Record<string, unknown>;
      if (typeof e.criterionCode !== "string" || typeof e.justification !== "string") return null;
      const criterionCode = e.criterionCode.trim();
      const justification = e.justification.trim();
      return criterionCode.length > 0 && justification.length > 0
        ? { criterionCode, justification }
        : null;
    })
    .filter((entry): entry is RawCriterionSuggestion => entry !== null);
}
