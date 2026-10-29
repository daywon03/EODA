// Les versions du prompt d'analyse TELLES QUE L'ÉCRAN LES PROPOSE — identifiant, nom,
// description, numéro de version. Sans le texte des consignes, qui reste côté serveur
// (analysis-prompt-variants.ts) : un sélecteur n'a pas à embarquer le prompt.

export const ANALYSIS_PROMPT_VARIANT_IDS = ["actuel", "mode-operatoire", "cible"] as const;
export type AnalysisPromptVariantId = (typeof ANALYSIS_PROMPT_VARIANT_IDS)[number];

export type AnalysisPromptChoice = {
  id: AnalysisPromptVariantId;
  // Corriger le texte d'une version incrémente ce numéro : un essai jugé garde la
  // version exacte du prompt qui l'a produit.
  version: number;
  label: string;
  // Ce que la version change, en une phrase, pour la consultante qui choisit.
  description: string;
};

// La version utilisée quand personne n'en choisit une (dépôt, réanalyse sans choix).
// Elle ne change que sur décision, une fois les essais jugés par Sandrine.
export const DEFAULT_ANALYSIS_PROMPT_VARIANT: AnalysisPromptVariantId = "actuel";

export const ANALYSIS_PROMPT_CHOICES: readonly AnalysisPromptChoice[] = [
  {
    id: "actuel",
    version: 1,
    label: "Actuel",
    description: "Le prompt utilisé jusqu'ici : analyse large, propose tous les critères que le document évoque.",
  },
  {
    id: "mode-operatoire",
    version: 1,
    label: "Mode opératoire EODA",
    description:
      "Ajoute le contrôle croisé de Sandrine : numéros, coordonnées, dates de version, intitulés, RGPD — en alertes « à vérifier ».",
  },
  {
    id: "cible",
    version: 1,
    label: "Ciblé",
    description:
      "Se concentre sur les critères rattachés et le commentaire de la consultante ; au plus 3 critères en plus, seulement s'ils sont évidents.",
  },
];

export function isAnalysisPromptVariantId(value: unknown): value is AnalysisPromptVariantId {
  return typeof value === "string" && (ANALYSIS_PROMPT_VARIANT_IDS as readonly string[]).includes(value);
}

export function analysisPromptChoice(id: AnalysisPromptVariantId): AnalysisPromptChoice {
  return ANALYSIS_PROMPT_CHOICES.find((c) => c.id === id) ?? ANALYSIS_PROMPT_CHOICES[0]!;
}

// Libellé affiché d'une version enregistrée (« Ciblé · v1 »), y compris une version
// retirée depuis : on montre ce qui est stocké, jamais une version devinée.
export function describeAnalysisPrompt(id: string | null, version: number | null): string {
  if (!id) return "non enregistrée (analyse antérieure au 29/10/2026)";
  const known = isAnalysisPromptVariantId(id) ? analysisPromptChoice(id).label : id;
  return version ? `${known} · v${version}` : known;
}
