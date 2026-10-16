import type { QuizModule } from "@/content/quiz/types";

// ─────────────────────────────────────────────────────────────────────────────
// CORRECTION D'UN QUIZ — service PUR (N10).
//
// Les réponses arrivent d'une route PUBLIQUE : entrée hostile. On ne garde que les
// couples (question, choix) qui existent dans la version du module ; une question
// sans réponse compte faux. Le score se calcule ICI, côté serveur — jamais reçu du
// navigateur.
// ─────────────────────────────────────────────────────────────────────────────

export type QuizAnswers = Record<string, string>;

export type QuizScore = { score: number; total: number; passed: boolean; answers: QuizAnswers };

// Lecture défensive d'une saisie inconnue : seules les clés et valeurs connues
// passent, le reste est ignoré.
export function sanitizeAnswers(module: QuizModule, raw: unknown): QuizAnswers {
  if (!raw || typeof raw !== "object") return {};
  const input = raw as Record<string, unknown>;
  const clean: QuizAnswers = {};
  for (const question of module.questions) {
    const value = input[question.id];
    if (typeof value === "string" && question.choices.some((choice) => choice.id === value)) clean[question.id] = value;
  }
  return clean;
}

export function scoreQuiz(module: QuizModule, raw: unknown): QuizScore {
  const answers = sanitizeAnswers(module, raw);
  const total = module.questions.length;
  const score = module.questions.filter((q) => answers[q.id] === q.correctChoiceId).length;
  const passed = total > 0 && score / total >= module.passThreshold;
  return { score, total, passed, answers };
}

// Toutes les questions ont-elles une réponse ? (on ne corrige pas un quiz à moitié)
export function isComplete(module: QuizModule, answers: QuizAnswers): boolean {
  return module.questions.every((q) => typeof answers[q.id] === "string");
}
