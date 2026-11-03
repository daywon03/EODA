import { documentTypeLabelKey, normalizeDocumentTypeLabel } from "@/lib/services/document-type-creation-service";

// ─────────────────────────────────────────────────────────────────────────────
// DOSSIERS DE LA LISTE « DOCUMENTS » — règles pures (call du 29/10/2026).
//
// Sandrine : « un gros pavé Sensibilisation pro, et en dessous les 23 fiches », « qu'on
// n'ait pas 15 000 lignes pour 15 000 notes de service ». Un dossier range des lignes
// (`DocumentType.folderId`) ; comme les lignes, il vaut pour toutes les structures.
// C'est un classement D'AFFICHAGE : il ne change ni la catégorie légale, ni les
// critères, ni ce qui est réclamé à la structure.
//
// Ni Prisma, ni session.
// ─────────────────────────────────────────────────────────────────────────────

export const DOCUMENT_FOLDER_LABEL_MIN = 2;
export const DOCUMENT_FOLDER_LABEL_MAX = 80;

export type FolderRef = { id: string; label: string; position: number };

// Nom d'un dossier, à la création comme au renommage. Le doublon est NOMMÉ (accents,
// casse et ponctuation ignorés) : deux dossiers « Stratégie » couperaient la liste en
// deux sans qu'on sache où ranger.
export function documentFolderLabelError(rawLabel: string, otherLabels: readonly string[]): string | null {
  const label = normalizeDocumentTypeLabel(rawLabel);
  if (label.length === 0) return "Le nom du dossier est obligatoire.";
  if (/[\u0000-\u001f\u007f]/.test(label)) return "Le nom du dossier contient des caractères invalides.";
  if (label.length < DOCUMENT_FOLDER_LABEL_MIN) return "Le nom du dossier est trop court.";
  if (label.length > DOCUMENT_FOLDER_LABEL_MAX) {
    return `Le nom du dossier ne peut pas dépasser ${DOCUMENT_FOLDER_LABEL_MAX} caractères.`;
  }
  const key = documentTypeLabelKey(label);
  if (key.length === 0) return "Le nom du dossier doit contenir des lettres ou des chiffres.";
  const duplicate = otherLabels.find((existing) => documentTypeLabelKey(existing) === key);
  if (duplicate) return `Ce dossier existe déjà : « ${duplicate} ».`;
  return null;
}

// Position d'un nouveau dossier : à la suite des autres.
export function nextFolderPosition(folders: readonly { position: number }[]): number {
  return folders.reduce((max, folder) => Math.max(max, folder.position), 0) + 1;
}

export type FolderedRows<T> = {
  // Dossiers qui ont au moins une ligne dans la liste reçue, dans l'ordre décidé par
  // le cabinet ; l'ordre des lignes reçu est gardé à l'intérieur d'un dossier.
  folders: { id: string; label: string; rows: T[] }[];
  // Lignes sans dossier — ou dont le dossier est inconnu : jamais perdues.
  loose: T[];
};

// Range des lignes (déjà filtrées par l'écran) dans leurs dossiers. Un dossier vide
// pour l'onglet courant n'apparaît pas : un pavé « 0 » n'apprend rien.
export function groupRowsByFolder<T extends { folder: { id: string } | null }>(
  rows: readonly T[],
  folders: readonly FolderRef[]
): FolderedRows<T> {
  const ordered = [...folders].sort((a, b) => a.position - b.position || a.label.localeCompare(b.label, "fr"));
  const byId = new Map(ordered.map((folder) => [folder.id, { id: folder.id, label: folder.label, rows: [] as T[] }]));
  const loose: T[] = [];
  for (const row of rows) {
    const bucket = row.folder ? byId.get(row.folder.id) : undefined;
    if (bucket) bucket.rows.push(row);
    else loose.push(row);
  }
  return { folders: [...byId.values()].filter((folder) => folder.rows.length > 0), loose };
}

// Les dossiers que portent des lignes, sans doublon — pour un écran qui n'a que les
// lignes (portail de la structure).
export function foldersOfRows(rows: readonly { folder: FolderRef | null }[]): FolderRef[] {
  const byId = new Map<string, FolderRef>();
  for (const row of rows) if (row.folder && !byId.has(row.folder.id)) byId.set(row.folder.id, row.folder);
  return [...byId.values()];
}
