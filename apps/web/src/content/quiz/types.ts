// ─────────────────────────────────────────────────────────────────────────────
// QUIZ DE SENSIBILISATION — types du CONTENU versionné (lot B, tranche N10).
//
// « Sensibiliser », jamais « former » (context/11) : un quiz réussi est une PREUVE
// DE SENSIBILISATION d'un salarié, pas une formation certifiante.
//
// Le contenu vit ici, pas en base : ajouter ou corriger une question ne demande
// aucune migration. Toute correction d'une question INCRÉMENTE `version` — une
// tentative garde la version qu'elle a passée (QuizAttempt.moduleVersion), c'est ce
// qui rend l'émargement opposable.
//
// Tous les modules livrés sont PROVISOIRES : rédigés à partir des modes opératoires
// et du référentiel HAS, ils attendent la relecture de Sandrine (`provisional`).
// ─────────────────────────────────────────────────────────────────────────────

export const QUIZ_MODULE_CODES = [
  "BIENTRAITANCE",
  "MALTRAITANCE",
  "GESTION_CRISE",
  "RISQUE_INFECTIEUX",
  "PLAINTES",
] as const;

export type QuizModuleCode = (typeof QUIZ_MODULE_CODES)[number];

// Pictogrammes : icônes Lucide nommées (CLAUDE.md §7 — jamais ARASAAC ni SantéBD).
export type QuizPictogram = "heart" | "shield" | "siren" | "droplets" | "message";

export type QuizChoice = { id: string; label: string };

export type QuizQuestion = {
  id: string;
  // Une question courte, une idée à la fois (FALC).
  prompt: string;
  choices: readonly QuizChoice[];
  correctChoiceId: string;
  // Montrée APRÈS la réponse : on sensibilise, on ne piège pas.
  explanation: string;
};

export type QuizModule = {
  code: QuizModuleCode;
  version: number;
  title: string;
  // Libellé court pour une colonne de matrice.
  shortTitle: string;
  pictogram: QuizPictogram;
  // Part de bonnes réponses pour réussir (0 à 1).
  passThreshold: number;
  // Un quiz réussi est « à jour » pendant ce nombre de mois, puis « à refaire ».
  retestMonths: number;
  provisional: boolean;
  // D'où viennent les questions (mode opératoire, critère HAS) — pour la relecture.
  sources: readonly string[];
  questions: readonly QuizQuestion[];
};
