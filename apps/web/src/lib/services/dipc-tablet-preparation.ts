// ─────────────────────────────────────────────────────────────────────────────
// COPIE DU DIPC POUR LA TABLETTE — service PUR (demande de Damon, 27/10/2026 :
// « une copie spéciale du DIPC, avec les champs {{}}, pour les contrats signés sur
// la tablette »).
//
// La copie n'est pas rangée : elle se DÉRIVE, à l'affichage, du DIPC que la
// consultante a validé. Une copie stockée serait périmée dès la version suivante ;
// celle-ci suit toujours le texte validé, et ne le change qu'aux zones à remplir.
//
// Ce que fait la préparation, et rien d'autre :
//   1. nettoie le Markdown du texte extrait du Word (gras, échappements, liens du
//      sommaire, images, renvois de notes) — sans quoi le contrat signé serait
//      truffé de « ** » et de « \[ » ;
//   2. pose les champs d'identité sur les zones repérées PAR LEUR LIBELLÉ, dans le
//      corps du contrat seulement (« Nom, Prénom : ……… », « Domicile », dates,
//      « Fait à ___, le ___ »…) ;
//   3. fait de chaque « [à compléter] » une zone de texte saisie sur la tablette, et
//      de chaque « ☐ » une case à cocher ;
//   4. ne touche JAMAIS aux annexes (à partir du premier titre « ANNEXE ») : le
//      formulaire de rétractation et la désignation de la personne de confiance
//      sont remplis par la personne, plus tard, si elle le décide.
// Une zone que la préparation ne reconnaît pas reste telle quelle : à compléter à
// la main, jamais devinée.
// ─────────────────────────────────────────────────────────────────────────────

export type DipcBlock = { kind: "heading" | "paragraph" | "bullet"; text: string };
export type DipcFreeField = { id: string; label: string; hint: string };
export type DipcCheckField = { id: string; label: string };

// « Option n°1 – … durée indéterminée » / « Option n°2 – … du JJ/MM/AAAA au JJ/MM/AAAA »
// (article « Durée du DIPC ») : un CHOIX sur la tablette, plus une ligne à rayer.
export type DipcDurationOption = { number: number; label: string; hasDates: boolean };
export type DipcDurationChoice = { options: DipcDurationOption[] };

export type PreparedDipc = {
  blocks: DipcBlock[];
  freeFields: DipcFreeField[];
  checkFields: DipcCheckField[];
  durationChoice: DipcDurationChoice | null;
  // Nombre de zones d'identité ou de date remplacées par un champ : l'écran le dit.
  identityZones: number;
};

// Pointillés, tirets bas (échappés ou non), « ../../.... » : une zone à remplir.
const BLANK = String.raw`(?:(?:\\?_){3,}|\.{3,}|…{2,}|[./]{6,})(?:[\s/]*(?:(?:\\?_){2,}|\.{2,}|…+))*`;
const BLANK_RE = new RegExp(BLANK, "g");
const ONLY_BLANK_RE = new RegExp(`^\\s*${BLANK}\\s*\\.?\\s*$`);

// ── 1. Markdown → texte ──────────────────────────────────────────────────────

export function cleanMarkdownText(line: string): string {
  return line
    .replace(/​/g, "") // espace de largeur nulle
    .replace(/\s*\[↑\]\(#footnote-ref-\d+\)/g, "") // retour d'une note vers son appel
    .replace(/\[\\\[(\d+)\\\]\]\(#[^)]*\)/g, "[$1]") // renvoi de note [\[1\]](#footnote-1)
    .replace(/!?\[([^\]]*)\]\((?:#|https?:|mailto:)[^)]*\)/g, "$1") // liens et images
    .replace(/\\([[\]_*()#.+\-!>`|~])/g, "$1") // échappements Markdown
    .replace(/_\[/g, "[") // italique collé aux crochets : « _[Nom, prénom_] »
    .replace(/_\]/g, "]")
    .replace(/\]_/g, "]")
    .replace(/([.;,:])_(?=\s|$)/g, "$1") // fin d'italique après la ponctuation : « objet]._ »
    .replace(/_ _/g, " ") // deux italiques accolés : « 7°_ _du »
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .replace(/(^|[\s(«])_([^_]+)_(?=[\s.,;:)»]|$)/g, "$1$2")
    .replace(/\*\*/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function toBlock(raw: string): DipcBlock | null {
  const line = raw.trim();
  if (!line) return null;
  if (/^\**\[Image \d+\]\**$/.test(line)) return null; // repère d'image
  if (/^\[[^\]]+\]\(#_Toc[^)]*\)$/.test(line)) return null; // ligne du sommaire
  const heading = /^#{1,6}\s+(.*)$/.exec(line);
  if (heading) return { kind: "heading", text: cleanMarkdownText(heading[1]!) };
  const bullet = /^(?:\*\s+)+(.*)$/.exec(line);
  if (bullet) return { kind: "bullet", text: cleanMarkdownText(bullet[1]!) };
  const text = cleanMarkdownText(line);
  return text ? { kind: "paragraph", text } : null;
}

// ── 2. Zones d'identité, repérées par leur libellé ───────────────────────────

type Rule = { label: RegExp; replace: (match: RegExpExecArray) => string };

// Ordre : la première règle qui reconnaît la ligne s'applique. Chaque règle exige
// une zone à remplir (pointillés, crochets ou deux-points sans rien derrière) : un
// libellé déjà rempli n'est jamais réécrit.
const RULES: readonly Rule[] = [
  { label: new RegExp(`^(Nom,? (?:et )?[Pp]rénom\\s*:)\\s*${BLANK}\\s*$`), replace: (m) => `${m[1]} {{personne.civilite}} {{personne.prenom}} {{personne.nom}}` },
  { label: new RegExp(`^((?:Domicile|Adresse)\\s*:)\\s*${BLANK}\\s*$`), replace: (m) => `${m[1]} {{personne.adresse}}, {{personne.code_postal}} {{personne.ville}}` },
  { label: new RegExp(`^(Téléphone\\s*:)\\s*${BLANK}\\s*$`), replace: (m) => `${m[1]} {{personne.telephone}}` },
  { label: new RegExp(`^((?:Né\\(e\\)|Née?) le\\s*:?)\\s*${BLANK}\\s*$`), replace: (m) => `${m[1]} {{personne.date_naissance}}` },
  { label: /^(–\s*Personne accompagnée\s*:)\s*\[Nom et prénom\]\s*(;?)$/, replace: (m) => `${m[1]} {{personne.prenom}} {{personne.nom}}${m[2] ? ` ${m[2]}` : ""}` },
  { label: /^(–\s*Représentant légal[^:]*:)\s*\[[^\]]*\]\s*(;?)$/, replace: (m) => `${m[1]} {{representant.identite}}${m[2] ? ` ${m[2]}` : ""}` },
  { label: /^(–\s*Autre personne associée[^:]*:)\s*\[[^\]]*\]\s*([.;]?)$/, replace: (m) => `${m[1]} {{proche.identite}}${m[2] === ";" ? " ;" : m[2]}` },
  { label: new RegExp(`^(Date d['’]admission\\s*:)\\s*${BLANK}\\s*$`), replace: (m) => `${m[1]} {{aide.date_debut}}` },
  { label: new RegExp(`^(Date de remise du présent document\\s*:)\\s*${BLANK}\\s*$`), replace: (m) => `${m[1]} {{date.signature}}` },
  { label: new RegExp(`^(.*prochaine révision prévue le\\s*:)\\s*${BLANK}\\s*$`), replace: (m) => `${m[1]} {{date.revision}}` },
  { label: new RegExp(`^Fait à\\s*${BLANK}\\s*,\\s*le\\s*${BLANK}(.*)$`), replace: (m) => `Fait à {{personne.ville}}, le {{date.signature}}${m[1]}` },
  { label: /^(Présentation orale réalisée par \(nom, fonction\)\s*:)\s*$/, replace: (m) => `${m[1]} {{intervenant.nom}}` },
  { label: /^(Nom, fonction\s*:)\s*$/, replace: (m) => `${m[1]} {{intervenant.nom}}` },
  { label: /^(Nom, prénom\s*:)\s*$/, replace: (m) => `${m[1]} {{signataire.nom}}` },
  { label: /^(Signature(?:, précédée de la mention « Lu et approuvé »)?\s*:)\s*$/, replace: (m) => `${m[1]} voir « Signatures », en fin de document.` },
];

function applyRules(text: string): string | null {
  for (const rule of RULES) {
    const match = rule.label.exec(text);
    if (match) return rule.replace(match);
  }
  return null;
}

// ── 3. « [à compléter] » et « ☐ » ────────────────────────────────────────────

const TO_COMPLETE = /^\[à compléter(?:\s*[—–-]\s*([^\]]*))?\]\s*(.*)$/i;
// Libellé suivi de deux-points et de rien : une réponse libre à écrire sur la
// tablette (ex. « Le bénéficiaire était accompagné de (nom, qualité) : »).
const OPEN_QUESTION = /^(Le bénéficiaire était accompagné de \(nom, qualité\)\s*:)\s*$/;
const CHECKBOX = /^[☐□]\s*(.+)$/;
const DURATION_OPTION = /^Option n°\s*(\d)\s*[–-]\s*(.+)$/;
const DATE_MASK = /JJ\/MM\/AAAA/g;

// Champs du choix de durée (fusionnés comme les autres zones de la copie).
export const DURATION_FIELDS = { option: (n: number) => `duree.option${n}`, start: "duree.debut", end: "duree.fin" } as const;

function durationOptionText(number: number, label: string): string {
  let dates = 0;
  const withDates = label.replace(DATE_MASK, () => `{{${dates++ === 0 ? DURATION_FIELDS.start : DURATION_FIELDS.end}}}`);
  return `{{${DURATION_FIELDS.option(number)}}} Option n°${number} – ${withDates}`;
}

function isAnnexHeading(block: DipcBlock): boolean {
  return block.kind === "heading" && /^annexe\b/i.test(block.text);
}

export function prepareDipcForTablet(markdown: string): PreparedDipc {
  const source = markdown.replace(/\r\n?/g, "\n").split("\n").map(toBlock).filter((b): b is DipcBlock => b !== null);
  const blocks: DipcBlock[] = [];
  const freeFields: DipcFreeField[] = [];
  const checkFields: DipcCheckField[] = [];
  const durationOptions: DipcDurationOption[] = [];
  const durationOriginals = new Map<number, string>();
  let identityZones = 0;
  let inAnnexes = false;
  let previousReplaced = false;

  for (const block of source) {
    if (isAnnexHeading(block)) inAnnexes = true;
    if (inAnnexes || block.kind === "heading") {
      blocks.push(block);
      previousReplaced = false;
      continue;
    }
    // Une ligne de pointillés seule, juste après une zone remplie, n'était que la
    // suite de cette zone : elle disparaît avec elle.
    if (previousReplaced && ONLY_BLANK_RE.test(block.text)) continue;

    const option = DURATION_OPTION.exec(block.text);
    if (option && !durationOptions.some((o) => o.number === Number(option[1]))) {
      const number = Number(option[1]);
      durationOptions.push({ number, label: option[2]!.replace(/\[\d+\]$/, "").trim(), hasDates: DATE_MASK.test(option[2]!) });
      DATE_MASK.lastIndex = 0;
      durationOriginals.set(number, block.text);
      blocks.push({ ...block, text: durationOptionText(number, option[2]!) });
      continue;
    }

    const replaced = applyRules(block.text);
    if (replaced !== null) {
      identityZones += 1;
      blocks.push({ ...block, text: replaced });
      previousReplaced = true;
      continue;
    }
    previousReplaced = false;

    const toComplete = TO_COMPLETE.exec(block.text);
    if (toComplete) {
      const id = `saisie.${freeFields.length + 1}`;
      // Le libellé est la ligne du contrat juste au-dessus (« Objectifs de
      // l'accompagnement ») — sauf si c'est déjà une zone à remplir.
      const above = blocks[blocks.length - 1]?.text ?? "";
      const label = above && !above.startsWith("{{") ? above : "À compléter";
      freeFields.push({ id, label, hint: [toComplete[1], toComplete[2]].filter(Boolean).join(" ").trim() });
      blocks.push({ ...block, text: `{{${id}}}${toComplete[2] ? ` ${toComplete[2]}` : ""}` });
      continue;
    }

    const open = OPEN_QUESTION.exec(block.text);
    if (open) {
      const id = `saisie.${freeFields.length + 1}`;
      freeFields.push({ id, label: open[1]!.replace(/\s*:$/, ""), hint: "" });
      blocks.push({ ...block, text: `${open[1]} {{${id}}}` });
      continue;
    }

    const checkbox = CHECKBOX.exec(block.text);
    if (checkbox) {
      const id = `coche.${checkFields.length + 1}`;
      checkFields.push({ id, label: checkbox[1]!.trim() });
      blocks.push({ ...block, text: `{{${id}}} ${checkbox[1]!.trim()}` });
      continue;
    }
    blocks.push(block);
  }
  // Un choix n'a de sens qu'à deux options au moins ; seule, une « Option n°1 » est
  // un paragraphe comme un autre et reste telle quelle.
  if (durationOptions.length === 1) {
    const single = durationOptions[0]!;
    const index = blocks.findIndex((b) => b.text.startsWith(`{{${DURATION_FIELDS.option(single.number)}}}`));
    blocks[index] = { ...blocks[index]!, text: durationOriginals.get(single.number)! };
  }
  const durationChoice = durationOptions.length >= 2 ? { options: durationOptions } : null;
  return { blocks, freeFields, checkFields, durationChoice, identityZones };
}

// Zones restées vides, pour le compter à l'écran.
export function blankZonesIn(text: string): number {
  return (text.match(BLANK_RE) ?? []).length;
}
