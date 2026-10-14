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
// Tous les modules livrés sont PROVISOIRES : rédigés à partir du manuel d'évaluation
// HAS (juillet 2025), des modes opératoires et des règles dites en séance, ils
// attendent la relecture de Sandrine (`provisional`).
//
// Identifiants de questions : ils portent la version du module (`bt-v2-1`). Une
// nouvelle version change donc tous les identifiants, et une réponse préparée sur
// l'ancienne version (page ouverte avant la mise en ligne) est ignorée par la
// correction — le quiz est déclaré incomplet au lieu d'être noté contre des
// questions que le salarié n'a pas vues. Vérifié par `quiz-content.test.ts`.
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

// Pictogramme SUGGÉRÉ par question (nom d'icône Lucide), pour la relecture FALC et un
// futur affichage — il n'est pas encore rendu à l'écran.
export type QuizQuestionPictogram =
  | "message-circle"
  | "shower-head"
  | "church"
  | "camera"
  | "hand-heart"
  | "lock"
  | "key-round"
  | "heart-handshake"
  | "glass-water"
  | "wallet"
  | "phone"
  | "battery-low"
  | "triangle-alert"
  | "user-round-check"
  | "clipboard-list"
  | "users"
  | "notebook-tabs"
  | "siren"
  | "door-closed"
  | "hand"
  | "droplets"
  | "trash-2"
  | "thermometer"
  | "wind"
  | "book-open"
  | "megaphone"
  | "mail-check";

export type QuizChoice = { id: string; label: string };

export type QuizQuestion = {
  id: string;
  // Une question courte, une idée à la fois (FALC).
  prompt: string;
  choices: readonly QuizChoice[];
  correctChoiceId: string;
  // Montrée APRÈS la réponse : on sensibilise, on ne piège pas.
  explanation: string;
  pictogram: QuizQuestionPictogram;
  // D'où vient la bonne réponse : critère et élément d'évaluation du manuel HAS (page),
  // ou section de context/10 / context/11. Réservé au cabinet : jamais envoyé au
  // salarié (la route publique ne transmet qu'identifiant, intitulé et choix).
  source: string;
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
