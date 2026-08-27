import type { DocumentAnalysisResult } from "@/lib/llm";
import { buildEodaFileName } from "./document-naming-service";
import type { DocumentStep } from "./document-workflow-service";

// ─────────────────────────────────────────────────────────────────────────────
// RAPPORT DE MISE EN CONFORMITÉ — le document autonome, archivable, remis au client.
//
// Demandé le 26/08 : « l'IA fait le rapport de tous les changements […] ce qui a été
// réclamé par l'analyse documentaire, mise en conformité, et ce qui a été fait. Ça, on
// leur envoie. » C'est la deuxième des trois pièces qu'elle attend par document — la
// version du client, LE RAPPORT, la version modifiée.
//
// ⚠️ Une règle gouverne tout ce fichier : **seules les analyses RELUES entrent dans le
// rapport**. Le document part chez le client ; y verser une analyse que personne n'a
// vérifiée contournerait la revue humaine par la porte de l'imprimante (CDC §5, §7).
// Les documents dont l'analyse attend encore sont listés — leur absence serait plus
// troublante que la mention « en cours de relecture » — mais sans leur contenu.
//
// Règles PURES : ni Prisma, ni React, ni horloge.
// ─────────────────────────────────────────────────────────────────────────────

export type ReportSourceItem = {
  code: string;
  label: string;
  category: string;
  step: DocumentStep;
  // Analyse déjà filtrée par l'audience CABINET : présente même non relue.
  analysis: DocumentAnalysisResult | null;
  analysisReviewedAt: Date | null;
  // Critères HAS rattachés à ce type de document — « il manque ça, au regard de tel
  // critère » est ce qui distingue un rapport d'une liste de reproches.
  criteria: { code: string; label: string }[];
};

export type ReportLine = {
  code: string;
  label: string;
  category: string;
  criteria: { code: string; label: string }[];
  // Trois états, et trois seulement, du point de vue du rapport.
  state: "MANQUANT" | "EN_RELECTURE" | "ANALYSE";
  missing: string[];
  suggestions: string[];
  present: string[];
  seemsCompliant: boolean;
};

export function buildReportLine(item: ReportSourceItem): ReportLine {
  const base = {
    code: item.code,
    label: item.label,
    category: item.category,
    criteria: item.criteria,
    missing: [] as string[],
    suggestions: [] as string[],
    present: [] as string[],
    seemsCompliant: false,
  };

  // Rien de déposé : le rapport le dit, c'est une information à part entière — c'est
  // même la première ligne du plan d'action.
  if (item.step === "ATTENDU" || !item.analysis) {
    return { ...base, state: "MANQUANT" };
  }

  // Analysé mais pas relu : on annonce l'attente, on ne publie pas le contenu.
  if (item.analysisReviewedAt === null) {
    return { ...base, state: "EN_RELECTURE" };
  }

  return {
    ...base,
    state: "ANALYSE",
    missing: item.analysis.elementsManquants,
    suggestions: item.analysis.suggestionsCorrection,
    present: item.analysis.elementsPresents,
    seemsCompliant: item.analysis.sembleConforme,
  };
}

export function buildReportLines(items: ReportSourceItem[]): ReportLine[] {
  return items.map(buildReportLine);
}

export type ReportSummary = {
  total: number;
  missingDocuments: number;
  awaitingReview: number;
  analysed: number;
  // Nombre total d'écarts relevés, tous documents confondus — le chiffre que Sandrine
  // annonce en réunion.
  gaps: number;
};

export function summariseReport(lines: ReportLine[]): ReportSummary {
  return {
    total: lines.length,
    missingDocuments: lines.filter((line) => line.state === "MANQUANT").length,
    awaitingReview: lines.filter((line) => line.state === "EN_RELECTURE").length,
    analysed: lines.filter((line) => line.state === "ANALYSE").length,
    gaps: lines.reduce((total, line) => total + line.missing.length, 0),
  };
}

// Un rapport sans aucune analyse relue n'a rien à dire : mieux vaut refuser de le
// produire que remettre un document vide portant l'en-tête d'EODA.
export function hasReportableContent(lines: ReportLine[]): boolean {
  return lines.some((line) => line.state === "ANALYSE" || line.state === "MANQUANT");
}

export function buildReportFileName(input: { structureName: string; issuedOn: Date }): string {
  return buildEodaFileName({
    issuedOn: input.issuedOn,
    type: "RAPPORT",
    clientName: input.structureName,
    objet: "Mise-en-conformite-documentaire",
    audience: "Externe",
    extension: "pdf",
  });
}
