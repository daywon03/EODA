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
