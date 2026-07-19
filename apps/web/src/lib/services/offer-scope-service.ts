import type { CommercialTier } from "@eoda/database";

// Périmètre exact des 3 offres commerciales — source de vérité pour ce qui est
// vérifié/coté et ce qui est corrigé, sans dupliquer la règle ailleurs (moteur
// de configuration, cf. CLAUDE.md §5 Open/Closed).
//
// - Essentielle  : critères impératifs uniquement + analyse documentaire loi 2002-2,
//                  SANS correction.
// - Performance  : vérification des 157/137 critères, correction limitée à loi 2002-2.
// - Excellence   : vérification ET correction de tout.

export type CriteriaScope = "IMPERATIFS_ONLY" | "ALL";
export type CorrectionScope = "NONE" | "LOI_2002_2_ONLY" | "ALL";

export type OfferScope = { criteriaScope: CriteriaScope; correctionScope: CorrectionScope };

const OFFER_SCOPES: Record<Exclude<CommercialTier, "BETA">, OfferScope> = {
  ESSENTIEL: { criteriaScope: "IMPERATIFS_ONLY", correctionScope: "NONE" },
  PERFORMANCE: { criteriaScope: "ALL", correctionScope: "LOI_2002_2_ONLY" },
  EXCELLENCE: { criteriaScope: "ALL", correctionScope: "ALL" },
};

// BETA (bêta-test gratuit) reçoit le périmètre Excellence complet — cohérent avec
// isExcellenceScope() du suivi de mission (mission-progress-service.ts).
export function getOfferScope(formule: CommercialTier): OfferScope {
  if (formule === "BETA") return OFFER_SCOPES.EXCELLENCE;
  return OFFER_SCOPES[formule];
}
