// ─────────────────────────────────────────────────────────────────────────────
// ÉMARGEMENT DES QUIZ — service PUR (N10).
//
// Le CSV des tentatives RÉUSSIES : la preuve de sensibilisation d'une équipe, telle
// qu'elle se présente à l'évaluation HAS (« qui a été sensibilisé, à quoi, quand, sur
// quelle version »). Une ligne par réussite, jamais les réponses.
//
// Séparateur « ; » et BOM UTF-8 : c'est ce qu'ouvre correctement un tableur réglé en
// français. Toute cellule commençant par = + - @ est neutralisée (injection de
// formule) : un nom saisi n'exécute rien à l'ouverture.
// ─────────────────────────────────────────────────────────────────────────────

import { csvCell } from "./csv-cell";

export type SignoffAttempt = {
  displayName: string;
  jobTitle: string;
  moduleTitle: string;
  moduleVersion: number;
  score: number;
  total: number;
  completedAt: Date;
};

const HEADER = ["Personne", "Métier", "Quiz", "Version", "Score", "Date"];

export function neutralizeCsvCell(value: string): string {
  return csvCell(value);
}

function formatDay(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

export function buildSignoffCsv(attempts: readonly SignoffAttempt[]): string {
  const sorted = [...attempts].sort(
    (a, b) => a.displayName.localeCompare(b.displayName, "fr") || a.completedAt.getTime() - b.completedAt.getTime()
  );
  const lines = [
    HEADER.join(";"),
    ...sorted.map((a) =>
      [a.displayName, a.jobTitle, a.moduleTitle, `v${a.moduleVersion}`, `${a.score}/${a.total}`, formatDay(a.completedAt)]
        .map(neutralizeCsvCell)
        .join(";")
    ),
  ];
  return `﻿${lines.join("\r\n")}\r\n`;
}
