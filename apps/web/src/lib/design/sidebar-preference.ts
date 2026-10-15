// Préférence « barre latérale repliée » — un confort propre à chaque poste, donc dans
// le navigateur. Le stockage peut être absent ou refuser l'accès (navigation privée,
// données de site bloquées) : chaque lecture et chaque écriture est protégée, et
// l'absence de préférence vaut « dépliée ».
//
// UNE CLÉ PAR PORTAIL, jamais une clé commune : le cabinet et le client sont deux
// coquilles, deux publics, deux postes souvent différents. Une clé partagée ferait
// replier la barre d'un portail parce qu'on a replié celle de l'autre — et personne
// ne penserait à chercher la cause ailleurs que dans le portail qu'il regarde.
// La clé est un ARGUMENT OBLIGATOIRE des deux fonctions : un défaut implicite
// reproduirait exactement le partage qu'on veut éviter.

export type SidebarState = "expanded" | "collapsed";

export const CABINET_SIDEBAR_KEY = "eoda-cabinet-sidebar";
export const CLIENT_SIDEBAR_KEY = "eoda-client-sidebar";

// Largeurs de la maquette (Portail Cabinet v2), reprises telles quelles par la barre
// du portail client : 264 px dépliée, 76 px repliée.
export const SIDEBAR_WIDTH_PX: Record<SidebarState, number> = { expanded: 264, collapsed: 76 };

export function parseSidebarState(raw: string | null | undefined): SidebarState {
  return raw === "collapsed" ? "collapsed" : "expanded";
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function readSidebarState(storage: () => StorageLike, key: string): SidebarState {
  try {
    return parseSidebarState(storage().getItem(key));
  } catch {
    return "expanded";
  }
}

export function writeSidebarState(storage: () => StorageLike, state: SidebarState, key: string): void {
  try {
    storage().setItem(key, state);
  } catch {
    // Préférence non mémorisée : la barre reste utilisable, elle repartira dépliée.
  }
}
