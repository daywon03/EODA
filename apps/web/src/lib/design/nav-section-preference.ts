// Préférence « section de navigation ouverte / repliée » (la section « Réglages » de
// la barre latérale du cabinet) — un confort propre à chaque poste, donc dans le
// navigateur, comme le repli de la barre (sidebar-preference.ts).
//
// Ce que ce module NE dit pas : si la section doit être ouverte. Cette règle-là est
// `isSectionOpen` (navigation.ts), pure et testée — ici on ne fait que mémoriser le
// choix du poste. Le stockage peut être absent ou refuser l'accès (navigation privée,
// données de site bloquées) : chaque lecture et chaque écriture est protégée, et
// l'absence de préférence vaut « aucun choix mémorisé », jamais « repliée ».

export const NAV_SECTION_STORAGE_KEY = "eoda-cabinet-nav-sections";

export type NavSectionPreference = Readonly<Record<string, boolean>>;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

// Ce qui vient du navigateur n'est pas fiable : une version antérieure a pu écrire
// autre chose, ou la clé a pu être posée à la main. On ne garde que les booléens, et
// une valeur illisible vaut « aucun choix » plutôt que de faire tomber la barre.
export function parseNavSectionPreference(raw: string | null | undefined): NavSectionPreference {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const kept = Object.entries(parsed as Record<string, unknown>).filter(([, value]) => typeof value === "boolean");
    return Object.fromEntries(kept) as NavSectionPreference;
  } catch {
    return {};
  }
}

export function readNavSectionPreference(storage: () => StorageLike): NavSectionPreference {
  try {
    return parseNavSectionPreference(storage().getItem(NAV_SECTION_STORAGE_KEY));
  } catch {
    return {};
  }
}

export function writeNavSectionPreference(storage: () => StorageLike, preference: NavSectionPreference): void {
  try {
    storage().setItem(NAV_SECTION_STORAGE_KEY, JSON.stringify(preference));
  } catch {
    // Préférence non mémorisée : la barre reste utilisable, la section repartira de
    // la règle par défaut.
  }
}

// Choix mémorisé pour une section, ou `null` s'il n'y en a aucun — et `null` n'est pas
// `false` : c'est ce qui distingue « je ne veux pas de cette section » de « je n'ai
// jamais rien dit », et donc ce qui laisse la règle par défaut s'appliquer.
export function preferenceFor(preference: NavSectionPreference, sectionId: string): boolean | null {
  return Object.prototype.hasOwnProperty.call(preference, sectionId) ? (preference[sectionId] ?? null) : null;
}

// Enregistre le choix d'UNE section sans toucher aux autres.
export function withSectionPreference(
  preference: NavSectionPreference,
  sectionId: string,
  isOpen: boolean
): NavSectionPreference {
  return { ...preference, [sectionId]: isOpen };
}
