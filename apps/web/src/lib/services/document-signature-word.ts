"use client";

import {
  addImageRelationships,
  ensurePngContentType,
  imageParagraph,
  normalizeWithMap,
  readParagraphs,
  type DocxPackage,
  type WordImage,
} from "./dipec-word-service";
import { buildStoredZip } from "./zip-store";
import { classifySignatureLabel, normalizeLine, shortLabel, type SignatureMark } from "./document-signature-service";

// Le texte de chaque paragraphe du corps, dans l'ordre et indexé comme `readParagraphs` :
// c'est la liste à laquelle on rapporte la ligne touchée dans l'aperçu
// (`matchRenderedParagraph`).
export function wordParagraphTexts(documentXml: string): string[] {
  return readParagraphs(documentXml).map((p) => normalizeLine(normalizeWithMap(p.raw).text));
}

// ─────────────────────────────────────────────────────────────────────────────
// SIGNER UN WORD, DANS LE NAVIGATEUR (12/11/2026) — règles dans
// `document-signature-service.ts`. Module client : il s'appuie sur les outils Word du
// DIPEC (`dipec-word-service`), qui ne s'importent que côté navigateur (frontière HDS,
// `survey-roster-boundary.test.ts`). Fonctions pures, testées sans navigateur.
// ─────────────────────────────────────────────────────────────────────────────

export type WordSignatureZone = { id: string; paragraph: number; kind: SignatureMark; label: string };

const TOC_OR_HEADING_STYLE = /^(?:TM\d+|TOC\d+|En-ttedetabledesmatires|TOCHeading|Titre\d*|Heading\d*|Title)$/i;

export function findWordSignatureZones(documentXml: string): WordSignatureZone[] {
  const zones: WordSignatureZone[] = [];
  readParagraphs(documentXml).forEach((p, paragraph) => {
    // « Article 9 – Signature » est un titre, pas une case ; le sommaire non plus.
    if (TOC_OR_HEADING_STYLE.test(p.style)) return;
    const text = normalizeWithMap(p.raw).text;
    const kind = classifySignatureLabel(text);
    if (kind) zones.push({ id: `w${paragraph}`, paragraph, kind, label: shortLabel(text) });
  });
  return zones;
}

// `paragraph: null` = en fin de document (aucune case trouvée, ou une case en plus).
export type WordMarkPlacement = { paragraph: number | null; mark: SignatureMark; png: Uint8Array };

const EMU_PER_CM = 360000;
export const MARK_MAX_EMU: Record<SignatureMark, { width: number; height: number }> = {
  SIGNATURE: { width: 4.5 * EMU_PER_CM, height: 1.6 * EMU_PER_CM },
  TAMPON: { width: 4 * EMU_PER_CM, height: 4 * EMU_PER_CM },
};

const DOCUMENT = "word/document.xml";
const RELS = "word/_rels/document.xml.rels";
const CONTENT_TYPES = "[Content_Types].xml";

// Premier numéro libre pour nos images : un document signé, redéposé puis re-signé,
// porte déjà `media/eoda-marque-1.png` — deux entrées du même nom casseraient l'archive.
export function firstFreeMarkNumber(entryNames: readonly string[]): number {
  const used = entryNames.map((n) => /^word\/media\/eoda-marque-(\d+)\.png$/.exec(n)?.[1]).filter((n): n is string => Boolean(n));
  return used.length === 0 ? 1 : Math.max(...used.map(Number)) + 1;
}

export function planWordMarks(
  documentXml: string,
  placements: readonly WordMarkPlacement[],
  firstNumber = 1
): { documentXml: string; images: WordImage[] } {
  const paragraphs = readParagraphs(documentXml);
  const plain = readParagraphs("<w:p></w:p>")[0]!;
  let docPrId = Math.max(1000, ...[...documentXml.matchAll(/<(?:wp:docPr|pic:cNvPr) id="(\d+)"/g)].map((m) => Number(m[1]))) + 1;
  const images: WordImage[] = [];
  const after = new Map<number, string[]>();
  const atEnd: string[] = [];

  placements.forEach((placement, index) => {
    const n = firstNumber + index;
    const relId = `rIdEodaMarque${n}`;
    images.push({ relId, target: `media/eoda-marque-${n}.png`, data: placement.png });
    const anchor = placement.paragraph === null ? undefined : paragraphs[placement.paragraph];
    const xml = imageParagraph(anchor ?? plain, relId, docPrId, placement.png, MARK_MAX_EMU[placement.mark]);
    docPrId += 1;
    if (anchor) after.set(placement.paragraph!, [...(after.get(placement.paragraph!) ?? []), xml]);
    else atEnd.push(xml);
  });

  let xml = documentXml;
  if (atEnd.length > 0) {
    // Avant la dernière propriété de section du corps (marges, orientation), sinon avant
    // la fermeture du corps.
    const body = xml.lastIndexOf("</w:body>");
    const sect = xml.lastIndexOf("<w:sectPr", body);
    const at = sect >= 0 ? sect : body;
    if (at >= 0) xml = `${xml.slice(0, at)}${atEnd.join("")}${xml.slice(at)}`;
  }
  for (const index of [...after.keys()].sort((a, b) => b - a)) {
    const p = paragraphs[index]!;
    xml = `${xml.slice(0, p.end)}${after.get(index)!.join("")}${xml.slice(p.end)}`;
  }
  return { documentXml: xml, images };
}

export function signWordPackage(pkg: DocxPackage, placements: readonly WordMarkPlacement[], modifiedAt: Date): Uint8Array {
  const planned = planWordMarks(pkg.documentXml, placements, firstFreeMarkNumber(pkg.entries.map((e) => e.name)));
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const hasImages = planned.images.length > 0;
  const files = pkg.entries.map((entry) => {
    let data = entry.data;
    if (entry.name === DOCUMENT) data = encoder.encode(planned.documentXml);
    else if (hasImages && entry.name === RELS) data = encoder.encode(addImageRelationships(decoder.decode(entry.data), planned.images));
    else if (hasImages && entry.name === CONTENT_TYPES) data = encoder.encode(ensurePngContentType(decoder.decode(entry.data)));
    return { name: entry.name, data, modifiedAt };
  });
  const media = planned.images.map((img) => ({ name: `word/${img.target}`, data: img.data, modifiedAt }));
  return buildStoredZip([...files, ...media]);
}

