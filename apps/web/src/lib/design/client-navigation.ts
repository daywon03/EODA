import { resolveActiveItem, type NavItem } from "./navigation";
import { clientAccessLevel, type ClientAccessRole, type ClientModule } from "@/lib/auth/capabilities";

// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATION DU PORTAIL CLIENT (maquette « Portail Client v2 »).
//
// La maquette prévoit : Accueil · Mes documents · Mon diagnostic · Mon équipe ·
// Messages. Seules les surfaces qui EXISTENT sont listées (D6 : pas de bouton
// mort) ; l'accueil existe depuis R6, « Mon diagnostic » depuis N6 ; « Mon équipe »
// (N10) s'ajoutera en une ligne ci-dessous. En attendant, les pages
// existantes restent atteignables : « Tâches », « Mes livrables » et « Mon suivi »
// dans le menu « Plus » (splitClientNav), « Mon contrat » dans le menu du compte.
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
export const CLIENT_SETTINGS_PATH = `${CLIENT_ROOT}/parametres`;

export type ClientNavFacts = {
  // Le dernier message du fil vient d'EODA et attend une réponse.
  hasUnansweredMessage: boolean;
  // Rôle d'accès dans la structure (N9). null = aucune structure rattachée : les
  // pages le disent elles-mêmes, la navigation reste complète.
  accessRole: ClientAccessRole | null;
};

// Module que chaque entrée ouvre — l'entrée n'apparaît que si le rôle d'accès y a
// droit (la page, elle, est gardée par requireClientEstablishment).
const ENTRY_MODULE: Record<string, ClientModule | null> = {
  home: null,
  documents: "DOCUMENTS",
  diagnostic: "DIAGNOSTIC",
  tasks: "TASKS",
  team: "TEAM",
  deliverables: "DOCUMENTS",
  progress: "DIAGNOSTIC",
  messages: "MESSAGES",
  settings: "ACCESS",
};

export function canSeeClientEntry(accessRole: ClientAccessRole | null, id: string): boolean {
  const entryModule = ENTRY_MODULE[id];
  if (!entryModule || !accessRole) return true;
  return clientAccessLevel(accessRole, entryModule) !== "NONE";
}

export function buildClientNav(facts: ClientNavFacts): NavItem[] {
  return allClientEntries(facts).filter((item) => canSeeClientEntry(facts.accessRole, item.id));
}

function allClientEntries(facts: ClientNavFacts): NavItem[] {
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
    // Paramètres (N9) : les accès de la structure — la direction seule les gère.
    { id: "settings", href: CLIENT_SETTINGS_PATH, label: "Paramètres", icon: "settings" },
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

// « Mon contrat » montre des montants : réservé au rôle qui a le module CONTRAT.
export function clientAccountLinks(accessRole: ClientAccessRole | null): AccountMenuLink[] {
  return CLIENT_ACCOUNT_LINKS.filter(
    (link) => link.id !== "contract" || !accessRole || clientAccessLevel(accessRole, "CONTRACT") !== "NONE"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTRÉES PRINCIPALES / « PLUS ».
//
// Test de bout en bout du 12/10 : sept entrées passaient à la ligne dans l'en-tête
// à 1440 px et sortaient de l'écran dans la barre du bas à 390 px. Une seule
// répartition pour les deux rendus : 4 entrées principales (celles de la maquette)
// et « Plus » en 5e case. Une entrée ajoutée sans être déclarée principale part dans
// « Plus » — par défaut, rien ne déborde.
// ─────────────────────────────────────────────────────────────────────────────

export const CLIENT_MAX_PRIMARY_ENTRIES = 4;

const CLIENT_PRIMARY_IDS: readonly string[] = ["home", "documents", "diagnostic", "messages"];

export type ClientNavSplit = {
  primary: NavItem[];
  more: NavItem[];
  activeId: string | null;
  // La page courante est une entrée de « Plus » : le bouton se marque actif.
  isMoreActive: boolean;
  // Une entrée de « Plus » attend une action : le bouton porte le point.
  moreAttention: boolean;
};

export function splitClientNav(items: readonly NavItem[], pathname: string): ClientNavSplit {
  // Les entrées de la maquette d'abord ; si le rôle d'accès en masque, les cases
  // libres se remplissent avec les suivantes (un intervenant a « Tâches » et « Mon
  // équipe » en principal plutôt que dans « Plus »).
  const preferred = items.filter((item) => CLIENT_PRIMARY_IDS.includes(item.id));
  const others = items.filter((item) => !CLIENT_PRIMARY_IDS.includes(item.id));
  const primary = [...preferred, ...others].slice(0, CLIENT_MAX_PRIMARY_ENTRIES);
  const more = items.filter((item) => !primary.includes(item));
  const activeId = resolveActiveItem([{ id: "client", label: null, items }], pathname)?.id ?? null;
  return {
    primary,
    more,
    activeId,
    isMoreActive: more.some((item) => item.id === activeId),
    moreAttention: more.some((item) => Boolean(item.attentionLabel)),
  };
}
