import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import type { FileStoragePort, SignedUrlOptions } from "./file-storage-port";

// Fallback dev uniquement, tant qu'aucun bucket S3-compatible n'est configuré
// (voir .env.example). Ne jamais utiliser en production — pas de chiffrement
// at-rest, pas de cloisonnement réel. Sert les fichiers via /api/local-storage,
// qui refait le contrôle d'habilitation par établissement.
const STORAGE_ROOT = path.join(process.cwd(), ".local-storage");

// Confinement du chemin — défense en profondeur. Les clés sont déjà assainies en
// amont (buildStorageKey / toSafeFilenameSegment), mais un adaptateur de stockage
// ne doit pas dépendre de la bonne conduite de son appelant pour ne pas écrire
// hors de sa racine.
function resolveWithinRoot(key: string): string {
  const root = path.resolve(STORAGE_ROOT);
  const resolved = path.resolve(root, key);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error("Clé de stockage hors de la racine autorisée.");
  }
  return resolved;
}

export class LocalFsStorageAdapter implements FileStoragePort {
  async upload(key: string, content: Buffer): Promise<void> {
    const filePath = resolveWithinRoot(key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
  }

  async getSignedDownloadUrl(key: string, options: SignedUrlOptions = {}): Promise<string> {
    const { disposition = "attachment" } = options;
    // Le nom de fichier n'est pas transmis en paramètre : la route le relit en base
    // (un nom fourni par l'appelant permettrait d'injecter dans Content-Disposition).
    const query = new URLSearchParams({ disposition });
    return `/api/local-storage/${key.split("/").map(encodeURIComponent).join("/")}?${query.toString()}`;
  }

  async delete(key: string): Promise<void> {
    await unlink(resolveWithinRoot(key)).catch(() => {});
  }
}

export { STORAGE_ROOT };
