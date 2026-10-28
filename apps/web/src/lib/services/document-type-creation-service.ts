import type { DocumentCategory } from "@eoda/database";
import type { MissionAccessState } from "@/lib/services/mission-access-service";

// ─────────────────────────────────────────────────────────────────────────────
// NOUVELLE LIGNE DANS « DOCUMENTS » — créée par le cabinet, une fois pour toutes
// (demande de Damon, 28/10/2026 : « créer de nouvelles lignes dans documents pour
// les analyser, lier les critères […] les garder et les mutualiser aux autres
// clients, comme ça c'est fait une bonne fois pour toutes »).
//
// Une ligne est un `DocumentType`, et un `DocumentType` n'appartient à aucune
// structure : créé une fois, il apparaît dans la liste de CHAQUE structure dont
// l'offre suit sa catégorie, se rattache aux critères par la matrice (un seul
// rattachement pour tous) et s'analyse comme les autres. Aucune copie par client :
// c'est ce qui rend le travail mutualisé.
//
// Règles PURES : ni Prisma, ni session.
// ─────────────────────────────────────────────────────────────────────────────

// La loi 2002-2 n'est pas ouverte : ses sept documents sont une liste LÉGALE, comptée
// à part (compte loi 2002-2, « non concerné » refusé). Y ajouter une ligne la
// fausserait pour toutes les structures.
export const CREATABLE_DOCUMENT_CATEGORIES = ["FONCTIONNEMENT", "QUALITE_RISQUES", "RH"] as const satisfies readonly DocumentCategory[];
export type CreatableDocumentCategory = (typeof CREATABLE_DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_TYPE_LABEL_MIN = 3;
export const DOCUMENT_TYPE_LABEL_MAX = 160;

// Préfixe des codes créés depuis l'écran : les codes du référentiel chargé par le
// seed (« L2002_… », « P13_… ») ne peuvent pas être pris par une ligne du cabinet.
export const CABINET_DOCUMENT_TYPE_PREFIX = "EODA_";
const CODE_SLUG_MAX = 40;

// Espaces resserrés : « Plan  de   formation » et « Plan de formation » sont la même
// ligne, écrite une seule fois.
export function normalizeDocumentTypeLabel(label: string): string {
  return label.replace(/\s+/g, " ").trim();
}

// Clé de comparaison : sans accents, sans casse, sans ponctuation. Deux libellés de
// même clé désignent le même document — le second serait un doublon que l'on
// rattacherait, analyserait et mettrait à jour deux fois.
export function documentTypeLabelKey(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isCreatableCategory(category: string): category is CreatableDocumentCategory {
  return (CREATABLE_DOCUMENT_CATEGORIES as readonly string[]).includes(category);
}

// Le doublon est NOMMÉ : la personne doit pouvoir retrouver la ligne existante.
export function documentTypeCreationError(input: {
  label: string;
  category: string;
  existingLabels: readonly string[];
}): string | null {
  const label = normalizeDocumentTypeLabel(input.label);
  if (label.length === 0) return "Le nom du document est obligatoire.";
  // Caractères de contrôle : le libellé part dans des e-mails, des exports et le prompt.
  if (/[\u0000-\u001f\u007f]/.test(label)) return "Le nom du document contient des caractères invalides.";
  if (label.length < DOCUMENT_TYPE_LABEL_MIN) return "Le nom du document est trop court.";
  if (label.length > DOCUMENT_TYPE_LABEL_MAX) {
    return `Le nom du document ne peut pas dépasser ${DOCUMENT_TYPE_LABEL_MAX} caractères.`;
  }
  if (documentTypeLabelKey(label).length === 0) return "Le nom du document doit contenir des lettres ou des chiffres.";
  if (input.category === "LOI_2002_2") {
    return "La liste de la loi 2002-2 est fixée par la loi : choisissez une autre catégorie.";
  }
  if (!isCreatableCategory(input.category)) return "Catégorie invalide.";

  const key = documentTypeLabelKey(label);
  const duplicate = input.existingLabels.find((existing) => documentTypeLabelKey(existing) === key);
  if (duplicate) return `Ce document existe déjà dans la liste : « ${duplicate} ».`;
  return null;
}

// Code stable, lisible au journal, dérivé du libellé ; suffixé s'il est déjà pris.
export function documentTypeCode(label: string, existingCodes: readonly string[]): string {
  const slug =
    documentTypeLabelKey(label).toUpperCase().replace(/ /g, "_").slice(0, CODE_SLUG_MAX).replace(/_+$/, "") ||
    "DOCUMENT";
  const base = `${CABINET_DOCUMENT_TYPE_PREFIX}${slug}`;
  const taken = new Set(existingCodes);
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}_${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

// Qui est prévenu de la nouvelle ligne : les structures dont l'accompagnement est en
// cours (accès ACTIVE) et dont l'offre suit la catégorie — celles, et seulement
// celles, pour qui la ligne compte. Une structure en bibliothèque (mission close) ou
// révoquée n'est plus accompagnée : lui annoncer un document serait une promesse.
export function shouldAnnounceNewDocumentType(input: {
  access: MissionAccessState;
  coveredCategories: readonly DocumentCategory[] | null;
  category: DocumentCategory;
}): boolean {
  if (input.access !== "ACTIVE") return false;
  // `null` = aucune mission (avant-vente) : rien n'est contracté, rien n'est annoncé.
  if (input.coveredCategories === null) return false;
  return input.coveredCategories.includes(input.category);
}
