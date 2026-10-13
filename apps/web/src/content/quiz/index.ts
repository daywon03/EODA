import { BIENTRAITANCE_QUIZ } from "./bientraitance";
import { GESTION_CRISE_QUIZ } from "./gestion-crise";
import { MALTRAITANCE_QUIZ } from "./maltraitance";
import { PLAINTES_QUIZ } from "./plaintes";
import { RISQUE_INFECTIEUX_QUIZ } from "./risque-infectieux";
import type { QuizModule } from "./types";

export * from "./types";

// Ordre d'affichage = ordre de la maquette (colonnes de la matrice équipe × quiz).
export const QUIZ_MODULES: readonly QuizModule[] = [
  BIENTRAITANCE_QUIZ,
  MALTRAITANCE_QUIZ,
  GESTION_CRISE_QUIZ,
  RISQUE_INFECTIEUX_QUIZ,
  PLAINTES_QUIZ,
];

// Un code reçu (URL, formulaire, base) est une entrée non fiable : inconnu ⇒ null.
export function findQuizModule(code: string): QuizModule | null {
  return QUIZ_MODULES.find((quiz) => quiz.code === code) ?? null;
}
