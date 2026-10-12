import type {
  LLMAnalysisPort,
  DocumentAnalysisInput,
  DocumentAnalysisResult,
  DocumentGenerationInput,
} from "./llm-analysis-port";
import { validateCorrectionProposal, type CorrectionProposal } from "./correction-proposal";

// Fallback dev/tant-que-ANTHROPIC_API_KEY-non-configuré — ne fait aucun appel LLM,
// renvoie un résultat neutre pour ne pas bloquer le flux d'upload. Ne jamais
// utiliser en production (cf. getLLMAnalysisPort()).
export class StubAnalysisAdapter implements LLMAnalysisPort {
  async analyze(input: DocumentAnalysisInput): Promise<DocumentAnalysisResult> {
    console.log(
      `[StubAnalysisAdapter] Analyse non exécutée (ANTHROPIC_API_KEY absent) pour "${input.documentTypeLabel}".`
    );
    return {
      elementsPresents: [],
      elementsManquants: [],
      suggestionsCorrection: [],
      sembleConforme: false,
      criteriaCoverage: [],
      criteresSupplementaires: [],
    };
  }

  // Sortie STRUCTURÉE plausible (N8), pour que l'écran côte à côte se teste en local
  // sans appel payant : l'original découpé en paragraphes, un ajout après le premier
  // paragraphe et un en fin de document, rattachés aux premiers critères connus, avec
  // un champ à compléter. Le texte des ajouts dit qu'il vient de l'adaptateur de repli.
  async generateCorrectedDocument(input: DocumentGenerationInput): Promise<CorrectionProposal> {
    return buildStubProposal(input);
  }
}

export function buildStubProposal(input: DocumentGenerationInput): CorrectionProposal {
  const paragraphs = input.extractedText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  const original = paragraphs.length > 0 ? paragraphs : ["(document sans texte)"];
  const [first, second] = input.linkedCriteria;
  const addition = (id: string, code: string | undefined, text: string, anchor: string) => ({
    kind: "AJOUT",
    id,
    text,
    criterionCode: code ?? "",
    reason: `Proposition de démonstration (adaptateur de repli, aucun modèle appelé) pour « ${input.documentTypeLabel} ».`,
    manualQuote: "",
    anchor,
  });
  const segments = [
    { kind: "ORIGINAL", text: original[0] },
    addition(
      "a1",
      first?.code,
      "Une permanence téléphonique répond du lundi au vendredi, aux horaires suivants : [À compléter : horaires de la permanence].",
      original[0]!.slice(-80)
    ),
    ...original.slice(1).map((text) => ({ kind: "ORIGINAL", text })),
    addition(
      "a2",
      second?.code ?? first?.code,
      "La personne peut faire une réclamation par écrit ou par téléphone. Le service répond par écrit, dans un délai de [À compléter : délai de réponse].",
      original.at(-1)!.slice(-80)
    ),
  ];
  return validateCorrectionProposal({ segments });
}
