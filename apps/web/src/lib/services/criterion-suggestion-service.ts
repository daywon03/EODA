import type { LinkedCriterion, RawCriterionSuggestion } from "@/lib/llm";

// ─────────────────────────────────────────────────────────────────────────────
// SUGGESTION DE CRITÈRE — logique PURE (aucun accès base ici, cf.
// document-ingestion-service.ts pour l'orchestration qui lit/écrit
// DocumentCriterionSuggestion).
//
// Persona « adjoint IA qualité HAS » (Damon, 20/09/2026) : un document peut
// répondre à plusieurs critères — parfois jusqu'à 10 — et l'IA doit les détecter
// tous, jamais se limiter à un seul. Cette couche fait deux choses, et deux
// seulement :
//  1. construire le catalogue FERMÉ de critères que le modèle a le droit de
//     proposer (SAD Aide/Mixte, hors ceux déjà rattachés au type) ;
//  2. revalider ce que le modèle a répondu contre ce même catalogue — jamais sur
//     la seule confiance dans le prompt (S8 : une réponse de LLM est une entrée
//     non fiable, au même titre qu'un formulaire).
// ─────────────────────────────────────────────────────────────────────────────

// Même borne que CriterionGuideline (criterion-guideline-service.ts) : une
// justification est une phrase courte citant le document, pas un paragraphe.
export const MAX_JUSTIFICATION_LENGTH = 280;

export type CriterionCatalogSource = {
  id: string;
  code: string;
  label: string;
  // BOTH s'applique aux deux profils SAD ; les deux autres valeurs sont
  // exclusives l'une de l'autre.
  applicableTo: "SAD_AIDE" | "SAD_MIXTE" | "BOTH";
};

// Le catalogue transmis au modèle : tous les critères du périmètre de
// l'établissement, MOINS ceux déjà rattachés au type de document — proposer un
// critère déjà couvert par `criteriaCoverage` produirait deux avis contradictoires
// possibles sur le même critère (le prompt le redit explicitement : les deux
// listes sont disjointes).
export function buildAdditionalCriteriaCatalog(
  allCriteria: CriterionCatalogSource[],
  establishmentType: "SAD_AIDE" | "SAD_MIXTE",
  alreadyLinkedCriterionIds: ReadonlySet<string>
): LinkedCriterion[] {
  return allCriteria
    .filter((c) => !alreadyLinkedCriterionIds.has(c.id))
    .filter((c) => c.applicableTo === "BOTH" || c.applicableTo === establishmentType)
    .map((c) => ({ code: c.code, label: c.label }));
}

export type ValidatedSuggestion = {
  criterionId: string;
  justification: string;
};

// Ne garde QUE ce qui est vérifiable contre le catalogue réellement transmis —
// un code hors catalogue est une hallucination, jamais un critère à créer à la
// volée. Dédoublonne par code (garde la première occurrence) : le modèle peut
// répéter un code par erreur, ce n'est pas une seconde preuve.
export function validateSuggestedCriteria(
  raw: RawCriterionSuggestion[],
  catalog: CriterionCatalogSource[]
): ValidatedSuggestion[] {
  const byCode = new Map(catalog.map((c) => [c.code, c] as const));
  const seen = new Set<string>();
  const result: ValidatedSuggestion[] = [];

  for (const entry of raw) {
    const criterion = byCode.get(entry.criterionCode);
    if (!criterion) continue; // code hors catalogue — jamais persisté
    if (seen.has(criterion.id)) continue;
    seen.add(criterion.id);

    const justification = entry.justification.trim().slice(0, MAX_JUSTIFICATION_LENGTH);
    if (justification.length === 0) continue;

    result.push({ criterionId: criterion.id, justification });
  }

  return result;
}
