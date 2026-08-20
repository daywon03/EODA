// ─────────────────────────────────────────────────────────────────────────────
// BORNAGE DES LISTES
//
// Constat de l'audit CRUD : `rg 'take:|skip:|cursor:'` ne renvoyait aucun résultat
// dans tout le dépôt. Chaque page de liste chargeait la table entière, la
// sérialisait, et — pour le Kanban prospects — l'envoyait dans un composant client.
// Le jour où Sandrine a 400 prospects, la page ne rend plus.
//
// Motif retenu : taille de page bornée + « voir plus » cumulatif porté par
// l'URL (`?taille=N`). Pas de curseur : les listes sont triées par date de création
// décroissante et restent de l'ordre de la centaine d'items ; un curseur ajouterait
// de l'état sans bénéfice mesurable. La borne dure, elle, est non négociable :
// c'est elle qui empêche `?taille=999999`.
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_STEP = 20;
// Plafond dur : au-delà, la réponse devient trop lourde à sérialiser vers un
// composant client. Une recherche/filtre prendra le relais si le besoin apparaît.
export const MAX_PAGE_SIZE = 200;

// `raw` vient de la query string : entrée non fiable. Toute valeur non entière,
// négative, ou hors borne retombe sur la taille par défaut ou sur le plafond —
// jamais d'erreur, jamais de requête non bornée.
export function parsePageSize(raw: string | undefined): number {
  if (!raw) return DEFAULT_PAGE_SIZE;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(parsed, MAX_PAGE_SIZE);
}

// Taille demandée par le bouton « Voir plus », elle-même replafonnée.
export function nextPageSize(current: number): number {
  return Math.min(current + PAGE_SIZE_STEP, MAX_PAGE_SIZE);
}

export function hasMore(shownCount: number, totalCount: number, pageSize: number): boolean {
  return shownCount < totalCount && pageSize < MAX_PAGE_SIZE;
}

// Le journal d'audit se pagine par numéro de page (et non « voir plus ») : on y
// cherche une période, pas les derniers éléments. Sa taille de page vit ici et non
// dans `lib/actions/audit-log.ts` — un fichier « use server » ne peut exporter que
// des fonctions asynchrones, une constante exportée y casse le build.
export const AUDIT_PAGE_SIZE = 50;
