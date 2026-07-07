import type { FileStoragePort } from "./file-storage-port";
import { S3StorageAdapter } from "./s3-storage-adapter";
import { LocalFsStorageAdapter } from "./local-fs-storage-adapter";

let cached: FileStoragePort | null = null;

// Sélectionne l'implémentation au démarrage — le métier n'appelle jamais un
// SDK de stockage directement (cf. specs/02-architecture-technique.md §1).
export function getFileStoragePort(): FileStoragePort {
  if (cached) return cached;

  const { S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } =
    process.env;

  if (S3_ENDPOINT && S3_REGION && S3_BUCKET && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY) {
    cached = new S3StorageAdapter({
      endpoint: S3_ENDPOINT,
      region: S3_REGION,
      bucket: S3_BUCKET,
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_SECRET_ACCESS_KEY,
    });
    return cached;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Stockage fichiers non configuré : S3_ENDPOINT/S3_REGION/S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY requis en production."
    );
  }

  cached = new LocalFsStorageAdapter();
  return cached;
}

export type { FileStoragePort } from "./file-storage-port";
