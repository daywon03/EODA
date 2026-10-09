import type { NavItem } from "./navigation";

// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATION DU PORTAIL CLIENT (maquette « Portail Client v2 »).
//
// La maquette prévoit : Accueil · Mes documents · Mon diagnostic · Mon équipe ·
// Messages. Seules les surfaces qui EXISTENT sont listées (D6 : pas de bouton
// mort) ; « Mon diagnostic » (N6), « Mon équipe » (N10) et un accueil distinct (R6)
// s'ajouteront chacun en une ligne dans CLIENT_NAV_ITEMS. En attendant, les pages
// existantes restent atteignables : « Mes livrables » et « Mon suivi » dans la
// barre, « Mon contrat » dans le menu du compte, comme le dessine la maquette.
//
// Côté client, toujours « EODA », jamais un prénom de l'équipe (D7).
// ─────────────────────────────────────────────────────────────────────────────

export const CLIENT_ROOT = "/dashboard/client";
export const CLIENT_MESSAGES_PATH = `${CLIENT_ROOT}/echanges`;

export type ClientNavFacts = {
  // Le dernier message du fil vient d'EODA et attend une réponse.
  hasUnansweredMessage: boolean;
};

export function buildClientNav(facts: ClientNavFacts): NavItem[] {
  return [
    // Racine du portail = la liste des pièces : `exact` pour ne pas rester actif
    // sur toutes les autres pages.
    { id: "documents", href: CLIENT_ROOT, label: "Mes documents", icon: "documents", exact: true },
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
  { id: "contract", href: `${CLIENT_ROOT}/contrat`, label: "Mon contrat" },
];
