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
// source (« le xlsx écrit … »). L'interface dit DIPC, toujours : ces mentions de
// provenance sont retirées à la lecture, le reste de la remarque est conservé.
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

  for (const row of rows) {
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
