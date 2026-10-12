// Forme des questions sur les pratiques (N7). Le CONTENU vit dans `questions.ts`, la
// forme ici, les règles dans `lib/services/practice-service.ts` — trois rythmes de
// changement, comme la grille de découverte (`content/decouverte/`).

export type PracticeQuestion = {
  // Code du critère impératif (« 3.12.1 »), clé STABLE : c'est par lui que la
  // question rejoint le critère en base. Jamais un identifiant de base.
  criterionCode: string;
  // Version de la FORMULATION. Elle augmente à chaque reformulation : une réponse
  // donnée sous une version antérieure reste en base et s'affiche comme « à revoir ».
  version: number;
  // Le thème, en mots simples, affiché au-dessus de la question.
  theme: string;
  // La question, en FALC : une idée par phrase, le « vous » de la structure.
  question: string;
  // Ce qui prouverait cette pratique le jour de l'évaluation, dit simplement.
  proofHint: string;
};

export type PracticeQuestionnaire = {
  // Version de l'ensemble, affichée à l'écran.
  version: string;
  // Toujours vrai tant que les questions n'ont pas été relues : l'écran le dit.
  provisional: boolean;
  questions: readonly PracticeQuestion[];
};
