// ─────────────────────────────────────────────────────────────────────────────
// OÙ S'OUVRE L'ASSISTANT D'UN DOCUMENT (11/11/2026 — « comme VS Code : la barre à
// droite, et voir le document en même temps »).
//
// Le bouton « Assistant » est dans l'EN-TÊTE de la fiche document, visible depuis les
// trois onglets. Il ouvre la page « Mettre en conformité » du document, avec le
// panneau de l'assistant à droite : le document au centre, la conversation à côté.
// Il n'y a pas de seconde page « document + assistant » : c'est la même porte que la
// mise en conformité, dont les gardes et le droit de l'offre ne changent pas.
//
// Quand l'assistant ne peut pas servir, le bouton reste à sa place et DIT pourquoi —
// on ne le cherche pas. Pur : la page et la fiche lisent la même règle.
// ─────────────────────────────────────────────────────────────────────────────

export const ASSISTANT_PANEL_PARAM = "assistant";

export type DocumentAssistantEntry =
  | { kind: "OPEN"; href: string }
  | { kind: "UNAVAILABLE"; reason: string }
  // Rôle qui n'écrit pas (lecture seule) : poser une question coûte des crédits et
  // propose des actions, le bouton n'est pas montré.
  | { kind: "HIDDEN" };

export const RESTRICTED_ASSISTANT_REASON =
  "L'assistant n'a pas accès à ce document : il est réservé à la direction de la structure.";
export const NO_VERSION_ASSISTANT_REASON = "L'assistant s'ouvre une fois un fichier déposé.";

export function cabinetConformityHref(versionId: string, options: { assistant: boolean }): string {
  const base = `/dashboard/cabinet/conformite/${encodeURIComponent(versionId)}`;
  return options.assistant ? `${base}?${ASSISTANT_PANEL_PARAM}=1` : base;
}

export function documentAssistantEntry(input: {
  canWrite: boolean;
  restrictedAccess: boolean;
  versionId: string | null;
}): DocumentAssistantEntry {
  if (!input.canWrite) return { kind: "HIDDEN" };
  // Le restreint passe AVANT l'absence de fichier : c'est la raison qui ne changera pas
  // avec un dépôt.
  if (input.restrictedAccess) return { kind: "UNAVAILABLE", reason: RESTRICTED_ASSISTANT_REASON };
  if (!input.versionId) return { kind: "UNAVAILABLE", reason: NO_VERSION_ASSISTANT_REASON };
  return { kind: "OPEN", href: cabinetConformityHref(input.versionId, { assistant: true }) };
}

// `?assistant=1` seulement ; toute autre valeur (ou plusieurs) = panneau fermé.
export function isAssistantPanelOpen(raw: string | string[] | undefined): boolean {
  return raw === "1";
}
