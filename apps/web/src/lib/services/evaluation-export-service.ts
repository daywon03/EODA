import type { Rating } from "@eoda/database";
import { RATING_LABELS, ratingValue } from "./scoring-service";
import { buildEodaFileName } from "./document-naming-service";

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT DES COTATIONS — Jalon 4, dernier trou du module Auto-évaluation.
//
// ⚠️ Ce que cet export EST : un tableau complet, lisible et archivable des
// cotations, ouvrable dans Excel. Ce qu'il n'est PAS : un fichier d'import Synaé.
// Le format d'import réel de Synaé n'est spécifié nulle part (risque n°1 de la
// roadmap, §12.7 « jamais spécifié ») ; le prétendre compatible serait un mensonge
// qui se découvrirait le jour de la saisie officielle. Quand Sandrine obtiendra le
// gabarit d'import, il se branchera sur les mêmes lignes : c'est la mise en forme
// qui changera, pas la lecture.
//
// Choix de format, tous dictés par le tableur français et non par le goût :
//   - séparateur `;` — Excel en locale française attend le point-virgule ;
//   - BOM UTF-8 en tête — sans lui, Excel lit « critère » comme « critÃ¨re » ;
//   - fins de ligne CRLF — attendues par la RFC 4180 et par Excel.
//
// Règles PURES : ni Prisma, ni React, ni système de fichiers.
// ─────────────────────────────────────────────────────────────────────────────

export const CSV_SEPARATOR = ";";
const CSV_EOL = "\r\n";
const UTF8_BOM = "﻿";

export type EvaluationExportRow = {
  chapterNumber: number;
  chapterName: string;
  themeCode: string;
  themeName: string;
  objectiveCode: string;
  criterionCode: string;
  criterionLabel: string;
  requirementLevel: "IMPERATIF" | "STANDARD";
  criterionScore: number | null;
  elementText: string;
  rating: Rating | null;
  comment: string | null;
  // Vrai quand la cotation vient d'une suggestion du système confirmée par
  // l'évaluateur. Exporté : une cotation suggérée puis validée n'a pas le même poids
  // qu'une cotation saisie de bout en bout, et l'export sert aussi de preuve.
  suggestedBySystem: boolean;
};

export const EVALUATION_EXPORT_HEADERS = [
  "Chapitre",
  "Nom du chapitre",
  "Thématique",
  "Nom de la thématique",
  "Objectif",
  "Critère",
  "Libellé du critère",
  "Niveau",
  "Score du critère",
  "Élément d'évaluation",
  "Cotation",
  "Valeur numérique",
  "Origine",
  "Commentaire",
] as const;

// Échappement RFC 4180 : guillemets doublés, et mise entre guillemets dès que la
// valeur contient un séparateur, un guillemet ou un saut de ligne. Un commentaire
// d'évaluateur contient les trois — c'est le cas normal, pas le cas limite.
export function escapeCsvValue(value: string): string {
  const needsQuotes = /[";\r\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function formatScore(score: number | null): string {
  // Virgule décimale : un tableur français lit « 3.5 » comme du texte.
  return score === null ? "" : score.toFixed(2).replace(".", ",");
}

export function buildEvaluationCsvLine(row: EvaluationExportRow): string {
  const numericValue = row.rating === null ? null : ratingValue(row.rating);

  const cells: string[] = [
    String(row.chapterNumber),
    row.chapterName,
    row.themeCode,
    row.themeName,
    row.objectiveCode,
    row.criterionCode,
    row.criterionLabel,
    row.requirementLevel === "IMPERATIF" ? "Impératif" : "Standard",
    formatScore(row.criterionScore),
    row.elementText,
    // Cotation non renseignée : cellule VIDE, jamais « 0 ». Un zéro se lirait comme
    // une cotation catastrophique là où il n'y a simplement pas eu d'évaluation.
    // Libellé HAS (1/2/3/4/★/NC/RI) et non le nom technique de l'enum : le fichier
    // est relu par des humains, pas par le code.
    row.rating === null ? "" : RATING_LABELS[row.rating],
    numericValue === null ? "" : String(numericValue),
    row.suggestedBySystem ? "Suggérée puis confirmée" : "Saisie",
    row.comment ?? "",
  ];

  return cells.map(escapeCsvValue).join(CSV_SEPARATOR);
}

export function buildEvaluationCsv(rows: readonly EvaluationExportRow[]): string {
  const lines = [
    EVALUATION_EXPORT_HEADERS.map(escapeCsvValue).join(CSV_SEPARATOR),
    ...rows.map(buildEvaluationCsvLine),
  ];
  return UTF8_BOM + lines.join(CSV_EOL) + CSV_EOL;
}

export function buildEvaluationExportFileName(input: {
  structureName: string;
  issuedOn: Date;
}): string {
  return buildEodaFileName({
    issuedOn: input.issuedOn,
    type: "EXPORT",
    clientName: input.structureName,
    objet: "Cotations-HAS",
    // Interne : c'est un état de travail de l'auto-évaluation préparatoire, pas un
    // livrable remis à la structure.
    audience: "Interne",
    extension: "csv",
  });
}

// Compteurs d'en-tête pour l'écran qui propose l'export : « 295 éléments, 118 cotés ».
// Sans ce repère, on télécharge un fichier sans savoir s'il est presque vide.
export function summariseExport(rows: readonly EvaluationExportRow[]): {
  elements: number;
  rated: number;
  imperatifsAtRisk: number;
} {
  const rated = rows.filter((row) => row.rating !== null);
  // Un critère impératif compte UNE fois, même s'il porte plusieurs éléments : c'est
  // le critère qui est à risque, pas chacune de ses lignes.
  const atRisk = new Set(
    rows
      .filter(
        (row) =>
          row.requirementLevel === "IMPERATIF" &&
          row.criterionScore !== null &&
          row.criterionScore < 4
      )
      .map((row) => row.criterionCode)
  );

  return { elements: rows.length, rated: rated.length, imperatifsAtRisk: atRisk.size };
}
