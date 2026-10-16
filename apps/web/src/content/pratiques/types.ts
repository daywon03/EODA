// Forme des questions sur les pratiques (N7). Le CONTENU vit dans `questions.ts`, la
// forme ici, les règles dans `lib/services/practice-service.ts` — trois rythmes de
// changement, comme la grille de découverte (`content/decouverte/`).

// Méthode d'évaluation du manuel HAS qui couvre le critère : le chapitre 2 (« les
// professionnels ») s'évalue en TRACEUR CIBLÉ, le chapitre 3 (« l'ESSMS ») en AUDIT
// SYSTÈME (manuel HAS, fiches pratiques 4 et 5).
export type PracticeEvaluationMethod = "TRACEUR_CIBLE" | "AUDIT_SYSTEME";

// D'où vient la question : le critère tel qu'écrit dans le manuel HAS, jamais la mémoire.
export type PracticeQuestionSource = {
  // Page du manuel HAS (édition de juillet 2025) où le critère est décrit.
  manualPage: number;
  method: PracticeEvaluationMethod;
  // Les éléments d'évaluation (E.E.) du manuel sur lesquels la question s'appuie,
  // recopiés (une coupe « […] » se signale). Au moins un.
  evaluationElements: readonly string[];
};

export type PracticeQuestion = {
  // Code du critère impératif (« 3.12.1 »), clé STABLE : c'est par lui que la
  // question rejoint le critère en base. Jamais un identifiant de base.
  criterionCode: string;
  // Version de la FORMULATION. Elle augmente à chaque reformulation : une réponse
  // donnée sous une version antérieure reste en base et s'affiche comme « à revoir ».
  version: number;
  // Le thème, en mots simples, affiché au-dessus de la question.
  theme: string;
  // La question, en FALC : une idée, le « vous » de la structure, une réponse
  // Oui / En partie / Pas encore / Je ne sais pas sur la pratique RÉELLE.
  question: string;
  // Une phrase : ce que l'évaluateur va regarder, tiré des E.E. et des preuves du manuel.
  proofHint: string;
  // Absents d'une question de repli (critère sans question écrite) : voir ci-dessous.
  source?: PracticeQuestionSource;
  expectedDocumentTypeCodes?: readonly string[];
};

// Une question ÉCRITE porte toujours sa source et ses preuves attendues.
export type WrittenPracticeQuestion = PracticeQuestion & {
  source: PracticeQuestionSource;
  // Codes de types de document attendus pour ce critère (« document lié »), pris dans la
  // matrice proposée (`content/criteres/matrice-proposition.ts`) — jamais inventés. Vide
  // quand la matrice n'en propose aucun pour ce critère.
  expectedDocumentTypeCodes: readonly string[];
};

export type PracticeQuestionnaire = {
  // Version de l'ensemble, affichée à l'écran.
  version: string;
  // Toujours vrai tant que les questions n'ont pas été relues : l'écran le dit.
  provisional: boolean;
  // Référence citée à l'écran (« Source : Manuel HAS juillet 2025 »).
  sourceLabel: string;
  questions: readonly WrittenPracticeQuestion[];
};
