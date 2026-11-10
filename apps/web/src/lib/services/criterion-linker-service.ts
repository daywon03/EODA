import { documentTypeLabelKey, normalizeCriterionQuery } from "./document-type-creation-service";

// ─────────────────────────────────────────────────────────────────────────────
// RATTACHER DES CRITÈRES À UN TYPE DE DOCUMENT — recherche (retours de Sandrine,
// 09/11/2026 : « je veux une liste des critères, je coche ce qui est bon »).
//
// Une seule règle de recherche pour le composant `CriterionLinker`, monté dans la
// fiche document, la matrice et la page Critères d'une structure : par NUMÉRO
// (« 3.14 », « 3-14 ») ou par MOT du libellé (accents et casse ignorés). Un critère
// déjà rattaché n'est jamais proposé. Pure : ni Prisma, ni React.
// ─────────────────────────────────────────────────────────────────────────────

// Le référentiel SAD compte 137 critères (157 au manuel) : la borne ne tronque rien
// aujourd'hui, elle empêche seulement une liste sans fin si le référentiel grossit.
export const MAX_LINKER_RESULTS = 200;

const CODE_SHAPE = /^\d+(\.\d+)*$/;

export function filterLinkableCriteria<T extends { code: string; label: string }>(
  criteria: readonly T[],
  query: string,
  linkedCodes: ReadonlySet<string>
): T[] {
  const normalized = normalizeCriterionQuery(query);
  const byCode = CODE_SHAPE.test(normalized);
  const needle = byCode ? normalized : documentTypeLabelKey(normalized);
  return criteria
    .filter((criterion) => {
      if (linkedCodes.has(criterion.code)) return false;
      if (needle === "") return true;
      return byCode ? criterion.code.startsWith(needle) : documentTypeLabelKey(criterion.label).includes(needle);
    })
    .slice(0, MAX_LINKER_RESULTS);
}

// ── Phrases partagées (CriterionLinker et onglet Analyse) ───────────────────
// Écrites UNE fois : la même question de confirmation et les mêmes messages, que le
// critère soit retiré depuis la liste des critères ou depuis l'analyse.

const plural = (n: number, word: string): string => `${n} ${word}${n > 1 ? "s" : ""}`;

export function unlinkCriterionQuestion(code: string, proposed: boolean): string {
  return proposed
    ? `Retirer ${code} ? C'est refuser la proposition de la matrice : les analyses ne le vérifieront plus, pour toutes les structures.`
    : `Retirer ${code} ? Les analyses ne le vérifieront plus pour ce document, dans toutes les structures.`;
}

export function linkedCriteriaMessage(added: number): string {
  return `${plural(added, "critère")} rattaché${added > 1 ? "s" : ""}. Relancez l'analyse des documents de ce type pour qu'ils soient vérifiés.`;
}

export function unlinkedCriterionMessage(code: string): string {
  return `Critère ${code} retiré de ce type de document.`;
}

// Quel geste proposer sur un critère de l'ANALYSE (retours du 09/11/2026) ? L'analyse
// est figée au jour où elle a été produite ; la matrice, elle, bouge. Le geste se
// décide donc sur la matrice ACTUELLE : un critère attendu absent qui est encore
// rattaché se retire, un critère détecté pas encore rattaché se rattache. Matrice pas
// encore lue (`null`) : aucun bouton, plutôt qu'un geste proposé à l'aveugle.
export function analysisCriterionAction(input: {
  code: string;
  list: "detected" | "missing";
  linkedCodes: ReadonlySet<string> | null;
}): "LINK" | "UNLINK" | null {
  if (input.linkedCodes === null) return null;
  const linked = input.linkedCodes.has(input.code);
  if (input.list === "missing") return linked ? "UNLINK" : null;
  return linked ? null : "LINK";
}
