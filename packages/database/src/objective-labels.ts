// ─────────────────────────────────────────────────────────────────────────────
// SUFFIXES « (Objectif 3.13) » DANS LES INTITULÉS DE DOCUMENTS — logique pure
//
// Retour du 09/11/2026 (#4) : des lignes de la liste « Documents » finissent par
// « (Obj. 3.13) », « (Objectif 3.14) », « - Objectif 3.13 » ou « (3.13) ». Le
// rattachement d'un document aux critères vit dans la matrice, pas dans son titre.
// Ce module décide QUOI renommer ; le script `scripts/strip-objective-labels.ts`
// l'applique (essai à blanc par défaut). Testé par
// `apps/web/src/lib/db/objective-labels.test.ts`.
//
// Mêmes règles que `renameDocumentType` (apps/web) : un document de la loi 2002-2
// garde son nom légal, un doublon d'intitulé (accents, casse, ponctuation ignorés)
// est refusé, le journal porte « CODE : « ancien » → « nouveau » ».
// ─────────────────────────────────────────────────────────────────────────────

// Clé de comparaison d'un intitulé : accents, casse et ponctuation ignorés. Source
// unique — `document-type-creation-service.ts` (apps/web) la réexporte.
export function documentTypeLabelKey(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Un suffixe en FIN de titre : « (Obj. 3.13) », « (Objectif 3.14) », « (3.13) »,
// « - Objectif 3.13 » / « – Obj. 3.13 ». Un numéro seul exige un point (« (2026) »
// n'est pas un objectif) ; après un tiret, le mot « Obj./Objectif » est exigé.
const OBJECTIVE_WORD = String.raw`Obj(?:\.|ectif)?\s*`;
const CRITERION_NUMBER = String.raw`\d+(?:\.\d+)+`;
const OBJECTIVE_SUFFIX = new RegExp(
  String.raw`\s*(?:[-–—]\s*${OBJECTIVE_WORD}${CRITERION_NUMBER}|\(\s*(?:${OBJECTIVE_WORD})?${CRITERION_NUMBER}\s*\))\s*$`,
  "i"
);

export function stripObjectiveSuffix(label: string): string {
  let current = label;
  for (;;) {
    const next = current.replace(OBJECTIVE_SUFFIX, "");
    if (next === current) break;
    current = next;
  }
  if (current === label) return label;
  const stripped = current.trim();
  // Un titre qui ne serait QUE un suffixe ne se vide jamais.
  return stripped.length > 0 ? stripped : label;
}

export type ObjectiveLabelType = { id: string; code: string; label: string; category: string };
export type ObjectiveRename = { id: string; code: string; from: string; to: string };
export type ObjectiveRenamePlan = {
  renames: ObjectiveRename[];
  refused: (ObjectiveRename & { reason: string })[];
};

const LEGAL_NAME_REASON = "Les documents de la loi 2002-2 gardent leur nom légal.";

// Idempotent : rejoué sur des intitulés déjà nettoyés, il ne propose rien.
export function planObjectiveLabelRenames(types: readonly ObjectiveLabelType[]): ObjectiveRenamePlan {
  const candidates = types.flatMap((type) => {
    const to = stripObjectiveSuffix(type.label);
    return to === type.label ? [] : [{ id: type.id, code: type.code, from: type.label, to, category: type.category }];
  });
  const plannedTo = new Map(
    candidates.filter((c) => c.category !== "LOI_2002_2").map((c) => [c.id, c.to] as const)
  );
  // Intitulé de chaque ligne APRÈS le passage : c'est contre lui qu'on cherche un doublon.
  const finalLabels = types.map((type) => ({ id: type.id, label: plannedTo.get(type.id) ?? type.label, current: type.label }));

  const plan: ObjectiveRenamePlan = { renames: [], refused: [] };
  for (const { category, ...rename } of candidates) {
    if (category === "LOI_2002_2") {
      plan.refused.push({ ...rename, reason: LEGAL_NAME_REASON });
      continue;
    }
    const key = documentTypeLabelKey(rename.to);
    const duplicate = finalLabels.find((other) => other.id !== rename.id && documentTypeLabelKey(other.label) === key);
    if (duplicate) plan.refused.push({ ...rename, reason: `Doublon de « ${duplicate.current} ».` });
    else plan.renames.push(rename);
  }
  return plan;
}

// Même texte que le journal de `renameDocumentType` (DOCUMENT_TYPE_RENAMED).
export function objectiveRenameAuditDetail(rename: { code: string; from: string; to: string }): string {
  return `${rename.code} : « ${rename.from} » → « ${rename.to} »`;
}
