import { mergeDipcText, type AdmissionField } from "./admission-service";
import {
  escapeXml,
  imageParagraph,
  normalizeWithMap,
  readParagraphs,
  rewriteParagraph,
  textParagraphLike,
  unescapeXml,
  type WordImage,
  type WordParagraph,
  type WordSignature,
} from "./dipec-word-service";
import { cleanName } from "./survey-roster-service";

// ─────────────────────────────────────────────────────────────────────────────
// LE CONTRAT RÉCAPITULATIF POUR LE DÉPARTEMENT, REMPLI ET SIGNÉ SUR LA TABLETTE —
// service PUR (demande de Damon, 30/10/2026 : « le contrat récap de 4 pages à envoyer
// au Département avec l'attestation »).
//
// Le Département exige que le formulaire de désignation parte « accompagné d'une
// copie du contrat de prestation ». La structure lui envoie un contrat COURT (quatre
// pages), le sien, déposé par EODA sur la ligne `DEPARTEMENT_CONTRAT_RECAPITULATIF` :
// ce module le remplit avec la fiche saisie une fois sur la tablette, sans rien
// réécrire d'autre que les zones (même moteur que le DIPEC : `rewriteParagraph`
// change le seul passage qui diffère, dans le run qui le porte).
//
// Zones reconnues par leur LIBELLÉ, comme le DIPEC : le bénéficiaire (ligne de
// pointillés sous « Et »), « Demeurant … », la durée (cases Wingdings devant « Pour une
// durée… »), le tableau des tarifs, « M…, ou son représentant légal… personne de son
// choix M… », « Fait à …, le … », et les signatures, posées sous « Signature du
// Bénéficiaire » dans un tableau à deux colonnes (la personne à gauche, la structure à
// droite), à la place des lignes laissées vides pour signer à la main.
// Rien ne quitte le navigateur (verrou HDS) : ce module ne fait que transformer des octets.
// ─────────────────────────────────────────────────────────────────────────────

export type RecapContractPlan = {
  beneficiary: number | null;
  address: number | null;
  addressContinuation: readonly number[];
  durationIndefinite: number | null;
  durationFixed: number | null;
  // Première ligne de chaque cellule de la rangée sous l'en-tête « Tarif Horaire Semaine »
  // (tarif semaine, heures semaine, tarif dimanche, heures dimanche, total).
  tariffCells: readonly number[];
  declaration: number | null;
  madeAt: number | null;
  signatureHeading: number | null;
  signatureBlanks: readonly number[];
  // Le style du texte courant (celui de « Et ») et celui des cellules du tableau des
  // tarifs (l'en-tête, sans le gras) : les pointillés sont écrits plus petits que le
  // texte, et les cellules vides du tableau ont chacune le leur — ce qu'on écrit prend
  // le style du libellé, pas celui de la zone vide.
  bodyRunProperties: string;
  tariffRunProperties: string;
};

const DOTS = /…[….\s]*/g;
// « M…… » : le « M » (Madame / Monsieur) part avec les pointillés quand on écrit le nom.
const NAMED_DOTS = /M\s*…[….\s]*/g;
const ONLY_DOTS = /^[….\s]+$/;
const BOX = /<w:sym w:font="Wingdings" w:char="F0(?:6F|6[Ff]|72|A8)"\/>/;
const CHECKED_BOX = '<w:sym w:font="Wingdings" w:char="F078"/>';

const RUN = /<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g;
const RUN_PROPERTIES = /<w:rPr>[\s\S]*?<\/w:rPr>/;

function runText(run: string): string {
  return [...run.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => unescapeXml(m[1]!)).join("");
}

// Le style du premier run qui porte du TEXTE (pas des pointillés) ; null s'il n'y en a pas.
function labelRunProperties(xml: string): string | null {
  const body = xml.replace(/<w:pPr>[\s\S]*?<\/w:pPr>/, "");
  for (const m of body.matchAll(RUN)) {
    const text = runText(m[0]).trim();
    if (text && !ONLY_DOTS.test(text)) return RUN_PROPERTIES.exec(m[0])?.[0] ?? "";
  }
  return null;
}

// Les runs de pointillés prennent le style du libellé : la valeur écrite à leur place
// a la taille du texte, pas celle des pointillés.
function restyleDots(xml: string, rPr: string): string {
  return xml.replace(RUN, (run) => {
    const text = runText(run);
    if (!text.trim() || !ONLY_DOTS.test(text)) return run;
    return run.replace(RUN_PROPERTIES, "").replace(/^(<w:r(?:\s[^>]*)?>)/, `$1${rPr}`);
  });
}

function isBlank(p: WordParagraph): boolean {
  return !normalizeWithMap(p.raw).text && !/<w:drawing\b|<w:pict\b|<w:sectPr\b|<w:br\b[^>]*w:type="page"/.test(p.xml);
}

function tariffRow(xml: string, paragraphs: readonly WordParagraph[], header: number): number[] {
  const headerEnd = xml.indexOf("</w:tr>", paragraphs[header]!.start);
  const rowStart = xml.indexOf("<w:tr", headerEnd);
  const rowEnd = rowStart >= 0 ? xml.indexOf("</w:tr>", rowStart) : -1;
  if (headerEnd < 0 || rowStart < 0 || rowEnd < 0) return [];
  const cells: number[] = [];
  for (const m of xml.slice(rowStart, rowEnd).matchAll(/<w:tc>/g)) {
    const at = rowStart + m.index;
    const first = paragraphs.findIndex((p) => p.start > at);
    if (first >= 0 && paragraphs[first]!.start < rowEnd) cells.push(first);
  }
  return cells;
}

export function planRecapContract(documentXml: string): RecapContractPlan {
  const paragraphs = readParagraphs(documentXml);
  const text = (i: number) => normalizeWithMap(paragraphs[i]?.raw ?? "").text;
  const find = (test: RegExp, from = 0) => {
    for (let i = from; i < paragraphs.length; i += 1) if (test.test(text(i))) return i;
    return null;
  };

  // Le bénéficiaire : la première ligne de pointillés après « Et » seul.
  const and = find(/^Et$/);
  let beneficiary: number | null = null;
  if (and !== null) {
    for (let i = and + 1; i < paragraphs.length && beneficiary === null; i += 1) {
      if (!text(i)) continue;
      if (ONLY_DOTS.test(text(i))) beneficiary = i;
      else break;
    }
  }

  const address = find(/^Demeurant\s*…[….\s]*$/);
  const addressContinuation: number[] = [];
  if (address !== null) {
    for (let i = address + 1; i < paragraphs.length; i += 1) {
      if (!text(i)) continue;
      if (!ONLY_DOTS.test(text(i))) break;
      addressContinuation.push(i);
    }
  }

  const boxed = (test: RegExp) => {
    const i = find(test);
    return i !== null && BOX.test(paragraphs[i]!.xml) ? i : null;
  };
  const header = find(/^Tarif Horaire Semaine$/i);
  const signatureHeading = find(/^Signature du Bénéficiaire/i);
  const signatureBlanks: number[] = [];
  if (signatureHeading !== null) {
    let i = signatureHeading + 1;
    while (i < paragraphs.length && /^Ou /i.test(text(i))) i += 1;
    for (; i < paragraphs.length && isBlank(paragraphs[i]!); i += 1) signatureBlanks.push(i);
  }

  const body = (and !== null ? labelRunProperties(paragraphs[and]!.xml) : null) ?? (address !== null ? labelRunProperties(paragraphs[address]!.xml) : null) ?? "";
  const tariffHeader = header === null ? "" : (labelRunProperties(paragraphs[header]!.xml) ?? "");
  return {
    bodyRunProperties: body,
    tariffRunProperties: tariffHeader.replace(/<w:bCs?\/>/g, "").replace(/<w:bCs? w:val="(?:1|true|on)"\/>/g, ""),
    beneficiary,
    address,
    addressContinuation,
    durationIndefinite: boxed(/^Pour une durée (?:d.une année|indéterminée)/i),
    durationFixed: boxed(/^Pour une durée déterminée du\b/i),
    tariffCells: header === null ? [] : tariffRow(documentXml, paragraphs, header),
    declaration: find(/^M\s*…[….\s]*, ou son représentant légal/),
    madeAt: find(/^Fait à\s*…[….\s]*, le\s*…[….\s]*$/),
    signatureHeading,
    signatureBlanks,
  };
}

// Ce qui manque au Word pour être rempli (dit à l'écran, jamais bloquant).
export function recapContractGaps(plan: RecapContractPlan): string[] {
  return [
    ...(plan.beneficiary === null ? ["le nom du bénéficiaire"] : []),
    ...(plan.address === null ? ["l'adresse"] : []),
    ...(plan.signatureHeading === null || plan.signatureBlanks.length === 0 ? ["la place des signatures"] : []),
  ];
}

// ── Les tarifs ───────────────────────────────────────────────────────────────

export type RecapTariffs = { weekdayRate: string; sundayRate: string };

function amount(value: string): number | null {
  const n = Number(value.trim().replace(/\s/g, "").replace(",", "."));
  return value.trim() && Number.isFinite(n) && n >= 0 ? n : null;
}

function euros(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

// Les cinq cellules : tarif et heures de la semaine, puis du dimanche, puis le total
// mensuel — calculé seulement si chaque tarif utile est connu.
export function tariffCellTexts(tariffs: RecapTariffs, weekdayHours: string, sundayHours: string): string[] {
  const weekdayRate = amount(tariffs.weekdayRate);
  const sundayRate = amount(tariffs.sundayRate);
  // Une part sans heures vaut 0 ; des heures sans tarif rendent le total inconnu.
  const part = (rate: number | null, hours: number | null) => (hours ? (rate === null ? null : rate * hours) : 0);
  const weekday = part(weekdayRate, amount(weekdayHours));
  const sunday = part(sundayRate, amount(sundayHours));
  const total = weekday !== null && sunday !== null && weekday + sunday > 0 ? euros(weekday + sunday) : "";
  const hoursText = (v: string) => (amount(v) ? `${cleanName(v)} h` : "");
  return [weekdayRate === null ? "" : euros(weekdayRate), hoursText(weekdayHours), sundayRate === null ? "" : euros(sundayRate), hoursText(sundayHours), total];
}

// ── Remplissage ──────────────────────────────────────────────────────────────

export type RecapContractFill = {
  documentXml: string;
  plan: RecapContractPlan;
  values: Record<AdmissionField, string>;
  // « peut être accompagné de la personne de son choix M… » : la personne de
  // confiance, sinon le proche ; vide : la ligne reste à compléter à la main.
  companion: string;
  // La durée choisie sur la tablette (null : le DIPEC n'en proposait pas).
  duration: { fixed: boolean; start: string; end: string } | null;
  tariffs: RecapTariffs;
  signatures: { beneficiary: readonly WordSignature[]; structure: readonly WordSignature[] };
};

export type FilledRecapContract = { documentXml: string; images: WordImage[] };

function fillDots(raw: string, values: readonly string[], zone: RegExp = DOTS): string {
  let k = 0;
  return raw.replace(zone, (dots) => {
    const value = values[k++];
    if (!value) return dots;
    // Les pointillés emportent l'espace qui les suit : on le rend.
    return /\s$/.test(dots) ? `${value} ` : value;
  });
}

// Le style de la marque de paragraphe : ce qu'un paragraphe VIDE aurait écrit.
function markRunProperties(p: WordParagraph): string {
  const mark = /<w:pPr>[\s\S]*?(<w:rPr>[\s\S]*?<\/w:rPr>)[\s\S]*?<\/w:pPr>/.exec(p.xml)?.[1] ?? "";
  return mark;
}

function textInEmpty(p: WordParagraph, value: string, rPr: string): string {
  if (!value) return p.xml;
  const run = `<w:r>${rPr || markRunProperties(p)}<w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r>`;
  return p.xml.replace(/<\/w:p>$/, `${run}</w:p>`);
}

const CELL_WIDTH = 4500; // twips : la tabulation du libellé « Signature du représentant… »
const NO_BORDERS = ["top", "left", "bottom", "right", "insideH", "insideV"].map((side) => `<w:${side} w:val="nil"/>`).join("");

function signatureTable(left: string[], right: string[]): string {
  const cell = (content: string[]) => `<w:tc><w:tcPr><w:tcW w:w="${CELL_WIDTH}" w:type="dxa"/></w:tcPr>${content.length > 0 ? content.join("") : "<w:p/>"}</w:tc>`;
  return (
    `<w:tbl><w:tblPr><w:tblW w:w="${CELL_WIDTH * 2}" w:type="dxa"/><w:tblBorders>${NO_BORDERS}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr>` +
    `<w:tblGrid><w:gridCol w:w="${CELL_WIDTH}"/><w:gridCol w:w="${CELL_WIDTH}"/></w:tblGrid><w:tr>${cell(left)}${cell(right)}</w:tr></w:tbl>`
  );
}

// Lignes vides retirées en échange du tableau des signatures : il tient la place de
// quatre lignes (légende + image de 1,6 cm), le contrat garde ses quatre pages.
const BLANKS_PER_SIGNATURE_ROW = 4;

export function fillRecapContract(input: RecapContractFill): FilledRecapContract {
  const paragraphs = readParagraphs(input.documentXml);
  const plan = input.plan;
  const v = (template: string) => mergeDipcText(template, input.values, {}).text.replace(/\s+/g, " ").trim();
  const person = v("{{personne.civilite}} {{personne.prenom}} {{personne.nom}}");
  const rewritten = new Map<number, string>();
  const rewriteDots = (index: number | null, values: readonly string[], zone?: RegExp) => {
    if (index === null) return;
    const source = paragraphs[index]!;
    const next = fillDots(normalizeWithMap(source.raw).text, values, zone);
    const restyled = readParagraphs(restyleDots(rewritten.get(index) ?? source.xml, labelRunProperties(source.xml) ?? plan.bodyRunProperties))[0]!;
    rewritten.set(index, rewriteParagraph(restyled, next.trim()));
  };

  rewriteDots(plan.beneficiary, [person]);
  rewriteDots(plan.address, [v("{{personne.adresse}}, {{personne.code_postal}} {{personne.ville}}").replace(/^,\s*|,\s*$/g, "")]);
  for (const i of plan.addressContinuation) rewritten.set(i, rewriteParagraph(paragraphs[i]!, ""));
  rewriteDots(plan.declaration, [person, cleanName(input.companion)], NAMED_DOTS);
  rewriteDots(plan.madeAt, [v("{{personne.ville}}"), v("{{date.signature}}")]);

  if (input.duration) {
    const chosen = input.duration.fixed ? plan.durationFixed : plan.durationIndefinite;
    if (input.duration.fixed) rewriteDots(plan.durationFixed, [input.duration.start, input.duration.end]);
    if (chosen !== null) rewritten.set(chosen, (rewritten.get(chosen) ?? paragraphs[chosen]!.xml).replace(BOX, CHECKED_BOX));
  }

  if (plan.tariffCells.length === 5) {
    tariffCellTexts(input.tariffs, input.values["aide.heures_semaine"], input.values["aide.heures_dimanche"]).forEach((value, k) => {
      const index = plan.tariffCells[k]!;
      rewritten.set(index, textInEmpty(paragraphs[index]!, value, plan.tariffRunProperties));
    });
  }

  const images: WordImage[] = [];
  const signatures = [...input.signatures.beneficiary, ...input.signatures.structure];
  if (plan.signatureHeading !== null && plan.signatureBlanks.length > 0 && signatures.length > 0) {
    const heading = paragraphs[plan.signatureHeading]!;
    let docPrId = Math.max(1000, ...[...input.documentXml.matchAll(/<(?:wp:docPr|pic:cNvPr) id="(\d+)"/g)].map((m) => Number(m[1]))) + 1;
    const column = (list: readonly WordSignature[]) =>
      list.flatMap((signature) => {
        const n = images.length + 1;
        const relId = `rIdEodaRecap${n}`;
        images.push({ relId, target: `media/eoda-recap-${n}.png`, data: signature.png });
        const xml = [textParagraphLike(heading, signature.caption), imageParagraph(heading, relId, docPrId, signature.png)];
        docPrId += 1;
        return xml;
      });
    const table = signatureTable(column(input.signatures.beneficiary), column(input.signatures.structure));
    const [first, ...rest] = plan.signatureBlanks;
    rewritten.set(first!, `${table}${paragraphs[first!]!.xml}`);
    const rows = Math.max(input.signatures.beneficiary.length, input.signatures.structure.length);
    for (const i of rest.slice(0, rows * BLANKS_PER_SIGNATURE_ROW)) rewritten.set(i, "");
  }

  let xml = input.documentXml;
  for (const index of [...rewritten.keys()].sort((a, b) => b - a)) {
    const p = paragraphs[index]!;
    xml = `${xml.slice(0, p.start)}${rewritten.get(index)}${xml.slice(p.end)}`;
  }
  return { documentXml: xml, images };
}

// Qui accompagne la personne à la signature : sa personne de confiance, sinon son proche.
export function recapCompanion(trustedName: string, contactName: string): string {
  return cleanName(trustedName) || cleanName(contactName);
}
