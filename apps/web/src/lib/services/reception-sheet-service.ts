import { RECEPTION_DOCUMENTS, type ReceptionDocument } from "@/content/enquete/reception";
import { mergePlaceholders, placeholdersIn } from "./placeholder-merge";

// ─────────────────────────────────────────────────────────────────────────────
// RENDU DE LA FEUILLE DE RÉCEPTION — service PUR (lot C, décision 6).
//
// La feuille est le gabarit FINALE de la bibliothèque (texte rédigé et validé par
// EODA), dans lequel on FUSIONNE des champs. Ce service n'écrit aucune clause : il
// remplace `{{champ}}` par une valeur connue, refuse un champ inconnu (faute de frappe
// dans le gabarit) et refuse un champ requis vide. Sans gabarit, pas de feuille.
// ─────────────────────────────────────────────────────────────────────────────

export const RECEPTION_FIELDS = [
  "structure.nom",
  "personne.civilite",
  "personne.prenom",
  "personne.nom",
  "signataire.nom",
  "signataire.qualite",
  "intervenant.nom",
  "date.remise",
  "documents.remis",
] as const;

export type ReceptionField = (typeof RECEPTION_FIELDS)[number];
export type ReceptionFieldValues = Record<ReceptionField, string>;

export type ReceptionRender =
  | { ok: true; text: string }
  | { ok: false; unknownFields: string[]; emptyFields: ReceptionField[] };

export { placeholdersIn };

// Ici, un champ vide ou inconnu bloque : la feuille ne part jamais incomplète.
export function renderReceptionSheet(template: string | null, values: ReceptionFieldValues): ReceptionRender {
  if (!template || !template.trim()) return { ok: false, unknownFields: [], emptyFields: [] };
  const { text, unknownFields, emptyFields } = mergePlaceholders(template, RECEPTION_FIELDS, values);
  if (unknownFields.length > 0 || emptyFields.length > 0) return { ok: false, unknownFields, emptyFields };
  return { ok: true, text };
}

// Liste lisible des documents présentés, dans l'ordre de la présentation.
export function describePresentedDocuments(kinds: readonly ReceptionDocument["kind"][]): string {
  const labels = RECEPTION_DOCUMENTS.filter((doc) => kinds.includes(doc.kind)).map((doc) => doc.label);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} et ${labels[labels.length - 1]}`;
}

export const SIGNER_QUALITY_LABELS = {
  PERSONNE: "la personne accompagnée",
  REPRESENTANT: "son représentant",
  SERVICE: "le service",
} as const;
