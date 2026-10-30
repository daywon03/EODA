// Liens vers les fiches de sensibilisation de la tablette — sans dépendance, pour
// l'écran (awareness-sheet-service porte la règle de sélection, côté serveur).

export type TabletAwarenessSheet = { versionId: string; originalFilename: string };

// Les pièces de la structure pour le Département (30/10/2026), servies par la même
// route : le tampon posé dans la case « SAD » du formulaire, et le contrat
// récapitulatif qui part avec lui. Mêmes codes que `DEPARTEMENT_DOCUMENT_TYPES` (test).
export const DEPARTEMENT_TAMPON_CODE = "DEPARTEMENT_TAMPON";
export const DEPARTEMENT_CONTRAT_CODE = "DEPARTEMENT_CONTRAT_RECAPITULATIF";

export function tabletAwarenessSheetUrl(versionId: string): string {
  return `/api/tablette/fiches/${encodeURIComponent(versionId)}`;
}

// Un Word se dessine sur la tablette (docx-preview) ; un PDF ou une image s'ouvre tel
// quel dans un nouvel onglet.
export function awarenessSheetIsWord(originalFilename: string): boolean {
  return /\.docx$/i.test(originalFilename);
}
