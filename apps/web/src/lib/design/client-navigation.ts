import type { NavItem } from "./navigation";

// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATION DU PORTAIL CLIENT (maquette « Portail Client v2 »).
//
// La maquette prévoit : Accueil · Mes documents · Mon diagnostic · Mon équipe ·
// Messages. Seules les surfaces qui EXISTENT sont listées (D6 : pas de bouton
// mort) ; l'accueil existe depuis R6, « Mon diagnostic » depuis N6 ; « Mon équipe »
// (N10) s'ajoutera en une ligne ci-dessous. En attendant, les pages
// existantes restent atteignables : « Mes livrables » et « Mon suivi » dans la
// barre, « Mon contrat » dans le menu du compte, comme le dessine la maquette.
//
// Côté client, toujours « EODA », jamais un prénom de l'équipe (D7).
// ─────────────────────────────────────────────────────────────────────────────

export const CLIENT_ROOT = "/dashboard/client";
export const CLIENT_MESSAGES_PATH = `${CLIENT_ROOT}/echanges`;
export const CLIENT_DOCUMENTS_PATH = `${CLIENT_ROOT}/documents`;
export const CLIENT_CONTRACT_PATH = `${CLIENT_ROOT}/contrat`;
export const CLIENT_TASKS_PATH = `${CLIENT_ROOT}/taches`;
export const CLIENT_DIAGNOSTIC_PATH = `${CLIENT_ROOT}/diagnostic`;
export const CLIENT_PRACTICES_PATH = `${CLIENT_DIAGNOSTIC_PATH}/pratiques`;

export type ClientNavFacts = {
  // Le dernier message du fil vient d'EODA et attend une réponse.
  hasUnansweredMessage: boolean;
};

export function buildClientNav(facts: ClientNavFacts): NavItem[] {
  return [
    // Racine du portail = l'accueil (R6) : `exact` pour ne pas rester actif sur
    // toutes les autres pages.
    { id: "home", href: CLIENT_ROOT, label: "Accueil", icon: "home", exact: true },
    { id: "documents", href: CLIENT_DOCUMENTS_PATH, label: "Mes documents", icon: "documents" },
    // « Mon diagnostic » (N6) ; les questions sur les pratiques (N7) vivent dessous.
    { id: "diagnostic", href: CLIENT_DIAGNOSTIC_PATH, label: "Mon diagnostic", icon: "diagnostic" },
    // Tâches de la structure (N5) : celles qu'EODA ou la structure lui a confiées.
    { id: "tasks", href: CLIENT_TASKS_PATH, label: "Tâches", icon: "tasks" },
    { id: "deliverables", href: `${CLIENT_ROOT}/livrables`, label: "Mes livrables", icon: "deliverables" },
    { id: "progress", href: `${CLIENT_ROOT}/suivi`, label: "Mon suivi", icon: "progress" },
    {
      id: "messages",
      href: CLIENT_MESSAGES_PATH,
      label: "Messages",
      icon: "messages",
      ...(facts.hasUnansweredMessage ? { attentionLabel: "nouveau message" } : {}),
    },
  ];
}

export type AccountMenuLink = { id: string; href: string; label: string };

// Le menu du compte : ce qui concerne la personne et son contrat, pas le travail
// du jour. La déconnexion y est ajoutée par le composant (c'est un formulaire,
// pas un lien).
export const CLIENT_ACCOUNT_LINKS: readonly AccountMenuLink[] = [
  { id: "profile", href: "/dashboard/profil", label: "Mon profil" },
  { id: "contract", href: CLIENT_CONTRACT_PATH, label: "Mon contrat" },
];
