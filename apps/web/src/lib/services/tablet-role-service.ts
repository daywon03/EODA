import type { TabletRole } from "@eoda/database";

// ─────────────────────────────────────────────────────────────────────────────
// CE QUE CHAQUE SALARIÉ PEUT FAIRE SUR LA TABLETTE — règle pure (30/10/2026).
//
// Demande de Damon : « seuls les admins côté client ont accès à tout ; ceux qui
// signent les contrats et font les enquêtes ne peuvent QUE faire les enquêtes et faire
// signer les contrats de nouveaux patients ».
//
// Les contrats signés vivent dans le navigateur de la tablette (verrou HDS) : ce qui
// est réservé à l'administrateur est donc ce qui MONTRE ou fait SORTIR les dossiers
// des autres — revoir un contrat déjà fait, l'envoyer, ouvrir un dossier, tout
// exporter, importer ou exporter la liste. Faire signer (ou noter un refus), puis
// envoyer CE contrat et faire CE formulaire du Département, reste au salarié qui
// accueille la personne.
// ─────────────────────────────────────────────────────────────────────────────

export const TABLET_ROLES = ["ADMINISTRATEUR", "INTERVENANT"] as const satisfies readonly TabletRole[];

export type TabletAbility =
  | "ADMISSION" // accueillir une personne, faire signer, noter un refus
  | "SURVEY" // passer une enquête de satisfaction
  | "PAST_CONTRACTS" // revoir, envoyer, télécharger un contrat déjà fait ; dossier d'une personne
  | "EXPORT" // exporter tous les contrats, l'index, la liste pour Ximi
  | "ROSTER"; // importer la liste des personnes, la modifier

const ABILITIES: Record<TabletRole, readonly TabletAbility[]> = {
  ADMINISTRATEUR: ["ADMISSION", "SURVEY", "PAST_CONTRACTS", "EXPORT", "ROSTER"],
  INTERVENANT: ["ADMISSION", "SURVEY"],
};

export function tabletCan(role: TabletRole, ability: TabletAbility): boolean {
  return ABILITIES[role].includes(ability);
}

export function isTabletRole(value: unknown): value is TabletRole {
  return typeof value === "string" && (TABLET_ROLES as readonly string[]).includes(value);
}

export const TABLET_ROLE_LABELS: Record<TabletRole, { label: string; description: string }> = {
  ADMINISTRATEUR: {
    label: "Administrateur",
    description: "Fait signer et les enquêtes, et voit aussi les contrats déjà faits, les dossiers, exporte et importe la liste.",
  },
  INTERVENANT: { label: "Intervenant", description: "Fait signer les nouveaux contrats et passe les enquêtes, rien d'autre." },
};

// La DIRECTION est toujours administrateur sur la tablette (demande de Damon,
// 30/10/2026 : « il faut que les directeurs soient admin »). Le salarié de la tablette
// n'a pas de compte du portail : on le reconnaît à son MÉTIER (« Mon équipe ») —
// directeur, directrice, direction, adjoint compris. Le rôle se DÉRIVE à chaque
// requête : il ne peut pas être retiré par erreur, ni oublié à l'arrivée d'une
// nouvelle directrice.
export function isDirectionJobTitle(jobTitle: string): boolean {
  const plain = jobTitle.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return /\bdirect(?:eur|rice|ion)\b/.test(plain);
}

export function effectiveTabletRole(staff: { tabletRole: TabletRole; jobTitle: string }): TabletRole {
  return isDirectionJobTitle(staff.jobTitle) ? "ADMINISTRATEUR" : staff.tabletRole;
}
