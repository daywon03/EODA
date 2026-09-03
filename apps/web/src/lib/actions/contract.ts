"use server";

import { requireCabinetSession } from "@/lib/auth/guards";
import { readContractData, type ContractReadResult } from "@/lib/db/read-contract-data";

// ─────────────────────────────────────────────────────────────────────────────
// LECTURE DU CONTRAT D'ACCOMPAGNEMENT — dernière étape du parcours de conversion.
//
// Fichier séparé de `lib/actions/mission.ts`, qui frôle déjà 600 lignes (D4) : le
// contrat a sa propre lecture, pas les mêmes écritures, et rien à partager avec le
// suivi de mission au-delà du modèle.
//
// Réservé au Cabinet (`requireCabinetSession` : identité + tenant, fail-closed) —
// c'est le cabinet qui édite le contrat, même si le document part chez le client. Un
// `establishmentId` reçu ici vient d'une route HTTP publique : le filtre `tenantId`
// de la requête est ce qui interdit de lire la fiche d'un autre tenant, et l'absence
// de résultat donne `null`, que l'appelant transforme en `notFound()`.
// ─────────────────────────────────────────────────────────────────────────────

// Le logo de la structure n'est pas un FAIT du contrat — `contract-service` est pur
// et ne connaît aucune image. Il voyage donc à côté des faits, dans le même aller-
// retour en base : une seconde requête (et une seconde garde) pour lire une colonne
// déjà chargée serait du gaspillage, pas de la séparation.
// Le contrat, côté CABINET. La requête vit dans `lib/db/read-contract-data.ts` :
// le portail client lit exactement le même contrat, avec une autre garde.
export async function getContractData(
  establishmentId: string
): Promise<ContractReadResult | null> {
  const { tenantId } = await requireCabinetSession();
  return readContractData(establishmentId, tenantId);
}
