// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATION DES PORTAILS — règles pures, partagées par les deux coquilles.
//
// Ce qui vit ici : la définition d'une entrée, et la question « laquelle est la
// page courante ? ». Ce qui n'y vit pas : la LISTE des entrées de chaque portail
// (cabinet-navigation.ts, client-navigation.ts). Les deux portails n'ont pas les
// mêmes règles de visibilité ; les fusionner ferait un jour apparaître une entrée
// cabinet dans la barre d'un client.
//
// Pas d'icône React ici, une CLÉ : la liste traverse la frontière serveur → client,
// où une fonction de composant ne passe pas.
// ─────────────────────────────────────────────────────────────────────────────

export type NavIconKey =
  | "home"
  | "structures"
  | "review"
  | "agenda"
  | "library"
  | "journal"
  | "commercial"
  | "prospects"
  | "devis"
  | "catalogue"
  | "documents"
  | "deliverables"
  | "progress"
  | "messages"
  | "criteria"
  | "tasks"
  | "diagnostic"
  | "team"
  | "staff"
  | "settings"
  | "people"
  | "surveys"
  | "content";

export type NavItem = {
  id: string;
  href: string;
  label: string;
  icon: NavIconKey;
  // `exact` : seule l'adresse elle-même est active (une page racine qui a des
  // sœurs). Sinon, l'adresse et tout ce qui est en dessous.
  exact?: boolean;
  // Adresses supplémentaires rattachées à cette entrée (une fiche structure vit
  // sous /etablissements alors que la liste est à la racine du cabinet).
  alsoMatches?: readonly string[];
  // Pastille numérique ; absente ou nulle = pas de pastille.
  count?: number;
  // Ce que la pastille veut dire, en toutes lettres, pour le lecteur d'écran.
  countLabel?: string;
  // Signal sans nombre (un message sans réponse) : point + texte masqué.
  attentionLabel?: string;
};

export type NavSection = {
  id: string;
  // Intertitre visible de la section ; null pour la section principale.
  label: string | null;
  items: readonly NavItem[];
  // Section repliable (« Réglages ») : intertitre cliquable, corps masquable.
  // Une section repliable se replie pour rendre la barre à ce qu'on consulte tous
  // les jours (maquette Portail Cabinet v2) — jamais pour cacher où l'on est : la
  // règle d'ouverture est `isSectionOpen`, ci-dessous.
  collapsible?: boolean;
};

function isUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

// Longueur du préfixe le plus spécifique par lequel `item` revendique `pathname`,
// ou -1. Le plus spécifique gagne : sans cela, « Structures » (racine du cabinet)
// serait actif sur toutes les pages du cabinet en même temps que l'entrée réelle.
export function matchLength(item: NavItem, pathname: string): number {
  const candidates = [item.href, ...(item.alsoMatches ?? [])];
  let best = -1;
  for (const base of candidates) {
    const isExactBase = base === item.href && item.exact === true;
    const matches = isExactBase ? pathname === base : isUnder(pathname, base);
    if (matches && base.length > best) best = base.length;
  }
  return best;
}

// Une seule entrée active au plus, toutes sections confondues.
export function resolveActiveItem(sections: readonly NavSection[], pathname: string): NavItem | null {
  let active: NavItem | null = null;
  let activeLength = -1;
  for (const section of sections) {
    for (const item of section.items) {
      const length = matchLength(item, pathname);
      if (length > activeLength) {
        active = item;
        activeLength = length;
      }
    }
  }
  return active;
}

// La section contient-elle la page courante ? Comparaison par IDENTIFIANT et non par
// préfixe d'adresse : « Structures » (racine du cabinet) revendique presque tout le
// cabinet, une section se reconnaît donc à l'entrée active, pas à l'adresse.
export function sectionHoldsActiveItem(section: NavSection, active: NavItem | null): boolean {
  return active !== null && section.items.some((item) => item.id === active.id);
}

// Une section repliable est-elle ouverte ?
//  1. une section ordinaire l'est toujours ;
//  2. un choix explicite du poste (`true` / `false`) l'emporte, y compris pour
//     refermer la section où l'on se trouve ;
//  3. sans choix mémorisé, elle s'ouvre d'elle-même quand la page courante est
//     dedans — sinon replier « Réglages » cacherait la page qu'on est en train de
//     lire, et la barre n'indiquerait plus où l'on est.
export function isSectionOpen(
  section: NavSection,
  active: NavItem | null,
  preference: boolean | null
): boolean {
  if (!section.collapsible) return true;
  if (preference !== null) return preference;
  return sectionHoldsActiveItem(section, active);
}

// Libellé accessible complet d'une entrée, pastille comprise : c'est lui que porte
// le lien quand la barre est repliée et que seul l'icône est visible.
export function accessibleItemLabel(item: NavItem): string {
  const parts = [item.label];
  if (item.count && item.count > 0 && item.countLabel) parts.push(item.countLabel);
  if (item.attentionLabel) parts.push(item.attentionLabel);
  return parts.join(", ");
}

// « 1 document à relire » / « 3 documents à relire ». Le nom est donné au singulier.
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count > 1 ? plural : singular}`;
}

// Initiales de la pastille de profil (« SR », « N »). Un nom vide donne « ? »
// plutôt qu'une pastille vide qui ressemblerait à un chargement.
export function initialsOf(name: string | null | undefined, max = 2): string {
  const initials = (name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0))
    .join("")
    .slice(0, max)
    .toLocaleUpperCase("fr-FR");
  return initials || "?";
}
