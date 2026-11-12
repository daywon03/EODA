import { isRestrictedDocumentType } from "@/content/documents/acces-restreint";
import type { ClientAccessRole } from "@/lib/auth/capabilities";

// ─────────────────────────────────────────────────────────────────────────────
// SIGNER ET TAMPONNER UN DOCUMENT ACCEPTÉ — service PUR (demande de Damon, 11/11/2026 :
// « que les clients puissent tamponner avec leur tampon et/ou signer les documents une
// fois qu'ils les ont lus et validés, et que l'analyse repère où sont les cases de
// signature »).
//
// Décisions de Damon (12/11/2026, maquette « Signer et tamponner », option B) :
//  - la DIRECTION seule signe et tamponne (le tampon est déjà à accès restreint : seule
//    elle l'ouvre) ;
//  - la signature est redessinée à chaque fois, jamais gardée ;
//  - la copie signée et tamponnée est visible d'EODA : c'est le document final.
//
// Les cases sont repérées par leurs LIBELLÉS, sans IA : c'est la règle des documents à
// accès restreint (le tampon ne part jamais à un modèle) et c'est ce que fait déjà le
// DIPEC de la tablette. Ce que l'on ne trouve pas se place à la main (PDF) ou en fin de
// document (Word) — l'écran le dit.
//
// Ce module est PUR et partagé serveur / navigateur. Ce qui touche l'archive Word vit
// dans `document-signature-word.ts` (module client) : il s'appuie sur
// `dipec-word-service`, derrière la frontière HDS (`survey-roster-boundary.test.ts`).
//
// La copie signée N'EST PAS une nouvelle version : elle est rangée SUR la version
// acceptée (`DocumentVersion.signedFileStorageKey`). Une nouvelle version rendrait
// caducs « Relu par EODA » et « Accepté » (`isValidationCurrent`, `isAcceptanceCurrent`)
// et repartirait à l'analyse — avec le tampon dedans.
// ─────────────────────────────────────────────────────────────────────────────

export type SignatureMark = "SIGNATURE" | "TAMPON";
export type SignableKind = "DOCX" | "PDF";

// Au-delà, ce n'est plus un libellé de case mais une phrase qui parle de signature.
const MAX_LABEL_LENGTH = 90;
const TAMPON_LABEL = /\b(cachet|tampon)\b/i;
const SIGNATURE_LABEL =
  /^(signature|signé|visa)\b|\bsignature\s*:|^(le|la) (directeur|directrice|président|présidente|responsable)\b|^pour (la structure|la direction|l['’]association|le service|l['’]établissement)\b|^lu et approuvé/i;

// Une ligne de texte → la marque que sa case attend, ou rien.
export function classifySignatureLabel(text: string): SignatureMark | null {
  const line = text.replace(/\s+/g, " ").trim();
  if (!line || line.length > MAX_LABEL_LENGTH) return null;
  if (TAMPON_LABEL.test(line)) return "TAMPON";
  if (SIGNATURE_LABEL.test(line)) return "SIGNATURE";
  return null;
}

export function shortLabel(text: string): string {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > 60 ? `${line.slice(0, 57)}…` : line;
}

// ── Word : l'endroit choisi À LA MAIN dans l'aperçu (retour de Damon, 12/11/2026 :
// « s'il manque des endroits qui n'ont pas été trouvés, qu'il puisse sélectionner où
// signer ou tamponner ») ─────────────────────────────────────────────────────
// L'aperçu (docx-preview) dessine les paragraphes du corps dans l'ordre du document. Le
// paragraphe touché est retrouvé par son TEXTE et son rang parmi les paragraphes de même
// texte ; une ligne vide (la place souvent laissée pour signer) se repère depuis la
// dernière ligne écrite au-dessus d'elle. Rien de trouvé : null, l'écran le dit.

export function normalizeLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function matchRenderedParagraph(xmlTexts: readonly string[], rendered: readonly string[], clicked: number): number | null {
  if (clicked < 0 || clicked >= rendered.length) return null;
  let anchor = clicked;
  while (anchor >= 0 && !rendered[anchor]) anchor -= 1;
  if (anchor < 0) return null;
  const text = rendered[anchor]!;
  const rank = rendered.slice(0, anchor + 1).filter((t) => t === text).length;
  let seen = 0;
  const found = xmlTexts.findIndex((t) => t === text && ++seen === rank);
  if (found < 0) return null;
  const blanks = clicked - anchor;
  for (let i = 1; i <= blanks; i += 1) if (xmlTexts[found + i] !== "") return found;
  return found + blanks;
}

// ── PDF ──────────────────────────────────────────────────────────────────────
// Coordonnées en points PDF, origine en BAS à gauche (celles de pdf-lib).

export type PdfRect = { x: number; y: number; width: number; height: number };
export type PdfTextItem = { text: string; x: number; y: number; width: number; height: number };
export type PdfPageText = { page: number; width: number; height: number; items: readonly PdfTextItem[] };
export type PdfSignatureZone = { id: string; page: number; kind: SignatureMark; label: string; rect: PdfRect };

export const MARK_BOX_PT: Record<SignatureMark, { width: number; height: number }> = {
  SIGNATURE: { width: 160, height: 60 },
  TAMPON: { width: 100, height: 100 },
};
const PAGE_MARGIN_PT = 8;
const SAME_LINE_PT = 2.5;

type PdfLine = { text: string; x: number; y: number; height: number };

// Au-delà de cet écart, deux morceaux d'une même ligne sont deux COLONNES (tableau
// « Le directeur | Cachet de la structure »), donc deux cases.
const COLUMN_GAP_PT = 24;

// pdf.js découpe le texte en morceaux : on recolle ceux d'une même ligne et d'une même
// colonne.
export function groupPdfLines(items: readonly PdfTextItem[]): PdfLine[] {
  const sorted = [...items].filter((i) => i.text.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: { y: number; parts: PdfTextItem[] }[] = [];
  for (const item of sorted) {
    const row = rows.find((l) => Math.abs(l.y - item.y) <= SAME_LINE_PT);
    if (row) row.parts.push(item);
    else rows.push({ y: item.y, parts: [item] });
  }
  const lines: PdfLine[] = [];
  for (const row of rows) {
    const segments: PdfTextItem[][] = [];
    for (const part of row.parts.sort((a, b) => a.x - b.x)) {
      const current = segments[segments.length - 1];
      const last = current?.[current.length - 1];
      if (current && last && part.x - (last.x + last.width) <= COLUMN_GAP_PT) current.push(part);
      else segments.push([part]);
    }
    for (const parts of segments) {
      lines.push({
        text: parts.map((p) => p.text).join(" ").replace(/\s+/g, " ").trim(),
        x: parts[0]!.x,
        y: row.y,
        height: Math.max(...parts.map((p) => p.height)),
      });
    }
  }
  return lines;
}

function clampRect(rect: PdfRect, pageWidth: number, pageHeight: number): PdfRect {
  const width = Math.min(rect.width, pageWidth - 2 * PAGE_MARGIN_PT);
  const height = Math.min(rect.height, pageHeight - 2 * PAGE_MARGIN_PT);
  return {
    x: Math.min(Math.max(rect.x, PAGE_MARGIN_PT), pageWidth - PAGE_MARGIN_PT - width),
    y: Math.min(Math.max(rect.y, PAGE_MARGIN_PT), pageHeight - PAGE_MARGIN_PT - height),
    width,
    height,
  };
}

// La case est SOUS son libellé : c'est là que l'on signe sur le papier.
export function findPdfSignatureZones(pages: readonly PdfPageText[]): PdfSignatureZone[] {
  const zones: PdfSignatureZone[] = [];
  for (const page of pages) {
    groupPdfLines(page.items).forEach((line, index) => {
      const kind = classifySignatureLabel(line.text);
      if (!kind) return;
      const box = MARK_BOX_PT[kind];
      const rect = clampRect({ x: line.x, y: line.y - box.height - 4, ...box }, page.width, page.height);
      zones.push({ id: `p${page.page}-${index}`, page: page.page, kind, label: shortLabel(line.text), rect });
    });
  }
  return zones;
}

// Un clic sur la page (fractions 0..1 depuis le HAUT à gauche, comme à l'écran) → une
// case centrée sur le clic, dans la page.
export function manualPdfZone(input: {
  id: string;
  page: number;
  pageWidth: number;
  pageHeight: number;
  fx: number;
  fy: number;
  kind: SignatureMark;
}): PdfSignatureZone {
  const box = MARK_BOX_PT[input.kind];
  const cx = input.fx * input.pageWidth;
  const cy = (1 - input.fy) * input.pageHeight;
  return {
    id: input.id,
    page: input.page,
    kind: input.kind,
    label: "Placée à la main",
    rect: clampRect({ x: cx - box.width / 2, y: cy - box.height / 2, ...box }, input.pageWidth, input.pageHeight),
  };
}

// L'image garde ses proportions, centrée dans sa case.
export function fitInRect(image: { width: number; height: number }, rect: PdfRect): PdfRect {
  const scale = Math.min(rect.width / image.width, rect.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return { x: rect.x + (rect.width - width) / 2, y: rect.y + (rect.height - height) / 2, width, height };
}

// ── Ce qui se pose par défaut ───────────────────────────────────────────────
// La signature dans la PREMIÈRE case de signature, le tampon dans la PREMIÈRE case de
// cachet ; les autres cases restent vides tant que la direction ne les choisit pas.
export function defaultZoneMarks(zones: readonly { id: string; kind: SignatureMark }[]): Record<string, SignatureMark | null> {
  const out: Record<string, SignatureMark | null> = {};
  const seen = new Set<SignatureMark>();
  for (const zone of zones) {
    out[zone.id] = seen.has(zone.kind) ? null : zone.kind;
    seen.add(zone.kind);
  }
  return out;
}

// ── Qui signe, quoi ─────────────────────────────────────────────────────────

export function signableKind(filename: string): SignableKind | null {
  const ext = /\.([a-z0-9]+)$/i.exec(filename)?.[1]?.toLowerCase();
  if (ext === "docx") return "DOCX";
  if (ext === "pdf") return "PDF";
  return null;
}

export function signedFilename(filename: string): string {
  const match = /^(.*?)(\.[a-z0-9]+)?$/i.exec(filename);
  const base = (match?.[1] || "document").replace(/-signe$/i, "");
  return `${base}-signe${match?.[2] ?? ""}`;
}

// Ce que la carte de « Mes documents » PROPOSE (l'action revérifie tout) : signer un
// document accepté, Word ou PDF, si l'on est la direction et que les dépôts sont ouverts ;
// sinon, s'il est signé, la copie signée à télécharger.
export type CardSignatureOffer = "SIGN" | "SIGNED" | null;

export function cardSignatureOffer(facts: {
  accepted: boolean;
  isDirection: boolean;
  canAct: boolean;
  restricted: boolean;
  filename: string | null;
  signedAt: Date | null;
}): CardSignatureOffer {
  if (facts.signedAt) return "SIGNED";
  if (!facts.accepted || !facts.isDirection || !facts.canAct || facts.restricted) return null;
  return facts.filename && signableKind(facts.filename) ? "SIGN" : null;
}

export function signingPagePath(documentTypeId: string): string {
  return `/dashboard/client/documents/signer/${encodeURIComponent(documentTypeId)}`;
}

export function signedCopyPath(versionId: string): string {
  return `/api/documents/${encodeURIComponent(versionId)}/signed`;
}

export type SigningRefusal ="NOT_DIRECTION" | "CLOSED" | "RESTRICTED" | "NOT_ACCEPTED" | "UNSUPPORTED_FORMAT" | "ALREADY_SIGNED";

export const SIGNING_REFUSAL_MESSAGES: Record<SigningRefusal, string> = {
  NOT_DIRECTION: "Seule la direction de la structure signe et tamponne les documents.",
  CLOSED: "L'accompagnement est terminé : aucun nouveau geste n'est possible.",
  RESTRICTED: "Ce document ne se signe pas.",
  NOT_ACCEPTED: "Acceptez d'abord ce document : on ne signe que ce qu'on a lu et accepté.",
  UNSUPPORTED_FORMAT: "Seuls les documents Word (.docx) et PDF se signent ici.",
  ALREADY_SIGNED: "Ce document est déjà signé. Une nouvelle version déposée pourra être signée à son tour.",
};

export function signingRefusal(facts: {
  accessRole: ClientAccessRole | null;
  canWrite: boolean;
  documentTypeCode: string | null | undefined;
  acceptanceCurrent: boolean;
  filename: string;
  alreadySigned: boolean;
}): SigningRefusal | null {
  if (facts.accessRole !== "DIRECTION") return "NOT_DIRECTION";
  if (!facts.canWrite) return "CLOSED";
  if (isRestrictedDocumentType(facts.documentTypeCode)) return "RESTRICTED";
  if (!facts.acceptanceCurrent) return "NOT_ACCEPTED";
  if (!signableKind(facts.filename)) return "UNSUPPORTED_FORMAT";
  if (facts.alreadySigned) return "ALREADY_SIGNED";
  return null;
}
