// ─────────────────────────────────────────────────────────────────────────────
// PROGRESSION D'UNE ANALYSE (21/10/2026, demande de Damon : « savoir quand l'analyse
// est terminée, la page peut rester très longtemps à charger alors que l'analyse est
// déjà finie »).
//
// L'appel au modèle ne rend aucune progression : le pourcentage pendant l'analyse est
// une ESTIMATION au temps écoulé, et l'écran le dit (« environ »). Il plafonne à 90 % :
// seule la réponse du serveur fait passer à 100 %, jamais l'horloge. Ensuite, la mise
// à jour de l'affichage est une phase à part — l'analyse est finie, c'est dit.
// Règles PURES.
// ─────────────────────────────────────────────────────────────────────────────

export type AnalysisRunPhase = "idle" | "running" | "refreshing" | "done";

export const ANALYSIS_ESTIMATE_CEILING = 90;
// Constante de temps de la courbe : environ 63 % du plafond au bout de 30 s.
const TIME_CONSTANT_MS = 30_000;

export function estimateAnalysisPercent(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return Math.min(
    ANALYSIS_ESTIMATE_CEILING,
    Math.round(ANALYSIS_ESTIMATE_CEILING * (1 - Math.exp(-elapsedMs / TIME_CONSTANT_MS)))
  );
}

export function formatElapsed(elapsedMs: number): string {
  const seconds = Math.max(0, Math.floor(elapsedMs / 1000));
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")}`;
}

export function analysisRunPercent(phase: AnalysisRunPhase, elapsedMs: number): number {
  if (phase === "refreshing" || phase === "done") return 100;
  if (phase === "running") return estimateAnalysisPercent(elapsedMs);
  return 0;
}

// `subject` : ce qui tourne, dans les mots de l'écran (« Analyse », « Lecture du document »).
export function describeAnalysisRun(phase: AnalysisRunPhase, elapsedMs: number, subject = "Analyse"): string | null {
  switch (phase) {
    case "running":
      return `${subject} en cours — environ ${estimateAnalysisPercent(elapsedMs)} % · ${formatElapsed(elapsedMs)}`;
    case "refreshing":
      return `${subject} terminée — mise à jour de l'affichage…`;
    case "done":
      return `${subject} terminée.`;
    case "idle":
      return null;
  }
}
