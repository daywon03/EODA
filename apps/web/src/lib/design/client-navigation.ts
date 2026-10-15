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
export const CLIENT_DELIVERABLES_PATH = `${CLIENT_ROOT}/livrables`;
export const CLIENT_CONTRACT_PATH = `${CLIENT_ROOT}/contrat`;
export const CLIENT_TASKS_PATH = `${CLIENT_ROOT}/taches`;
export const CLIENT_DIAGNOSTIC_PATH = `${CLIENT_ROOT}/diagnostic`;
export const CLIENT_PRACTICES_PATH = `${CLIENT_DIAGNOSTIC_PATH}/pratiques`;
export const CLIENT_SETTINGS_PATH = `${CLIENT_ROOT}/parametres`;
export const CLIENT_TEAM_PATH = `${CLIENT_ROOT}/equipe`;
export const CLIENT_PEOPLE_PATH = `${CLIENT_ROOT}/personnes`;
export const CLIENT_SURVEYS_PATH = `${CLIENT_ROOT}/enquetes`;

export type ClientNavFacts = {
  // Le dernier message du fil vient d'EODA et attend une réponse.
  hasUnansweredMessage: boolean;
  // Rôle d'accès dans la structure (N9). null = aucune structure rattachée : les
  // pages le disent elles-mêmes, la navigation reste complète.
  accessRole: ClientAccessRole | null;
  // Livrables remis depuis la dernière ouverture de « Mes livrables »
  // (lib/actions/deliverables.ts). Ce qui est NOUVEAU se dérive de
  // `EstablishmentUser.deliverablesSeenAt` — aucune table de notifications.
  // Absent ou nul : rien à annoncer, aucune pastille.
  newDeliverablesCount?: number;
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
  people: "TERRAIN",
  surveys: "TERRAIN",
};

export function canSeeClientEntry(accessRole: ClientAccessRole | null, id: string): boolean {
  const entryModule = ENTRY_MODULE[id];
  if (!entryModule || !accessRole) return true;
  return clientAccessLevel(accessRole, entryModule) !== "NONE";
}

export function buildClientNav(facts: ClientNavFacts): NavItem[] {
  return allClientEntries(facts).filter((item) => canSeeClientEntry(facts.accessRole, item.id));
}

// Éteint le compteur des livrables. Appelée par la barre DÈS que « Mes livrables » est
// ouverte : le layout n'est pas rejoué d'une page du portail à l'autre, la pastille
// resterait donc affichée après la lecture. Au chargement suivant, c'est le fait
// enregistré (`markDeliverablesSeen`) qui la laisse éteinte — l'état client ne fait
// qu'éviter un aller-retour visible.
export function clearDeliverablesCount(items: readonly NavItem[]): NavItem[] {
  return items.map((item) => {
    if (item.id !== "deliverables" || !item.count) return item;
    const cleared = { ...item };
    delete cleared.count;
    delete cleared.countLabel;
    return cleared;
  });
}

// Le lecteur d'écran lit le libellé PUIS cette phrase : « Mes livrables, 3 nouveaux
// documents ». Un chiffre seul ne dit pas à quoi il se rapporte.
function unseenDeliverablesLabel(count: number): string {
  return count > 1 ? `${count} nouveaux documents` : "1 nouveau document";
}

function allClientEntries(facts: ClientNavFacts): NavItem[] {
  const newDeliverables = facts.newDeliverablesCount ?? 0;
  return [
    // Racine du portail = l'accueil (R6) : `exact` pour ne pas rester actif sur
    // toutes les autres pages.
    { id: "home", href: CLIENT_ROOT, label: "Accueil", icon: "home", exact: true },
    { id: "documents", href: CLIENT_DOCUMENTS_PATH, label: "Mes documents", icon: "documents" },
    // « Mon diagnostic » (N6) ; les questions sur les pratiques (N7) vivent dessous.
    { id: "diagnostic", href: CLIENT_DIAGNOSTIC_PATH, label: "Mon diagnostic", icon: "diagnostic" },
    // Tâches de la structure (N5) : celles qu'EODA ou la structure lui a confiées.
    { id: "tasks", href: CLIENT_TASKS_PATH, label: "Tâches", icon: "tasks" },
    {
      id: "deliverables",
      href: CLIENT_DELIVERABLES_PATH,
      label: "Mes livrables",
      icon: "deliverables",
      // Le SEUL compteur du portail client, et le seul qui s'éteigne à la lecture :
      // l'entrée est dans « Plus », donc le bouton « Plus » porte aussi le nombre
      // (splitClientNav.moreCount) — sans lui, personne ne saurait qu'il y a du nouveau.
      ...(newDeliverables > 0
        ? { count: newDeliverables, countLabel: unseenDeliverablesLabel(newDeliverables) }
        : {}),
    },
    { id: "progress", href: `${CLIENT_ROOT}/suivi`, label: "Mon suivi", icon: "progress" },
    {
      id: "messages",
      href: CLIENT_MESSAGES_PATH,
      label: "Messages",
      icon: "messages",
      ...(facts.hasUnansweredMessage ? { attentionLabel: "nouveau message" } : {}),
    },
    // « Mon équipe » (N10) : équipe et quiz de sensibilisation ; l'intervenant y voit
    // ses propres quiz.
    { id: "team", href: CLIENT_TEAM_PATH, label: "Mon équipe", icon: "staff" },
    // Lot C (terrain) : personnes accompagnées et enquêtes — direction et
    // responsable qualité. Données de santé : verrouillées tant que l'hébergement
    // n'est pas certifié HDS (les pages le disent).
    { id: "people", href: CLIENT_PEOPLE_PATH, label: "Personnes accompagnées", icon: "people" },
    { id: "surveys", href: CLIENT_SURVEYS_PATH, label: "Enquêtes", icon: "surveys" },
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
  // Somme des compteurs rangés DANS « Plus ». Sans elle, un livrable neuf serait
  // annoncé par une pastille que personne ne voit — le bouton est fermé.
  moreCount: number;
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
    moreCount: more.reduce((total, item) => total + (item.count ?? 0), 0),
  };
}
