import type { Rating, RequirementLevel } from "@eoda/database";
import { isRatingAllowed } from "@/lib/services/scoring-service";

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT D'UNE GRILLE SYNAÉ REMPLIE — auto-évaluation (décision de Damon, 21/10/2026).
//
// Une grille Synaé exportée et cotée (les trois fichiers « Grille Chapitre N … »)
// se recharge dans la session OUVERTE du chapitre : chaque élément d'évaluation est
// retrouvé par l'identifiant stable de sa question (colonne « ID Question », la même
// que celle qui a servi à charger le référentiel — `EvaluationElement.sourceQuestionId`),
// jamais par son libellé.
//
// Règles PURES : aucune lecture de fichier ni de base ici. Le classeur est lu par
// `synae-workbook-reader.ts`, la base par l'action `importSynaeGrid`.
//
//   - une cotation vide n'écrit rien ;
//   - une cotation illisible est SIGNALÉE, jamais devinée ;
//   - les règles HAS s'appliquent comme à la main (`isRatingAllowed` : RI au
//     chapitre 1 seulement, NC interdit sur un impératif) ;
//   - un critère hors du périmètre de l'offre n'est pas écrit ;
//   - un élément DÉJÀ coté dans la session est conservé : l'import complète, il ne
//     réécrit pas un geste fait à l'écran.
// ─────────────────────────────────────────────────────────────────────────────

// Colonnes (0-indexées) de la feuille « Grille d'évaluation Synaé » — les mêmes que
// le seed du référentiel (`packages/database/prisma/seed-has-referential.ts`).
export const SYNAE_COLUMNS = {
  COTATION: 5,
  PREUVES_CONSULTEES: 7,
  JUSTIFICATIFS: 8,
  COMMENTAIRES: 9,
  IS_QUESTION: 10,
  ID_CHAPITRE: 11,
  ID_CRITERE: 14,
  ID_QUESTION: 15,
} as const;

const HEADER_CRITERION_ID = "Critère ID";
const MAX_COMMENT_LENGTH = 4000;

export type SynaeRow = {
  questionId: string;
  criterionCode: string;
  chapterNumber: number | null;
  rawRating: string;
  comment: string | null;
};

// Lignes d'éléments d'évaluation d'une feuille déjà réduite en texte. L'en-tête est
// CHERCHÉ (sa ligne varie d'une grille à l'autre) ; sans lui, la feuille n'est pas
// une grille Synaé et rien n'est lu.
export function extractSynaeRows(sheet: readonly (readonly string[])[]): SynaeRow[] | null {
  const headerIndex = sheet.findIndex((row) => (row[SYNAE_COLUMNS.ID_CRITERE] ?? "").trim() === HEADER_CRITERION_ID);
  if (headerIndex < 0) return null;

  return sheet.slice(headerIndex + 1).flatMap((row): SynaeRow[] => {
    if ((row[SYNAE_COLUMNS.IS_QUESTION] ?? "").trim().toLowerCase() !== "true") return [];
    const questionId = (row[SYNAE_COLUMNS.ID_QUESTION] ?? "").trim();
    if (questionId.length === 0) return [];
    const chapter = Number.parseInt((row[SYNAE_COLUMNS.ID_CHAPITRE] ?? "").trim(), 10);
    const parts = [
      labelled("Preuves consultées", row[SYNAE_COLUMNS.PREUVES_CONSULTEES]),
      labelled("Éléments justificatifs", row[SYNAE_COLUMNS.JUSTIFICATIFS]),
      labelled("Commentaire", row[SYNAE_COLUMNS.COMMENTAIRES]),
    ].filter((p): p is string => p !== null);
    return [
      {
        questionId,
        criterionCode: (row[SYNAE_COLUMNS.ID_CRITERE] ?? "").trim(),
        chapterNumber: Number.isFinite(chapter) ? chapter : null,
        rawRating: (row[SYNAE_COLUMNS.COTATION] ?? "").trim(),
        comment: parts.length > 0 ? parts.join("\n").slice(0, MAX_COMMENT_LENGTH) : null,
      },
    ];
  });
}

function labelled(label: string, value: string | undefined): string | null {
  const text = (value ?? "").trim();
  return text.length > 0 ? `${label} : ${text}` : null;
}

// Cotation saisie dans la grille → valeur du référentiel (1/2/3/4/★/NC/RI). Vide =
// pas de cotation ; tout le reste qui ne se lit pas = INVALID, signalé à l'écran.
export function parseSynaeRating(raw: string): Rating | null | "INVALID" {
  const value = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (value.length === 0) return null;
  if (["1", "2", "3", "4"].includes(value)) return `R${value}` as Rating;
  if (["★", "*", "4*", "4★", "étoile", "etoile"].includes(value)) return "STAR";
  if (value === "nc" || value === "non concerné" || value === "non concerne") return "NC";
  if (value === "ri") return "RI";
  return "INVALID";
}

export type SynaeElementFacts = {
  elementId: string;
  requirementLevel: RequirementLevel;
  // Le critère entre dans le périmètre de l'offre de la mission.
  inScope: boolean;
};

export type SynaeImportPlan = {
  toWrite: { elementId: string; rating: Rating; comment: string | null }[];
  alreadyRated: number;
  empty: number;
  unknownQuestion: number;
  outOfScope: number;
  refused: { criterionCode: string; reason: string }[];
};

export function planSynaeImport(
  rows: readonly SynaeRow[],
  context: {
    chapterNumber: number;
    elements: ReadonlyMap<string, SynaeElementFacts>;
    ratedElementIds: ReadonlySet<string>;
  }
): SynaeImportPlan {
  const plan: SynaeImportPlan = { toWrite: [], alreadyRated: 0, empty: 0, unknownQuestion: 0, outOfScope: 0, refused: [] };
  const seen = new Set<string>();
  for (const row of rows) {
    const rating = parseSynaeRating(row.rawRating);
    if (rating === null) {
      plan.empty++;
      continue;
    }
    const element = context.elements.get(row.questionId);
    if (!element || seen.has(element.elementId)) {
      if (!element) plan.unknownQuestion++;
      continue;
    }
    seen.add(element.elementId);
    if (rating === "INVALID") {
      plan.refused.push({ criterionCode: row.criterionCode, reason: `cotation « ${row.rawRating} » illisible` });
      continue;
    }
    if (!element.inScope) {
      plan.outOfScope++;
      continue;
    }
    const check = isRatingAllowed(rating, context.chapterNumber, element.requirementLevel);
    if (!check.allowed) {
      plan.refused.push({ criterionCode: row.criterionCode, reason: check.warning ?? "cotation non autorisée" });
      continue;
    }
    if (context.ratedElementIds.has(element.elementId)) {
      plan.alreadyRated++;
      continue;
    }
    plan.toWrite.push({ elementId: element.elementId, rating, comment: row.comment });
  }
  return plan;
}

// Le chapitre d'une grille : celui de ses lignes, s'il est unique. Une grille qui
// mélange les chapitres (ou n'en dit aucun) n'est pas importée — on ne choisit pas
// à la place de la consultante dans quelle session écrire.
export function synaeGridChapter(rows: readonly SynaeRow[]): number | null {
  const chapters = new Set(rows.map((r) => r.chapterNumber));
  if (chapters.size !== 1) return null;
  const [only] = [...chapters];
  return only ?? null;
}

export function describeSynaeImport(plan: SynaeImportPlan): string {
  const parts = [`${plan.toWrite.length} cotation(s) importée(s)`];
  if (plan.alreadyRated > 0) parts.push(`${plan.alreadyRated} déjà cotée(s) à l'écran, conservée(s)`);
  if (plan.outOfScope > 0) parts.push(`${plan.outOfScope} hors périmètre de l'offre`);
  if (plan.unknownQuestion > 0) parts.push(`${plan.unknownQuestion} question(s) inconnue(s) du référentiel`);
  if (plan.refused.length > 0) parts.push(`${plan.refused.length} refusée(s)`);
  return `${parts.join(", ")}.`;
}
