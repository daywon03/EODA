// Préférence « barre latérale repliée » du portail cabinet — un confort propre à
// chaque poste, donc dans le navigateur. Le stockage peut être absent ou refuser
// l'accès (navigation privée, données de site bloquées) : chaque lecture et chaque
// écriture est protégée, et l'absence de préférence vaut « dépliée ».

export type SidebarState = "expanded" | "collapsed";

export const SIDEBAR_STORAGE_KEY = "eoda-cabinet-sidebar";

// Largeurs de la maquette (Portail Cabinet v2) : 264 px dépliée, 76 px repliée.
export const SIDEBAR_WIDTH_PX: Record<SidebarState, number> = { expanded: 264, collapsed: 76 };

export function parseSidebarState(raw: string | null | undefined): SidebarState {
  return raw === "collapsed" ? "collapsed" : "expanded";
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function readSidebarState(storage: () => StorageLike): SidebarState {
  try {
    return parseSidebarState(storage().getItem(SIDEBAR_STORAGE_KEY));
  } catch {
    return "expanded";
  }
}

export function writeSidebarState(storage: () => StorageLike, state: SidebarState): void {
  try {
    storage().setItem(SIDEBAR_STORAGE_KEY, state);
  } catch {
    // Préférence non mémorisée : la barre reste utilisable, elle repartira dépliée.
  }
}
