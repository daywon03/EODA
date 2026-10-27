// ─────────────────────────────────────────────────────────────────────────────
// MATRICE TYPE DE DOCUMENT → CRITÈRE HAS — import et validation (tranche N4, spec 04)
//
// La proposition du 08/10/2026 (`content/criteres/matrice-proposition.ts`, copie de
// `.claude/specs/data/…csv`) n'est QU'UNE PROPOSITION : rien n'est écrit en base sans
// que CABINET_ADMIN coche, décoche et valide, type par type. Jamais par un seed.
//
//  - un code de critère absent de la base (hors périmètre du référentiel chargé) est
//    listé « non applicable à ce référentiel », jamais écrit ;
//  - un type de document absent de la base est listé, jamais créé ;
//  - valider un type ne touche QUE les rattachements proposés pour ce type : un
//    rattachement posé autrement (suggestion confirmée promue) n'est jamais retiré
//    par cet écran.
//
// Règles PURES : ni Prisma, ni horloge.
// ─────────────────────────────────────────────────────────────────────────────

export const MATRIX_CONFIDENCES = ["HAUTE", "MOYENNE", "BASSE"] as const;
export type MatrixConfidence = (typeof MATRIX_CONFIDENCES)[number];

export type MatrixRow = {
  documentTypeCode: string;
  documentTypeLabel: string;
  criterionCode: string;
  confidence: MatrixConfidence;
  remark: string | null;
};

const EXPECTED_HEADER = [
  "document_type_code",
  "document_type_label",
  "criterion_code",
  "source_libelle_xlsx",
  "confiance",
  "remarque",
];
const CRITERION_CODE = /^\d+\.\d+\.\d+$/;

// CSV RFC 4180 minimal : virgule, champs entre guillemets, guillemets doublés.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

// La remarque de la proposition cite parfois le sigle tel qu'écrit dans le fichier
// source (« le xlsx écrit … »). Ces mentions de provenance n'apprennent rien à qui
// relit la matrice : elles sont retirées à la lecture, le reste de la remarque est conservé.
export function sanitizeRemark(raw: string): string | null {
  const parts = raw
    .split(" ; ")
    .map((p) => p.trim())
    .filter((p) => p !== "" && !/le xlsx écrit/i.test(p));
  return parts.length > 0 ? parts.join(" ; ") : null;
}

function isConfidence(value: string): value is MatrixConfidence {
  return (MATRIX_CONFIDENCES as readonly string[]).includes(value);
}

// Lignes mal formées écartées plutôt que devinées : une donnée réglementaire ne se
// répare pas en silence.
export function parseProposedMatrix(text: string): MatrixRow[] {
  const [header, ...lines] = parseCsv(text);
  if (!header || header.join(",") !== EXPECTED_HEADER.join(",")) {
    throw new Error("Matrice proposée : en-tête inattendu.");
  }
  return lines.flatMap((cells) => {
    const [typeCode = "", typeLabel = "", criterionCode = "", , confidence = "", remark = ""] = cells.map((c) =>
      c.trim()
    );
    if (!typeCode || !CRITERION_CODE.test(criterionCode) || !isConfidence(confidence)) return [];
    return [
      {
        documentTypeCode: typeCode,
        documentTypeLabel: typeLabel,
        criterionCode,
        confidence,
        remark: sanitizeRemark(remark),
      },
    ];
  });
}

export function pairKey(documentTypeCode: string, criterionCode: string): string {
  return `${documentTypeCode}|${criterionCode}`;
}

// `criterionLabel` : l'intitulé du référentiel en base — un code seul (« 1.10.2 »)
// ne se relit pas sans ouvrir le manuel HAS à côté.
export type MatrixReviewRow = MatrixRow & { linked: boolean; criterionLabel: string };

export type MatrixGroup = {
  documentTypeCode: string;
  documentTypeLabel: string;
  rows: MatrixReviewRow[];
};

export type MatrixView = {
  groups: MatrixGroup[];
  // Critères proposés mais absents du référentiel en base : jamais écrits.
  notApplicable: { criterionCode: string; documentTypeCodes: string[] }[];
  // Types de document proposés mais absents de la base : jamais créés.
  unknownDocumentTypes: string[];
  // Types de la base qu'AUCUNE ligne de la proposition ne cite. Ils existent, mais ils
  // n'ont rien à décider : `planMatrixDecision` n'écrit que ce qui lui a été proposé,
  // donc ils sont indécidables depuis cet écran. Sans cette liste ils seraient purement
  // absents de la page — indistinguables d'un type qui n'existe pas.
  typesWithoutProposal: { code: string; label: string }[];
};

export function buildMatrixView(
  rows: readonly MatrixRow[],
  known: {
    // Code → intitulé, pour les critères du référentiel chargé en base.
    criterionLabels: ReadonlyMap<string, string>;
    documentTypeLabels: ReadonlyMap<string, string>;
    linkedPairs: ReadonlySet<string>;
  }
): MatrixView {
  const groups = new Map<string, MatrixGroup>();
  const notApplicable = new Map<string, Set<string>>();
  const unknownTypes = new Set<string>();
  // Tout type CITÉ par la proposition, même si ses critères sont hors périmètre : « cité »
  // et « décidable » ne sont pas la même chose. Un type cité avec des critères non
  // applicables a bien une proposition — elle est seulement inexploitable en l'état.
  const citedTypes = new Set<string>();

  for (const row of rows) {
    citedTypes.add(row.documentTypeCode);
    const typeLabel = known.documentTypeLabels.get(row.documentTypeCode);
    if (typeLabel === undefined) {
      unknownTypes.add(row.documentTypeCode);
      continue;
    }
    const criterionLabel = known.criterionLabels.get(row.criterionCode);
    if (criterionLabel === undefined) {
      const types = notApplicable.get(row.criterionCode) ?? new Set<string>();
      types.add(row.documentTypeCode);
      notApplicable.set(row.criterionCode, types);
      continue;
    }
    const group = groups.get(row.documentTypeCode) ?? {
      documentTypeCode: row.documentTypeCode,
      documentTypeLabel: typeLabel,
      rows: [],
    };
    if (!group.rows.some((r) => r.criterionCode === row.criterionCode)) {
      group.rows.push({
        ...row,
        criterionLabel,
        linked: known.linkedPairs.has(pairKey(row.documentTypeCode, row.criterionCode)),
      });
    }
    groups.set(row.documentTypeCode, group);
  }

  const byCode = (a: string, b: string): number => a.localeCompare(b, "fr", { numeric: true });
  return {
    groups: [...groups.values()]
      .map((g) => ({ ...g, rows: [...g.rows].sort((a, b) => byCode(a.criterionCode, b.criterionCode)) }))
      .sort((a, b) => byCode(a.documentTypeCode, b.documentTypeCode)),
    notApplicable: [...notApplicable.entries()]
      .map(([criterionCode, types]) => ({ criterionCode, documentTypeCodes: [...types].sort() }))
      .sort((a, b) => byCode(a.criterionCode, b.criterionCode)),
    unknownDocumentTypes: [...unknownTypes].sort(),
    typesWithoutProposal: [...known.documentTypeLabels.entries()]
      .filter(([code]) => !citedTypes.has(code))
      .map(([code, label]) => ({ code, label }))
      .sort((a, b) => byCode(a.code, b.code)),
  };
}

export type MatrixDecision = { toCreate: string[]; toDelete: string[]; ignored: string[] };

// Décision pour UN type de document. `checked` vient du formulaire : entrée non
// fiable — un code non proposé (ou non applicable) pour ce type est ignoré, jamais
// écrit. Un rattachement proposé décoché est retiré s'il existe ; tout rattachement
// non proposé reste intact.
export function planMatrixDecision(input: {
  proposedCriterionCodes: readonly string[];
  checkedCriterionCodes: readonly string[];
  linkedCriterionCodes: ReadonlySet<string>;
}): MatrixDecision {
  const proposed = new Set(input.proposedCriterionCodes);
  const checked = new Set(input.checkedCriterionCodes);
  return {
    toCreate: [...checked].filter((c) => proposed.has(c) && !input.linkedCriterionCodes.has(c)).sort(),
    toDelete: [...proposed].filter((c) => !checked.has(c) && input.linkedCriterionCodes.has(c)).sort(),
    ignored: [...checked].filter((c) => !proposed.has(c)).sort(),
  };
}

export function describeMatrixDecision(documentTypeCode: string, decision: MatrixDecision): string {
  return `${documentTypeCode} · +${decision.toCreate.length} −${decision.toDelete.length}`;
}

// ── Chargement de toute la proposition (décision de Damon, 21/10/2026) ───────
// « Seule l'admin pour le moment, et charge les propal » : un geste d'administration
// qui ajoute en une fois chaque rattachement proposé dont le type ET le critère
// existent en base. Il n'en RETIRE aucun — décocher reste un geste type par type
// (planMatrixDecision) — et ignore ce qui est déjà rattaché.
export type ProposalLoadPlan = {
  toCreate: { documentTypeId: string; criterionId: string }[];
  alreadyLinked: number;
  skipped: number;
};

export function planFullProposalLoad(
  rows: readonly MatrixRow[],
  context: {
    documentTypeIds: ReadonlyMap<string, string>;
    criterionIds: ReadonlyMap<string, string>;
    linkedPairs: ReadonlySet<string>;
  }
): ProposalLoadPlan {
  const seen = new Set<string>();
  const toCreate: ProposalLoadPlan["toCreate"] = [];
  let alreadyLinked = 0;
  let skipped = 0;
  for (const row of rows) {
    const key = pairKey(row.documentTypeCode, row.criterionCode);
    if (seen.has(key)) continue;
    seen.add(key);
    const documentTypeId = context.documentTypeIds.get(row.documentTypeCode);
    const criterionId = context.criterionIds.get(row.criterionCode);
    if (!documentTypeId || !criterionId) skipped++;
    else if (context.linkedPairs.has(key)) alreadyLinked++;
    else toCreate.push({ documentTypeId, criterionId });
  }
  return { toCreate, alreadyLinked, skipped };
}

// ── Promotion d'une suggestion confirmée au type de document ─────────────────
// « Ajouter à la matrice » : seule une suggestion CONFIRMÉE par un humain, sur un
// document qui a un type, et pas déjà rattachée, peut monter au type.
export function promotionError(input: {
  status: "PENDING" | "CONFIRMED" | "REJECTED";
  documentTypeId: string | null;
  alreadyLinked: boolean;
}): string | null {
  if (input.status !== "CONFIRMED") return "Seule une suggestion confirmée peut être ajoutée à la matrice.";
  if (input.documentTypeId === null) return "Ce document n'a pas de type : rien à quoi rattacher le critère.";
  if (input.alreadyLinked) return "Ce critère est déjà rattaché à ce type de document.";
  return null;
}

// ── Rattachement À LA MAIN (call du 21/10/2026) ──────────────────────────────
// Sandrine devait faire vérifier dans l'enquête de satisfaction les critères que le
// manuel attend du CVS (1.3.1, 1.5.1…) : la proposition ne les citait pas pour ce
// type, l'écran ne permettait de cocher QUE ce qui était proposé, et la guideline
// qu'elle posait à la place n'était jamais relue. L'administratrice peut désormais
// rattacher n'importe quel critère du référentiel en base à n'importe quel type.
// Les codes reçus sont une entrée non fiable : seuls les codes présents en base sont
// écrits, ceux déjà rattachés sont ignorés, rien n'est jamais retiré par ce geste.
export const MAX_MANUAL_LINKS = 40;

export type ManualLinkPlan = { toCreate: string[]; alreadyLinked: string[]; unknown: string[] };

export function planManualLinks(input: {
  requestedCriterionCodes: readonly string[];
  knownCriterionCodes: ReadonlySet<string>;
  linkedCriterionCodes: ReadonlySet<string>;
}): ManualLinkPlan {
  const requested = [...new Set(input.requestedCriterionCodes.map((code) => code.trim()).filter(Boolean))];
  return {
    toCreate: requested.filter((c) => input.knownCriterionCodes.has(c) && !input.linkedCriterionCodes.has(c)),
    alreadyLinked: requested.filter((c) => input.knownCriterionCodes.has(c) && input.linkedCriterionCodes.has(c)),
    unknown: requested.filter((c) => !input.knownCriterionCodes.has(c)),
  };
}

// Retirer à la main : seulement un rattachement que la proposition ne cite PAS pour ce
// type. Un rattachement proposé se décoche sur la carte du type (planMatrixDecision) —
// deux portes pour le même geste finiraient par se contredire.
export function manualUnlinkError(input: { proposed: boolean; linked: boolean }): string | null {
  if (!input.linked) return "Ce critère n'est pas rattaché à ce type de document.";
  if (input.proposed) return "Ce rattachement vient de la proposition : décochez-le sur la carte du type.";
  return null;
}
