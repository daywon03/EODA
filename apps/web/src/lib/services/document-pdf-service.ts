import { getFileStoragePort, type FileStoragePort } from "@/lib/storage";
import { buildDocumentBody, renderHtmlToPdf } from "@/lib/services/document-pdf-render-service";
import { buildPrintableHtml } from "@/lib/services/printable-html-service";

// ─────────────────────────────────────────────────────────────────────────────
// PDF D'UN DOCUMENT — un seul artefact pour deux besoins (16/10/2026).
//
// Le PDF produit ici sert à la fois l'APERÇU (le lecteur du navigateur l'affiche,
// vignettes et numérotation comprises) et l'EXPORT PDF proposé au téléchargement.
// Deux artefacts auraient divergé : ce que Sandrine voit ne serait plus ce qu'elle
// envoie.
//
// MISE EN CACHE. Le rendu coûte un lancement de Chromium (~1 s), et l'aperçu se
// rouvre souvent. Le résultat est donc rangé dans le stockage sous
// `renders/{versionId}.pdf`. La clé est sûre parce que l'objet est IMMUABLE : une
// `DocumentVersion` désigne un fichier déposé une fois pour toutes — régénérer une
// mise en conformité crée une NOUVELLE version (`regeneratedFromVersionId`), et
// l'originale n'est jamais réécrite. Un cache indexé par l'identifiant de version ne
// peut donc pas servir un rendu périmé.
//
// Le cache est un CONFORT, jamais une condition : une lecture ratée ou une écriture
// refusée ne fait pas échouer l'aperçu, elle le rend juste plus lent. Et comme le PDF
// est dérivé d'une pièce nominative, il disparaît avec elle
// (`deleteCachedDocumentPdf`, appelé par la suppression d'une version).
// ─────────────────────────────────────────────────────────────────────────────

export function documentPdfCacheKey(versionId: string): string {
  return `renders/${versionId}.pdf`;
}

export type DocumentPdfSource = {
  versionId: string;
  // Nom du fichier d'origine : titre du document dans la page, et texte de
  // remplacement d'une image.
  originalFilename: string;
  fileStorageKey: string;
  // Intitulé du TYPE (« Livret d'accueil »), jamais le nom de fichier — c'est ce
  // que Sandrine nomme, et ce que la structure reconnaît.
  title: string;
  subtitle: string | null;
};

// Rend `null` quand ce format ne se convertit pas (`.doc`/`.xls`, ou un fichier dont
// la signature ne correspond pas à son nom) : l'appelant répond « pas d'aperçu »
// plutôt que des pages vides.
export async function getOrRenderDocumentPdf(source: DocumentPdfSource): Promise<Buffer | null> {
  const storage = getFileStoragePort();
  const cacheKey = documentPdfCacheKey(source.versionId);

  const cached = await readCachedPdf(storage, cacheKey);
  if (cached) return cached;

  const content = await storage.download(source.fileStorageKey);
  const body = await buildDocumentBody({
    originalFilename: source.originalFilename,
    content,
  });
  if (!body) return null;

  const html = buildPrintableHtml({
    title: source.title,
    subtitle: source.subtitle,
    bodyHtml: body.bodyHtml,
    notice: body.notice,
  });
  const pdf = await renderHtmlToPdf(html);

  try {
    await storage.upload(cacheKey, pdf, "application/pdf");
  } catch (error) {
    // Un cache qu'on n'a pas pu écrire n'est pas une panne : le PDF est déjà rendu et
    // part. Le signaler suffit — la prochaine ouverture repayera le rendu.
    console.warn(
      "Rendu PDF — mise en cache impossible :",
      error instanceof Error ? error.message : "erreur inconnue"
    );
  }

  return pdf;
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

async function readCachedPdf(storage: FileStoragePort, key: string): Promise<Buffer | null> {
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
