import type { ApplicableTo, EstablishmentType } from "@eoda/database";

// ─────────────────────────────────────────────────────────────────────────────
// QUELS CRITÈRES CONCERNENT CETTE STRUCTURE ? — profil SAD aide / SAD mixte.
//
// `Criterion.applicableTo` vaut BOTH pour les 137 critères des grilles SAD aide, et
// SAD_MIXTE pour les critères du champ médico-social du manuel (migration
// `20261011110000_sad_mixte_criteria`, tranche N4). Une structure voit les critères
// BOTH + ceux de son profil, jamais ceux de l'autre. Règle unique, lue par
// l'auto-évaluation, la comparaison, critères & preuves et les suggestions de
// critères — une seconde écriture finirait par montrer à un SAD aide un critère de
// soins (D1).
// ─────────────────────────────────────────────────────────────────────────────

export function applicableToValuesFor(establishmentType: EstablishmentType): ApplicableTo[] {
  return ["BOTH", establishmentType];
}

export function isCriterionApplicable(applicableTo: ApplicableTo, establishmentType: EstablishmentType): boolean {
  return applicableTo === "BOTH" || applicableTo === establishmentType;
}

// Nombre d'impératifs attendus pour un profil (context/02 §4 : 16 SAD aide, 17 SAD
// mixte). Affiché à titre de repère : le décompte réel se fait toujours sur les
// critères en base, jamais sur ce nombre (« ne jamais hardcoder un nombre fixe »).
export const EXPECTED_IMPERATIVE_COUNT: Record<EstablishmentType, number> = {
  SAD_AIDE: 16,
  SAD_MIXTE: 17,
};
