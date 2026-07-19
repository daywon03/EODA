import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import type { FileStoragePort, SignedUrlOptions } from "./file-storage-port";

// Fallback dev uniquement, tant qu'aucun bucket S3-compatible n'est configuré
// (voir .env.example). Ne jamais utiliser en production — pas de chiffrement
// at-rest, pas de cloisonnement réel. Sert les fichiers via /api/local-storage.
const STORAGE_ROOT = path.join(process.cwd(), ".local-storage");

export class LocalFsStorageAdapter implements FileStoragePort {
  async upload(key: string, content: Buffer): Promise<void> {
    const filePath = path.join(STORAGE_ROOT, key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
  }

  async getSignedDownloadUrl(key: string, options: SignedUrlOptions = {}): Promise<string> {
    const { disposition = "attachment", filename } = options;
    const query = new URLSearchParams({ disposition });
    if (filename) query.set("filename", filename);
    return `/api/local-storage/${key.split("/").map(encodeURIComponent).join("/")}?${query.toString()}`;
  }

  async delete(key: string): Promise<void> {
    await unlink(path.join(STORAGE_ROOT, key)).catch(() => {});
  }
}

export { STORAGE_ROOT };
