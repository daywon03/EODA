import type { FileStoragePort } from "./file-storage-port";
import { S3StorageAdapter } from "./s3-storage-adapter";
import { LocalFsStorageAdapter } from "./local-fs-storage-adapter";
import { getEnv } from "@/lib/config/env";

let cached: FileStoragePort | null = null;

// Sélectionne l'implémentation au démarrage — le métier n'appelle jamais un
// SDK de stockage directement (cf. specs/02-architecture-technique.md §1).
export function getFileStoragePort(): FileStoragePort {
  if (cached) return cached;

  const env = getEnv();

  if (env.s3) {
    cached = new S3StorageAdapter(env.s3);
    return cached;
  }

  if (env.isProduction) {
    throw new Error(
      "Stockage fichiers non configuré : S3_ENDPOINT/S3_REGION/S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY requis en production."
    );
  }

  cached = new LocalFsStorageAdapter();
  return cached;
}

export type { FileStoragePort } from "./file-storage-port";
