// Port de stockage fichiers (Dependency Inversion) — le métier ne dépend jamais
// directement d'un SDK de stockage externe. cf. specs/02-architecture-technique.md §1.
export interface FileStoragePort {
  upload(key: string, content: Buffer, contentType: string): Promise<void>;
  getSignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
  delete(key: string): Promise<void>;
}
