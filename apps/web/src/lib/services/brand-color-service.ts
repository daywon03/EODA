import { AA_LARGE_TEXT, contrastRatio, type Rgb } from "@/lib/design/contrast";

// ─────────────────────────────────────────────────────────────────────────────
// CHARTE COULEUR DE LA STRUCTURE (E1, call du 09/11/2026) — règles pures.
//
// Sandrine : « il ne prend pas les couleurs [du client] » ; « stocke la charte couleur
// par client pour que quand il refait un document ça ressorte bien ». Deux couleurs,
// saisies par le CABINET sur la fiche de la structure (à côté du logo, même garde),
// appliquées au document FINAL d'une mise en conformité (titres, bandeaux) — jamais à
// la page de garde EODA, qui garde la charte EODA.
//
// La principale colore les titres : elle doit se lire sur le papier blanc (WCAG
// « grand texte », 3:1 — les titres colorés sont le titre, H1 et H2). La secondaire
// trace les bandeaux (filets), décor sans texte. Sans principale : aucun changement.
// ─────────────────────────────────────────────────────────────────────────────

export type BrandColors = { primary: string; secondary: string };
export type BrandColorsInput = { primary: string | null; secondary: string | null };

const WHITE: Rgb = [255, 255, 255];
const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

function normalizeHex(value: string): string | null {
  const match = HEX.exec(value.trim());
  if (!match) return null;
  const digits = match[1]!.length === 3 ? [...match[1]!].map((c) => c + c).join("") : match[1]!;
  return `#${digits.toUpperCase()}`;
}

function toRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

type FieldResult = { ok: true; value: string | null } | { ok: false; error: string };

function parseField(raw: unknown, name: string): FieldResult {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: `Couleur ${name} illisible.` };
  if (raw.trim().length === 0) return { ok: true, value: null };
  const value = normalizeHex(raw);
  if (!value) return { ok: false, error: `Couleur ${name} : écrivez un code hexadécimal, par exemple #1A4D8F.` };
  return { ok: true, value };
}

export type BrandColorsCheck = { ok: true; colors: BrandColorsInput } | { ok: false; error: string };

export function parseBrandColors(raw: { primary: unknown; secondary: unknown }): BrandColorsCheck {
  const primary = parseField(raw.primary, "principale");
  if (!primary.ok) return primary;
  const secondary = parseField(raw.secondary, "secondaire");
  if (!secondary.ok) return secondary;
  if (primary.value === null && secondary.value !== null) {
    return { ok: false, error: "Saisissez d'abord la couleur principale : la secondaire l'accompagne." };
  }
  if (primary.value !== null && contrastRatio(toRgb(primary.value), WHITE) < AA_LARGE_TEXT) {
    return {
      ok: false,
      error: "Couleur principale trop claire : les titres ne se liraient pas sur le papier blanc. Choisissez une teinte plus foncée.",
    };
  }
  return { ok: true, colors: { primary: primary.value, secondary: secondary.value } };
}

// Lecture défensive des colonnes : une valeur illisible vaut « pas de charte ».
export function readBrandColors(row: { brandPrimaryColor: string | null; brandSecondaryColor: string | null }): BrandColors | null {
  const primary = row.brandPrimaryColor ? normalizeHex(row.brandPrimaryColor) : null;
  if (!primary) return null;
  const secondary = row.brandSecondaryColor ? normalizeHex(row.brandSecondaryColor) : null;
  return { primary, secondary: secondary ?? primary };
}

// Word (docx) attend la couleur sans dièse.
export function toDocxColor(hex: string): string {
  return hex.replace(/^#/, "");
}
