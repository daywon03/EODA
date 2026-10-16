// ─────────────────────────────────────────────────────────────────────────────
// IMPORT D'UNE LISTE DE SALARIÉS (CSV « nom ; métier ») — service PUR (N10).
//
// Pas de tableur binaire : un simple texte, séparé par « ; » (export Excel français)
// ou « , ». Une ligne d'en-tête « nom ; métier » est reconnue et sautée. Les lignes
// invalides sont RENDUES avec leur numéro — l'écran dit lesquelles et pourquoi —,
// les valides sont importées. Doublons (même nom dans le fichier ou déjà dans
// l'équipe) ignorés et signalés.
// ─────────────────────────────────────────────────────────────────────────────

export const STAFF_IMPORT_MAX_LINES = 500;
const MAX_FIELD = 120;

export type StaffImportRow = { displayName: string; jobTitle: string };
export type StaffImportIssue = { line: number; reason: string };
export type StaffImportPlan = { rows: StaffImportRow[]; issues: StaffImportIssue[] };

const HEADER = /^\s*(nom|name)\s*[;,]\s*(m[ée]tier|poste|fonction)/i;

function normalize(value: string): string {
  return value.replace(/^﻿/, "").replace(/^"|"$/g, "").replace(/\s+/g, " ").trim();
}

function nameKey(name: string): string {
  return name.toLocaleLowerCase("fr-FR");
}

export function planStaffImport(text: string, existingNames: readonly string[] = []): StaffImportPlan {
  const lines = text.split(/\r?\n/);
  const rows: StaffImportRow[] = [];
  const issues: StaffImportIssue[] = [];
  const seen = new Set(existingNames.map(nameKey));

  lines.forEach((raw, index) => {
    const line = index + 1;
    if (raw.trim() === "") return;
    if (index === 0 && HEADER.test(raw.replace(/^﻿/, ""))) return;
    if (rows.length + issues.length >= STAFF_IMPORT_MAX_LINES) {
      if (issues.at(-1)?.reason !== "trop de lignes") issues.push({ line, reason: "trop de lignes" });
      return;
    }
    const parsed = parseLine(raw, seen);
    if ("reason" in parsed) {
      issues.push({ line, reason: parsed.reason });
      return;
    }
    seen.add(nameKey(parsed.displayName));
    rows.push(parsed);
  });

  return { rows, issues };
}

function parseLine(raw: string, seen: ReadonlySet<string>): StaffImportRow | { reason: string } {
  const separator = raw.includes(";") ? ";" : ",";
  const [nameRaw = "", jobRaw = "", ...rest] = raw.split(separator);
  const displayName = normalize(nameRaw);
  const jobTitle = normalize(jobRaw);
  if (rest.some((value) => normalize(value) !== "")) return { reason: "plus de deux colonnes" };
  if (!displayName) return { reason: "nom manquant" };
  if (!jobTitle) return { reason: "métier manquant" };
  if (displayName.length > MAX_FIELD || jobTitle.length > MAX_FIELD) return { reason: "texte trop long" };
  if (seen.has(nameKey(displayName))) return { reason: "déjà dans l'équipe" };
  return { displayName, jobTitle };
}

export function describeImportResult(created: number, issues: readonly StaffImportIssue[]): string {
  const head = `${created} personne${created > 1 ? "s" : ""} ajoutée${created > 1 ? "s" : ""}.`;
  if (issues.length === 0) return head;
  const detail = issues
    .slice(0, 5)
    .map((issue) => `ligne ${issue.line} : ${issue.reason}`)
    .join(" ; ");
  return `${head} ${issues.length} ligne${issues.length > 1 ? "s" : ""} non importée${issues.length > 1 ? "s" : ""} (${detail}${issues.length > 5 ? "…" : ""}).`;
}
