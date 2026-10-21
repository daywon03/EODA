"use server";

import { requireEstablishmentInTenant } from "@/lib/auth/guards";
import { getEstablishmentSupportMode } from "@/lib/services/establishment-offer-service";
import { readCriteriaProofFor } from "@/lib/db/read-criteria-proof";
import { countImperativesProven, type CriterionProofRow, type ImperativesProof } from "@/lib/services/criteria-proof-service";
import { EXPECTED_IMPERATIVE_COUNT } from "@/lib/services/criterion-applicability-service";

// Onglet « Critères » d'une fiche structure, et cadre « Critères impératifs » de la
// vue d'ensemble (tranche N4). Garde : la fiche appartient au cabinet de l'appelant
// (notFound sinon) — l'identifiant vient de l'adresse, il n'est pas fiable.
export type StructureCriteriaProof = {
  rows: CriterionProofRow[];
  imperatives: ImperativesProof;
  // Repère du profil (16 SAD aide, 17 SAD mixte) — le décompte réel reste `imperatives.total`.
  expectedImperatives: number;
};

export async function getStructureCriteriaProof(establishmentId: string): Promise<StructureCriteriaProof> {
  const { establishmentId: id, establishmentType } = await requireEstablishmentInTenant(establishmentId, "READ");
  const mode = await getEstablishmentSupportMode(id);
  const rows = await readCriteriaProofFor(id, establishmentType, mode);
  return {
    rows,
    imperatives: countImperativesProven(rows),
    expectedImperatives: EXPECTED_IMPERATIVE_COUNT[establishmentType],
  };
}
