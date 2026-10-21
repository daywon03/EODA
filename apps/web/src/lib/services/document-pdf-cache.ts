import type { FileStoragePort } from "@/lib/storage";
import { getFileStoragePort } from "@/lib/storage";

// ─────────────────────────────────────────────────────────────────────────────
// CACHE DU RENDU PDF D'UN DOCUMENT — stockage seulement, JAMAIS le moteur de rendu.
//
// Séparé de `document-pdf-service` le 21/10/2026. La suppression d'une version
// (`lib/actions/document.ts`) n'a besoin que de la clé et du stockage ; en important
// `deleteCachedDocumentPdf` depuis le service de rendu, elle traînait Chromium dans
// le graphe d'imports de SEIZE pages (portail client, documents, modèles, commercial…)
// qui ne le lancent jamais. Ce module n'importe ni puppeteer ni @sparticuz/chromium :
// c'est ce qui le rend importable partout. `pnpm check:chromium` le vérifie après le
// build — une fonction qui embarque le code de Chromium sans son binaire fait échouer
// la CI.
//
// La clé est sûre parce que l'objet est IMMUABLE : une `DocumentVersion` désigne un
// fichier déposé une fois pour toutes (régénérer crée une nouvelle version), donc un
// cache indexé par l'identifiant de version ne peut pas servir un rendu périmé.
// ─────────────────────────────────────────────────────────────────────────────

export function documentPdfCacheKey(versionId: string): string {
  return `renders/${versionId}.pdf`;
}

export async function readCachedDocumentPdf(storage: FileStoragePort, key: string): Promise<Buffer | null> {
  try {
    const cached = await storage.download(key);
    // Signature vérifiée : un objet tronqué ou étranger rangé sous cette clé ne doit
    // pas être servi comme un PDF. Le contrôle coûte cinq octets.
    return cached.subarray(0, 5).toString("latin1") === "%PDF-" ? cached : null;
  } catch {
    // Absence normale (premier aperçu) ou stockage indisponible : on rend.
    return null;
  }
}

// Une suppression de version emporte son rendu : un PDF dérivé d'une pièce nominative
// ne survit pas à la pièce (§6, HDS — même sur le stockage actuel, on ne garde pas de
// copie d'un document supprimé).
export async function deleteCachedDocumentPdf(versionId: string): Promise<void> {
  try {
    await getFileStoragePort().delete(documentPdfCacheKey(versionId));
  } catch (error) {
    console.warn(
      "Rendu PDF — suppression du cache impossible :",
      error instanceof Error ? error.message : "erreur inconnue"
    );
  }
}
