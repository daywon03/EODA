// Zéro dépendance serveur ici, volontairement : ce module est importé depuis des
// composants CLIENT (ChecklistCategory, DocumentVersionHistory) pour décider si un
// document est une image, sans afficher le bouton « Analyser » ni un message
// promettant une analyse qui ne viendra jamais (call du 15/09/2026).
//
// `isImageFile` vivait à l'origine dans file-preview-service.ts, aux côtés de
// `buildFilePreview` — qui, lui, dépend de `getFileStoragePort()` (adaptateur
// serveur, `node:fs/promises` en développement). Importer cette fonction depuis
// un composant client tirait tout le module, donc le storage adapteur Node dans
// le bundle navigateur : `UnhandledSchemeError: node:fs/promises`, constaté à la
// compilation le 16/09/2026. D2 — les couches ne fuient pas : un utilitaire pur
// appelé des deux côtés vit dans un fichier qui ne dépend d'aucun des deux.
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png"];

export function isImageFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isPdfFile(filename: string): boolean {
  return filename.toLowerCase().endsWith(".pdf");
}

// Ce dont on sait produire les PAGES (16/10/2026) : le document est converti côté
// serveur puis rendu par le lecteur PDF du navigateur — aperçu paginé identique pour
// tout le monde, et export PDF obtenu par le MÊME rendu.
//
// `.docx`, `.xlsx`, `.csv` et les images : chacun a un convertisseur ici (mammoth,
// exceljs, lecture directe, `data:` embarqué) — ce sont exactement les formats
// acceptés au dépôt, moins le PDF.
//
// Deux exclusions, volontaires :
//   - `.doc` et `.xls` (OLE2) : aucun convertisseur dans le dépôt, et le binaire
//     n'est pas du texte — promettre un aperçu qu'on ne peut pas produire serait
//     une régression par rapport à « aucun aperçu disponible » ;
//   - `.pdf` : il est DÉJÀ paginé, le navigateur l'affiche nativement. Le faire
//     passer par Chromium ne gagnerait rien et coûterait un rendu.
//
// Prédicat sur le NOM : il décide de l'affichage d'un bouton, avant tout accès au
// fichier. Le rendu lui-même ne s'y fie pas — il détecte le type par signature
// (`detectFileType`) et refuse ce qu'il ne sait pas lire, plutôt que de produire
// des pages vides pour un `.docx` qui est en réalité autre chose.
export function canRenderDocumentPages(filename: string): boolean {
  const lower = filename.toLowerCase();
  return (
    isImageFile(lower) ||
    [".docx", ".xlsx", ".csv"].some((extension) => lower.endsWith(extension))
  );
}
