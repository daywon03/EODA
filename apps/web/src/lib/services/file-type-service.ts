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
