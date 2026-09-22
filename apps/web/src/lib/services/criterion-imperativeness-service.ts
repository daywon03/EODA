import type { EstablishmentType, RequirementLevel } from "@eoda/database";

// ─────────────────────────────────────────────────────────────────────────────
// STATUT IMPÉRATIF RÉEL D'UN CRITÈRE, SELON LE PROFIL DE L'ÉTABLISSEMENT
//
// cf. .claude/context/02-referentiel-has.md §4 : le manuel HAS (juillet 2025) marque
// 18 critères "Impératif" tous ESSMS confondus, mais pour le périmètre SAD d'EODA la
// vérité opérationnelle est 16 (SAD Aide) ou 17 (SAD Mixte) — pas un nombre fixe.
// `Criterion.requirementLevel` (seed-has-referential.ts) reflète déjà les 16 communs
// aux deux profils. Le seul écart connu à ce jour : 3.6.2 (sécurisation du circuit du
// médicament) est IMPÉRATIF pour un SAD Mixte, alors qu'un SAD Aide n'a pas de circuit
// médicament à sécuriser — le critère lui-même reste STANDARD en base pour ne pas
// fausser le décompte des établissements Aide, qui sont la majorité du portefeuille.
//
// Toute nouvelle divergence Aide/Mixte découverte plus tard s'ajoute ici, jamais en
// modifiant Criterion.requirementLevel directement (qui redeviendrait faux pour
// l'autre profil).
const MIXTE_ONLY_IMPERATIFS: ReadonlySet<string> = new Set(["3.6.2"]);

export function isCriterionImperativeForEstablishment(
  criterion: { code: string; requirementLevel: RequirementLevel },
  establishmentType: EstablishmentType
): boolean {
  if (criterion.requirementLevel === "IMPERATIF") return true;
  return establishmentType === "SAD_MIXTE" && MIXTE_ONLY_IMPERATIFS.has(criterion.code);
}
