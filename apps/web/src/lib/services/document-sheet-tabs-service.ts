// ─────────────────────────────────────────────────────────────────────────────
// ONGLETS DU PANNEAU D'UN DOCUMENT (retours de Sandrine, 09/11/2026 : « je me perds
// dans le panneau de droite »). Rien n'est supprimé, tout est rangé en trois onglets :
//   - « Le document » : versions, aperçu, dépôt, validation, dossier, nom, retrait ;
//   - « Critères HAS » : les critères couverts (CriterionLinker) ;
//   - « Analyse »     : résultats, suggestions, guidelines, commentaire, mise en
//                       conformité.
// L'onglet vit dans l'adresse (`?onglet=`) : partageable, et utilisable sans JS (le
// serveur rend l'onglet demandé). Pure.
// ─────────────────────────────────────────────────────────────────────────────

export type SheetTab = "document" | "criteres" | "analyse";

export const SHEET_TABS: readonly { id: SheetTab; label: string }[] = [
  { id: "document", label: "Le document" },
  { id: "criteres", label: "Critères HAS" },
  { id: "analyse", label: "Analyse" },
];

export const SHEET_TAB_PARAM = "onglet";
const DEFAULT_TAB: SheetTab = "document";

export function parseSheetTab(raw: string | string[] | undefined): SheetTab {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return SHEET_TABS.find((tab) => tab.id === value)?.id ?? DEFAULT_TAB;
}

// Adresse du même panneau sur un autre onglet ; les autres paramètres sont gardés.
export function withSheetTab(href: string, tab: SheetTab): string {
  const [path = "", query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  if (tab === DEFAULT_TAB) params.delete(SHEET_TAB_PARAM);
  else params.set(SHEET_TAB_PARAM, tab);
  const next = params.toString();
  return next ? `${path}?${next}` : path;
}

// Phrase sous la pastille d'état quand l'analyse a relevé des manques ; le lien vers
// l'onglet Analyse la complète à l'écran.
export function analysisMissingNotice(missingCount: number): string | null {
  return missingCount > 0 ? "L'analyse automatique a relevé des éléments manquants" : null;
}
