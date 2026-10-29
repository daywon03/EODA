// Liens vers les fiches de sensibilisation de la tablette — sans dépendance, pour
// l'écran (awareness-sheet-service porte la règle de sélection, côté serveur).

export type TabletAwarenessSheet = { versionId: string; originalFilename: string };

export function tabletAwarenessSheetUrl(versionId: string): string {
  return `/api/tablette/fiches/${encodeURIComponent(versionId)}`;
}

// Un Word se dessine sur la tablette (docx-preview) ; un PDF ou une image s'ouvre tel
// quel dans un nouvel onglet.
export function awarenessSheetIsWord(originalFilename: string): boolean {
  return /\.docx$/i.test(originalFilename);
}
