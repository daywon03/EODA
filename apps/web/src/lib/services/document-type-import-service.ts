import {
  documentTypeLabelKey,
  MAX_CRITERIA_AT_CREATION,
  normalizeCriterionQuery,
  normalizeDocumentTypeLabel,
} from "@/lib/services/document-type-creation-service";

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT D'UN TABLEUR DANS « DOCUMENTS » — règles pures (call du 29/10/2026).
//
// Sandrine tient ses 23 fiches de sensibilisation dans un Excel (onglet
// « récapitulatif » : intitulé + critères couverts). « Rentrer 23 lignes une par une »
// lui coûte une demi-journée : elle exporte l'onglet, le dépose, et la liste se crée
// avec ses critères. Le fichier est lu dans le navigateur ; ici, on ne fait que
// comprendre des lignes de texte.
//
// L'import PROPOSE, il ne range pas (même doctrine que `planFolderImport` de la
// bibliothèque) : chaque ligne est montrée — nouvelle, doublon, critère inconnu — et
// seule une ligne cochée et sans problème est créée, recalculée côté serveur.
//
// Les colonnes se reconnaissent à leur EN-TÊTE, où qu'elles soient : on n'a pas le
// fichier exact, et il bougera. Toutes les colonnes « critère » sont lues (impératifs,
// standards, autres) ; les autres colonnes sont ignorées.
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_IMPORT_LINES = 200;
const HEADER_SEARCH_ROWS = 15;

const LABEL_HEADER = /intitul|titre|nom du (document|support)|^document|^fiche|^support|libell/;
const CRITERIA_HEADER = /crit[eè]re/;
const FOLDER_HEADER = /dossier|rubrique|famille|th[eè]me/;
// Un code de critère dans du texte libre : « 3.14.2 », « 3-14-2 », « 1.2 ». Jamais une
// version (« v02 ») ni une date (« 29/10 »), qui n'ont pas cette forme.
const CRITERION_IN_TEXT = /(?<![\d.\-/])\d{1,2}[.\-]\d{1,2}(?:[.\-]\d{1,2})?(?![\d/])/g;

export type ImportedRow = { label: string; criteria: string[]; folderLabel: string | null };

export class ImportFormatError extends Error {}

function headerKey(cell: string): string {
  return cell
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function criterionCodesInText(text: string): string[] {
  const codes = [...text.matchAll(CRITERION_IN_TEXT)].map((match) => normalizeCriterionQuery(match[0]));
  return [...new Set(codes)];
}

// Tableau de cellules (première feuille, ou CSV) → lignes à proposer.
export function readImportRows(cells: readonly (readonly string[])[]): ImportedRow[] {
  const headerIndex = cells
    .slice(0, HEADER_SEARCH_ROWS)
    .findIndex((row) => row.some((cell) => LABEL_HEADER.test(headerKey(cell))));
  if (headerIndex < 0) {
    throw new ImportFormatError(
      "Aucune colonne « Intitulé » (ou « Titre », « Nom du document ») trouvée dans les premières lignes."
    );
  }
  const header = cells[headerIndex]!.map(headerKey);
  const labelColumn = header.findIndex((cell) => LABEL_HEADER.test(cell));
  const criteriaColumns = header.flatMap((cell, index) => (CRITERIA_HEADER.test(cell) ? [index] : []));
  const folderColumn = header.findIndex((cell) => FOLDER_HEADER.test(cell));

  const rows: ImportedRow[] = [];
  for (const row of cells.slice(headerIndex + 1)) {
    const label = normalizeDocumentTypeLabel(row[labelColumn] ?? "");
    if (label === "") continue;
    const criteria = [...new Set(criteriaColumns.flatMap((column) => criterionCodesInText(row[column] ?? "")))];
    const folder = folderColumn >= 0 ? normalizeDocumentTypeLabel(row[folderColumn] ?? "") : "";
    rows.push({ label, criteria, folderLabel: folder === "" ? null : folder });
  }
  return rows;
}

// Excel en français exporte le CSV au point-virgule : on choisit le séparateur le plus
// présent sur la première ligne non vide.
export function detectCsvDelimiter(text: string): "," | ";" {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim() !== "") ?? "";
  return (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
}

export type ImportLineStatus = "NEW" | "DUPLICATE" | "INVALID";

export type ImportLinePlan = {
  label: string;
  criteria: string[];
  unknownCriteria: string[];
  status: ImportLineStatus;
  // Ce qui empêche la création, dit en clair.
  problem: string | null;
};

// Une ligne est créable si son libellé est neuf (ni en base, ni plus haut dans le
// même fichier) et si tous ses critères existent : un code inconnu ne laisse jamais
// une ligne à moitié rattachée (même règle que la création à la main).
export function planDocumentTypeImport(input: {
  rows: readonly { label: string; criteria: readonly string[] }[];
  existingLabels: readonly string[];
  knownCriterionCodes: ReadonlySet<string>;
  labelError: (label: string) => string | null;
}): ImportLinePlan[] {
  const existing = new Map(input.existingLabels.map((label) => [documentTypeLabelKey(label), label]));
  const seen = new Set<string>();
  return input.rows.slice(0, MAX_IMPORT_LINES).map((row) => {
    const label = normalizeDocumentTypeLabel(row.label);
    const criteria = [...new Set(row.criteria.map(normalizeCriterionQuery).filter((code) => code !== ""))];
    const unknownCriteria = criteria.filter((code) => !input.knownCriterionCodes.has(code));
    const key = documentTypeLabelKey(label);
    const already = existing.get(key);
    if (already) {
      return { label, criteria, unknownCriteria, status: "DUPLICATE", problem: `Existe déjà : « ${already} ».` };
    }
    if (seen.has(key)) {
      return { label, criteria, unknownCriteria, status: "DUPLICATE", problem: "En double dans le fichier." };
    }
    seen.add(key);
    const labelProblem = input.labelError(label);
    if (labelProblem) return { label, criteria, unknownCriteria, status: "INVALID", problem: labelProblem };
    if (criteria.length > MAX_CRITERIA_AT_CREATION) {
      return { label, criteria, unknownCriteria, status: "INVALID", problem: `Plus de ${MAX_CRITERIA_AT_CREATION} critères.` };
    }
    if (unknownCriteria.length > 0) {
      return {
        label,
        criteria,
        unknownCriteria,
        status: "INVALID",
        problem: `Critère inconnu du référentiel : ${unknownCriteria.join(", ")}.`,
      };
    }
    return { label, criteria, unknownCriteria, status: "NEW", problem: null };
  });
}

// Entrée d'une action serveur : non fiable. Rend `null` si la forme ne va pas.
export function parseImportPayload(raw: unknown): { label: string; criteria: string[] }[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_IMPORT_LINES) return null;
  const rows: { label: string; criteria: string[] }[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) return null;
    const { label, criteria } = item as { label?: unknown; criteria?: unknown };
    if (typeof label !== "string" || label.length > 500) return null;
    if (!Array.isArray(criteria) || criteria.length > 100) return null;
    if (!criteria.every((code): code is string => typeof code === "string" && code.length <= 20)) return null;
    rows.push({ label, criteria });
  }
  return rows;
}
