import {
  AID_KIND_LABELS,
  contactLink,
  frenchDay,
  mergeDipcText,
  signerName,
  SIGNER_LABELS,
  type AdmissionAid,
  type AdmissionContact,
  type AdmissionField,
  type AdmissionIdentity,
  type AdmissionSigner,
} from "./admission-service";
import type { TrustedPerson } from "./trusted-person-service";
import { PAYMENT_FIELD_PREFIX, prepareDipcLines, type DipcBlock, type PreparedDipc } from "./dipc-tablet-preparation";
import { cleanName } from "./survey-roster-service";
import { buildStoredZip } from "./zip-store";
import { readZip, type InflateRaw, type ZipEntry } from "./zip-read";

// ─────────────────────────────────────────────────────────────────────────────
// LE WORD D'EODA, REMPLI ET SIGNÉ SUR LA TABLETTE — service PUR (demande de Damon,
// 27/10/2026 : « le contrat, il faut que ce soit le même que EODA a mis : garde les
// couleurs, garde la version originale validée »).
//
// La copie en texte (dipc-tablet-preparation) perdait la mise en page. Ici, c'est le
// .docx VALIDÉ lui-même qui est rempli : on ne réécrit que les caractères des zones
// à remplir, dans les runs qui les portent — tout le reste (couleurs, polices,
// tableaux, numérotation, en-têtes, annexes) est l'octet près celui d'EODA.
//
//  - les zones sont repérées par LES MÊMES règles que la copie en texte
//    (`prepareDipcLines`, une seule définition), paragraphe par paragraphe ;
//  - les signatures sont des images posées sous « Signature : » dans le tableau
//    « Remise et signature » (structure / bénéficiaire) et, si une personne de
//    confiance est désignée, dans l'annexe 3.2 (signature et cosignature) ;
//  - article 3.4 « Le rythme des interventions » : le rythme convenu (aide, heures,
//    jours et horaires) s'écrit sous la phrase « Les jours et horaires… sont définis
//    par la structure avec le bénéficiaire » — c'est la donnée qu'elle annonce, pas
//    une clause ;
//  - rien ne quitte le navigateur (verrou HDS) : ce module ne fait que transformer
//    des octets, la tablette les range et les partage.
// ─────────────────────────────────────────────────────────────────────────────

type TextNode = { openTag: string; start: number; end: number; text: string };
export type WordParagraph = { start: number; end: number; xml: string; style: string; raw: string; nodes: TextNode[] };

const P_TOKEN = /<w:p(?=[\s>/])[^>]*?(\/?)>|<\/w:p>/g;
const T_NODE = /(<w:t(?:\s[^>]*)?>)([^<]*)<\/w:t>/g;
const HEADING_STYLE = /^(?:Titre\d*|Heading\d*|Title|Sous-titre|Subtitle)$/i;
const TOC_STYLE = /^(?:TM\d+|TOC\d+|En-ttedetabledesmatires|TOCHeading)$/i;

export function unescapeXml(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (_, e: string) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ({ lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" } as Record<string, string>)[e.toLowerCase()]!;
  });
}

export function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildParagraph(xml: string, start: number): WordParagraph {
  const nodes = [...xml.matchAll(T_NODE)].map((m) => ({
    openTag: m[1]!,
    start: m.index + m[1]!.length,
    end: m.index + m[1]!.length + m[2]!.length,
    text: unescapeXml(m[2]!),
  }));
  return { start, end: start + xml.length, xml, style: /<w:pStyle w:val="([^"]*)"/.exec(xml)?.[1] ?? "", raw: nodes.map((n) => n.text).join(""), nodes };
}

// Paragraphes « feuilles » dans l'ordre du document (un paragraphe qui en contient
// d'autres — zone de texte dessinée — est un décor, on n'y écrit pas).
export function readParagraphs(xml: string): WordParagraph[] {
  const out: WordParagraph[] = [];
  const stack: { start: number; nested: boolean }[] = [];
  for (const m of xml.matchAll(P_TOKEN)) {
    if (m[0] === "</w:p>") {
      const open = stack.pop();
      if (!open) continue;
      if (stack.length > 0) stack[stack.length - 1]!.nested = true;
      if (!open.nested) out.push(buildParagraph(xml.slice(open.start, m.index + m[0].length), open.start));
    } else if (m[1] === "/") {
      if (stack.length > 0) stack[stack.length - 1]!.nested = true;
    } else {
      stack.push({ start: m.index, nested: false });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

// Texte aux espaces resserrés, et pour chaque caractère sa position dans le texte
// brut (dernière case : la fin du texte utile) — pour réécrire au bon endroit.
export function normalizeWithMap(raw: string): { text: string; map: number[] } {
  const chars: string[] = [];
  const map: number[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const c = raw[i]!;
    if (c === " " || c === "\t") {
      if (chars.length === 0 || chars[chars.length - 1] === " ") continue;
      chars.push(" ");
    } else {
      chars.push(c);
    }
    map.push(i);
  }
  while (chars[chars.length - 1] === " ") {
    chars.pop();
    map.pop();
  }
  map.push(map.length > 0 ? map[map.length - 1]! + 1 : 0);
  return { text: chars.join(""), map };
}

// ── Plan : ce qui se remplit, où ─────────────────────────────────────────────

export type SignatureSlot = "STRUCTURE" | "BENEFICIAIRE" | "ANNEXE_PERSONNE" | "CONFIANCE";
export type SignatureAnchor = { paragraph: number; slot: SignatureSlot };

export type DipecWordPlan = {
  prepared: PreparedDipc;
  // index de paragraphe → texte à champs `{{…}}` (vide : la zone disparaît)
  templates: ReadonlyMap<number, string>;
  // annexe 3.2, appliqués seulement si une personne de confiance est désignée
  trustedTemplates: ReadonlyMap<number, string>;
  anchors: readonly SignatureAnchor[];
  rhythmAfter: number | null;
  scheduleFieldId: string | null;
  // Titre « ANNEXE 1 – DEVIS » : le devis importé y est posé, page par page (30/10/2026).
  devisAfter: number | null;
  // Les lignes VIDES qui suivent ce titre (la place laissée pour agrafer le devis
  // papier) : retirées quand le devis est posé, sinon elles ajoutent une page blanche.
  // Une ligne qui porte un saut de page ou de section n'en fait jamais partie.
  devisBlankParagraphs: readonly number[];
};

const SIGNATURE_PLACEHOLDER = /voir « Signatures », en fin de document\.$/;

const TRUSTED_RULES: readonly { label: RegExp; template: (text: string) => string }[] = [
  { label: /^Je soussigné\(e\),/, template: () => "Je soussigné(e), {{personne.prenom}} {{personne.nom}}, né(e) le {{personne.date_naissance}} à {{personne.lieu_naissance}} :" },
  { label: /^Nom et prénom\s*:\s*$/, template: () => "Nom et prénom : {{confiance.nom}}" },
  { label: /^Né\s*\(e\) le\b/, template: () => "Né(e) le {{confiance.naissance}}" },
  { label: /^Qualité \(lien avec la personne\)\s*:\s*$/, template: (t) => `${t} {{confiance.qualite}}` },
  { label: /^Adresse\s*:\s*$/, template: (t) => `${t} {{confiance.adresse}}` },
  { label: /^Téléphone.*:\s*$/, template: (t) => `${t} {{confiance.telephone}}` },
  { label: /^E-mail\s*:\s*$/, template: (t) => `${t} {{confiance.email}}` },
  { label: /^Fait à\s*…?\s*,\s*le\s*…?$/, template: () => "Fait à {{personne.ville}}, le {{date.signature}}" },
];

function slotBefore(blocks: readonly DipcBlock[], k: number): SignatureSlot {
  for (let i = k - 1; i >= Math.max(0, k - 8); i -= 1) {
    if (/^Pour la structure/i.test(blocks[i]!.text)) return "STRUCTURE";
    if (/bénéficiaire ou son représentant/i.test(blocks[i]!.text)) return "BENEFICIAIRE";
  }
  return "BENEFICIAIRE";
}

export function planDipecWord(documentXml: string): DipecWordPlan {
  const paragraphs = readParagraphs(documentXml);
  const source: { paragraph: number; block: DipcBlock }[] = [];
  paragraphs.forEach((p, paragraph) => {
    if (TOC_STYLE.test(p.style)) return;
    const text = normalizeWithMap(p.raw).text;
    if (text) source.push({ paragraph, block: { kind: HEADING_STYLE.test(p.style) ? "heading" : "paragraph", text } });
  });
  const blocks = source.map((s) => s.block);
  const { lines, ...fields } = prepareDipcLines(blocks);

  const templates = new Map<number, string>();
  const anchors: SignatureAnchor[] = [];
  lines.forEach((line, k) => {
    const { paragraph, block } = source[k]!;
    if (line === null) templates.set(paragraph, "");
    else if (SIGNATURE_PLACEHOLDER.test(line.text)) anchors.push({ paragraph, slot: slotBefore(blocks, k) });
    else if (line.text !== block.text) templates.set(paragraph, line.text);
  });

  const trustedTemplates = new Map<number, string>();
  const annex = blocks.findIndex((b) => /^Annexe 3[.-]2$/i.test(b.text));
  if (annex >= 0) {
    for (let k = annex + 1; k < blocks.length && !/^(Partie facultative|Annexe 3[.-]3)/i.test(blocks[k]!.text); k += 1) {
      const { paragraph, block } = source[k]!;
      if (/^Signature\s*:\s*$/.test(block.text)) anchors.push({ paragraph, slot: "ANNEXE_PERSONNE" });
      else if (/^Cosignature de la personne de confiance\s*:\s*$/.test(block.text)) anchors.push({ paragraph, slot: "CONFIANCE" });
      else {
        const rule = TRUSTED_RULES.find((r) => r.label.test(block.text));
        if (rule) trustedTemplates.set(paragraph, rule.template(block.text));
      }
    }
  }

  const rhythm = source.find((s) => /^Les jours et horaires d.intervention sont définis/i.test(s.block.text));
  // Le TITRE de l'annexe (pas sa ligne de sommaire, déjà écartée, ni les renvois du corps).
  const devisAnnex = source.find((s) => s.block.kind === "heading" && /^annexe\s*1\b.*devis/i.test(s.block.text));
  const devisBlankParagraphs: number[] = [];
  if (devisAnnex) {
    for (let i = devisAnnex.paragraph + 1; i < paragraphs.length; i += 1) {
      const q = paragraphs[i]!;
      if (normalizeWithMap(q.raw).text || /<w:br\b[^>]*w:type="page"|<w:sectPr\b|<w:drawing\b|<w:pict\b/.test(q.xml)) break;
      devisBlankParagraphs.push(i);
    }
  }
  return {
    prepared: { blocks: lines.filter((b): b is DipcBlock => b !== null), ...fields },
    templates,
    trustedTemplates,
    anchors,
    rhythmAfter: rhythm?.paragraph ?? null,
    scheduleFieldId: fields.freeFields.find((f) => /^Fréquence, jours et horaires/i.test(f.label))?.id ?? null,
    devisAfter: devisAnnex?.paragraph ?? null,
    devisBlankParagraphs,
  };
}

// Article 3.4 : le rythme convenu, écrit avec les mots de la tablette.
export function rhythmText(aid: AdmissionAid, schedule: string): string {
  const hours = [
    aid.weekdayHours.trim() ? `${aid.weekdayHours.trim()} h par mois en semaine` : "",
    aid.sundayHours.trim() ? `${aid.sundayHours.trim()} h par mois le dimanche` : "",
  ].filter(Boolean);
  const aidPart = [aid.kinds.map((k) => AID_KIND_LABELS[k]).join(", "), hours.join(", "), aid.startDate ? `à partir du ${frenchDay(aid.startDate)}` : ""]
    .filter(Boolean)
    .join(" — ");
  const parts = [aidPart, cleanName(schedule) ? `Jours et horaires : ${cleanName(schedule)}` : ""].filter(Boolean);
  return parts.length > 0 ? `Rythme convenu avec le bénéficiaire : ${parts.join(". ")}.` : "";
}

// ── Écriture ─────────────────────────────────────────────────────────────────

// Remplace, dans le paragraphe, le seul passage qui change (préfixe et suffixe
// communs gardés) : les runs hors de ce passage ne sont pas touchés.
export function rewriteParagraph(p: WordParagraph, next: string): string {
  if (p.nodes.length === 0) return p.xml;
  const { text: current, map } = normalizeWithMap(p.raw);
  if (current === next) return p.xml;
  let a = 0;
  while (a < current.length && a < next.length && current[a] === next[a]) a += 1;
  let b = 0;
  while (b < current.length - a && b < next.length - a && current[current.length - 1 - b] === next[next.length - 1 - b]) b += 1;
  // Juste après le préfixe commun : les espaces resserrés qui suivent (« : ␣␣…… »)
  // partent avec la zone, sinon on lirait « Nom, Prénom :  Madame ».
  const rawStart = a > 0 ? map[a - 1]! + 1 : map[0]!;
  const rawEnd = map[current.length - b]!;
  const insert = next.slice(a, next.length - b);

  // Le nouveau texte prend la mise en forme du run où commence le passage remplacé
  // (le run du libellé « Nom, Prénom : » quand on écrit juste après lui).
  const starts: number[] = [];
  p.nodes.reduce((offset, node) => (starts.push(offset), offset + node.text.length), 0);
  const located = p.nodes.findIndex((node, i) => rawStart >= starts[i]! && rawStart < starts[i]! + node.text.length);
  const host = located >= 0 ? located : p.nodes.length - 1;

  const replaced = p.nodes.map((node, i) => {
    const from = starts[i]!;
    const to = from + node.text.length;
    if (i !== host && !(to > rawStart && from < rawEnd)) return null;
    const keepBefore = node.text.slice(0, Math.max(0, Math.min(node.text.length, rawStart - from)));
    const keepAfter = node.text.slice(Math.max(0, Math.min(node.text.length, rawEnd - from)));
    return i === host ? `${keepBefore}${insert}${keepAfter}` : `${keepBefore}${keepAfter}`;
  });

  let xml = p.xml;
  for (let i = p.nodes.length - 1; i >= 0; i -= 1) {
    const text = replaced[i];
    if (text === null || text === undefined) continue;
    const node = p.nodes[i]!;
    const tagStart = node.start - node.openTag.length;
    const open = /xml:space=/.test(node.openTag) ? node.openTag : node.openTag.replace(/^<w:t/, '<w:t xml:space="preserve"');
    xml = `${xml.slice(0, tagStart)}${open}${escapeXml(text)}${xml.slice(node.end)}`;
  }
  return xml;
}

function paragraphProperties(p: WordParagraph): string {
  return (/<w:pPr>[\s\S]*?<\/w:pPr>/.exec(p.xml)?.[0] ?? "").replace(/<w:numPr>[\s\S]*?<\/w:numPr>/, "");
}

function firstRunProperties(p: WordParagraph): string {
  const afterPPr = p.xml.replace(/<w:pPr>[\s\S]*?<\/w:pPr>/, "");
  return /<w:r(?:\s[^>]*)?>\s*(<w:rPr>[\s\S]*?<\/w:rPr>)/.exec(afterPPr)?.[1] ?? "";
}

export function textParagraphLike(p: WordParagraph, text: string): string {
  return `<w:p>${paragraphProperties(p)}<w:r>${firstRunProperties(p)}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

export function pngSize(png: Uint8Array): { width: number; height: number } | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.length < 24 || signature.some((byte, i) => png[i] !== byte)) return null;
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { width: dv.getUint32(16), height: dv.getUint32(20) };
}

const EMU_PER_CM = 360000;
const SIGNATURE_MAX = { width: 4.5 * EMU_PER_CM, height: 1.6 * EMU_PER_CM };
// Une page de devis tient dans la zone de texte d'une page A4 (marges comprises).
const DEVIS_PAGE_MAX = { width: 16 * EMU_PER_CM, height: 22.5 * EMU_PER_CM };

export function imageParagraph(p: WordParagraph, relId: string, docPrId: number, png: Uint8Array, max = SIGNATURE_MAX): string {
  const size = pngSize(png) ?? { width: 600, height: 200 };
  const scale = Math.min(max.width / size.width, max.height / size.height);
  const cx = Math.round(size.width * scale);
  const cy = Math.round(size.height * scale);
  return (
    `<w:p>${paragraphProperties(p)}<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${docPrId}" name="Signature ${docPrId}"/>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${docPrId}" name="signature-${docPrId}.png"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
    `</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`
  );
}

export type WordSignature = { caption: string; png: Uint8Array };
export type WordImage = { relId: string; target: string; data: Uint8Array };

// Qui signe où, dans le Word : la structure dans sa cellule, la personne (et son
// représentant) dans la sienne, « Lu et approuvé » écrit au-dessus — la mention que
// le contrat demande. Annexe 3.2 : sous tutelle, le tuteur désigne pour la personne.
export function wordSignatureSlots(input: {
  images: Partial<Record<AdmissionSigner, Uint8Array>>;
  identity: AdmissionIdentity;
  contact: AdmissionContact | null;
  staffName: string;
  trusted: TrustedPerson | null;
}): Partial<Record<SignatureSlot, WordSignature[]>> {
  const name = (signer: AdmissionSigner) => signerName(signer, input.identity, input.contact, input.staffName, input.trusted);
  const one = (signer: AdmissionSigner, caption: string): WordSignature[] => {
    const png = input.images[signer];
    return png ? [{ caption, png }] : [];
  };
  const representative = contactLink(input.contact) || SIGNER_LABELS.REPRESENTANT;
  const annexSigner: AdmissionSigner = input.contact?.kind === "TUTEUR" ? "REPRESENTANT" : "PERSONNE";
  return {
    STRUCTURE: one("SERVICE", `${SIGNER_LABELS.SERVICE} — ${name("SERVICE")}`),
    BENEFICIAIRE: [
      ...one("PERSONNE", `${SIGNER_LABELS.PERSONNE} — ${name("PERSONNE")} — Lu et approuvé`),
      ...one("REPRESENTANT", `${representative} — ${name("REPRESENTANT")} — Lu et approuvé`),
    ],
    ANNEXE_PERSONNE: one(annexSigner, name(annexSigner)),
    CONFIANCE: one("CONFIANCE", name("CONFIANCE")),
  };
}

export type DipecWordFill = {
  documentXml: string;
  plan: DipecWordPlan;
  values: Record<AdmissionField, string>;
  entries: Readonly<Record<string, string>>;
  trustedDesignated: boolean;
  rhythm: string;
  signatures: Partial<Record<SignatureSlot, readonly WordSignature[]>>;
  // Le devis importé avant le contrat, en images PNG (une par page) : posé sous le
  // titre de l'annexe 1 (30/10/2026). Absent : l'annexe reste telle qu'EODA l'a écrite.
  devis?: { caption: string; pages: readonly Uint8Array[] } | null;
};

export type FilledDipecWord = { documentXml: string; images: WordImage[]; unknownFields: string[]; emptyFields: string[] };

export function fillDipecWord(input: DipecWordFill): FilledDipecWord {
  const paragraphs = readParagraphs(input.documentXml);
  const unknown = new Set<string>();
  const empty = new Set<string>();
  const merge = (template: string) => {
    const result = mergeDipcText(template, input.values, input.entries);
    result.unknownFields.forEach((f) => unknown.add(f));
    result.emptyFields.forEach((f) => empty.add(f));
    return result.text;
  };

  const rewritten = new Map<number, string>();
  const after = new Map<number, string[]>();
  const append = (paragraph: number, xml: string) => after.set(paragraph, [...(after.get(paragraph) ?? []), xml]);

  input.plan.templates.forEach((template, paragraph) => {
    const xml = rewriteParagraph(paragraphs[paragraph]!, template ? merge(template) : "");
    // Les options de durée et les modes de paiement sont, dans le Word d'EODA, une
    // liste à puces : la case ☒ / ☐ écrite devant remplace la puce, sinon on en lirait
    // deux.
    const choiceLine = template.startsWith("{{duree.option") || template.startsWith(`{{${PAYMENT_FIELD_PREFIX}`);
    rewritten.set(paragraph, choiceLine ? xml.replace(/<w:numPr>[\s\S]*?<\/w:numPr>/, "") : xml);
  });
  if (input.trustedDesignated) {
    input.plan.trustedTemplates.forEach((template, paragraph) => rewritten.set(paragraph, rewriteParagraph(paragraphs[paragraph]!, merge(template))));
  }
  if (input.rhythm && input.plan.rhythmAfter !== null) append(input.plan.rhythmAfter, textParagraphLike(paragraphs[input.plan.rhythmAfter]!, input.rhythm));

  const images: WordImage[] = [];
  let docPrId = Math.max(1000, ...[...input.documentXml.matchAll(/<(?:wp:docPr|pic:cNvPr) id="(\d+)"/g)].map((m) => Number(m[1]))) + 1;
  for (const anchor of input.plan.anchors) {
    const isAnnex = anchor.slot === "ANNEXE_PERSONNE" || anchor.slot === "CONFIANCE";
    if (isAnnex && !input.trustedDesignated) continue;
    const p = paragraphs[anchor.paragraph]!;
    for (const signature of input.signatures[anchor.slot] ?? []) {
      const n = images.length + 1;
      const relId = `rIdEodaSignature${n}`;
      images.push({ relId, target: `media/eoda-signature-${n}.png`, data: signature.png });
      append(anchor.paragraph, textParagraphLike(p, signature.caption));
      append(anchor.paragraph, imageParagraph(p, relId, docPrId, signature.png));
      docPrId += 1;
    }
  }

  if (input.devis && input.devis.pages.length > 0 && input.plan.devisAfter !== null) {
    const p = paragraphs[input.plan.devisAfter]!;
    // Le titre de l'annexe a son style de titre : la légende et les pages prennent
    // celui du paragraphe ordinaire qui le suit, s'il existe.
    const body = paragraphs[input.plan.devisAfter + 1] ?? p;
    append(input.plan.devisAfter, textParagraphLike(body, input.devis.caption));
    input.devis.pages.forEach((page, index) => {
      const relId = `rIdEodaDevis${index + 1}`;
      images.push({ relId, target: `media/eoda-devis-${index + 1}.png`, data: page });
      append(input.plan.devisAfter!, imageParagraph(body, relId, docPrId, page, DEVIS_PAGE_MAX));
      docPrId += 1;
    });
    // Les lignes vides poussaient l'annexe suivante sur une nouvelle page : un saut de
    // page explicite les remplace, l'annexe 2 garde sa page.
    for (const blank of input.plan.devisBlankParagraphs) rewritten.set(blank, "");
    if (input.plan.devisBlankParagraphs.length > 0) append(input.plan.devisAfter, '<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
  }

  let xml = input.documentXml;
  const touched = [...new Set([...rewritten.keys(), ...after.keys()])].sort((x, y) => y - x);
  for (const index of touched) {
    const p = paragraphs[index]!;
    xml = `${xml.slice(0, p.start)}${rewritten.get(index) ?? p.xml}${(after.get(index) ?? []).join("")}${xml.slice(p.end)}`;
  }
  return { documentXml: xml, images, unknownFields: [...unknown], emptyFields: [...empty] };
}

// ── Archive ──────────────────────────────────────────────────────────────────

const DOCUMENT = "word/document.xml";
const RELS = "word/_rels/document.xml.rels";
const CONTENT_TYPES = "[Content_Types].xml";
const IMAGE_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";

export class NotAWordDocumentError extends Error {
  constructor() {
    super("Ce fichier n'est pas un document Word (.docx).");
    this.name = "NotAWordDocumentError";
  }
}

export type DocxPackage = { entries: ZipEntry[]; documentXml: string };

export async function openDocx(bytes: Uint8Array, inflateRaw: InflateRaw): Promise<DocxPackage> {
  const entries = await readZip(bytes, inflateRaw);
  const document = entries.find((e) => e.name === DOCUMENT);
  if (!document || !entries.some((e) => e.name === CONTENT_TYPES)) throw new NotAWordDocumentError();
  return { entries, documentXml: new TextDecoder().decode(document.data) };
}

export function addImageRelationships(relsXml: string, images: readonly WordImage[]): string {
  const rels = images.map((img) => `<Relationship Id="${img.relId}" Type="${IMAGE_REL}" Target="${img.target}"/>`).join("");
  return relsXml.replace("</Relationships>", `${rels}</Relationships>`);
}

export function ensurePngContentType(contentTypesXml: string): string {
  if (/<Default\s[^>]*Extension="png"/i.test(contentTypesXml)) return contentTypesXml;
  return contentTypesXml.replace(/(<Types\b[^>]*>)/, '$1<Default Extension="png" ContentType="image/png"/>');
}

export function buildFilledDocx(pkg: DocxPackage, filled: FilledDipecWord, modifiedAt: Date): Uint8Array {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const files = pkg.entries.map((entry) => {
    let data = entry.data;
    if (entry.name === DOCUMENT) data = encoder.encode(filled.documentXml);
    else if (filled.images.length > 0 && entry.name === RELS) data = encoder.encode(addImageRelationships(decoder.decode(entry.data), filled.images));
    else if (filled.images.length > 0 && entry.name === CONTENT_TYPES) data = encoder.encode(ensurePngContentType(decoder.decode(entry.data)));
    return { name: entry.name, data, modifiedAt };
  });
  const media = filled.images.map((img) => ({ name: `word/${img.target}`, data: img.data, modifiedAt }));
  return buildStoredZip([...files, ...media]);
}
