import { getEnv, type AppEnv } from "@/lib/config/env";
import { hdsConfigProblems } from "@/lib/config/production-profile";
import type { FileStoragePort } from "@/lib/storage/file-storage-port";
import type { BeneficiaryDataPort } from "./beneficiary-data-port";
import { LockedBeneficiaryDataAdapter, LockedHdsFileStorageAdapter } from "./locked-beneficiary-data-adapter";

// ─────────────────────────────────────────────────────────────────────────────
// SÉLECTEUR DES ADAPTATEURS HDS — le verrou du lot C (ADR 20261014).
//
// Deux conditions, cumulatives, pour sortir du verrou :
//   1. HDS_BACKEND_ENABLED vaut exactement "true" (lu dans lib/config/env.ts, et là
//      seulement) ;
//   2. la configuration HDS est COMPLÈTE au sens du profil de production
//      (hébergeur déclaré, stockage distinct) — la même fonction que celle qui
//      refuse le démarrage en production.
// Sinon : adaptateurs verrouillés, en développement comme en production. Une
// incohérence ne « dégrade » jamais vers une écriture.
// ─────────────────────────────────────────────────────────────────────────────

export type HdsBackendState = "LOCKED" | "OPEN";

export function resolveHdsBackendState(env: Pick<AppEnv, "hds" | "s3">): HdsBackendState {
  if (!env.hds.enabled) return "LOCKED";
  return hdsConfigProblems(env).length === 0 ? "OPEN" : "LOCKED";
}

export function getBeneficiaryDataPort(): BeneficiaryDataPort {
  if (resolveHdsBackendState(getEnv()) === "LOCKED") return new LockedBeneficiaryDataAdapter();
  // L'adaptateur réel arrive avec les tables (migration du lot C). Tant qu'il n'est
  // pas livré, une ouverture déclarée échoue bruyamment plutôt que d'écrire ailleurs.
  throw new Error("Adaptateur HDS non livré : le verrou ne peut pas s'ouvrir dans cette version.");
}

export function getHdsFileStoragePort(): FileStoragePort {
  return new LockedHdsFileStorageAdapter();
}

export { HDS_LOCKED_MESSAGE, HdsNotAvailableError, isHdsNotAvailableError } from "./hds-errors";
export type * from "./beneficiary-data-port";
