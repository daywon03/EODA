import type { DevisStatus } from "@eoda/database";
import { isDevisSignable } from "./conversion-service";
import { formatDate } from "./date-format-service";

// Liste des devis (cabinet, maquette v2) — règles d'affichage pures.
//
// Les onglets REGROUPENT des statuts existants, ils n'en créent aucun : « En cours »
// = brouillons et envoyés. Un devis ANNULÉ n'apparaît que dans « Tous » (il garde
// son numéro, il sort de tout indicateur — cf. commercial-kpi-service).

export type DevisTab = "en-cours" | "signes" | "refuses" | "tous";

export const DEVIS_TABS: readonly { id: DevisTab; label: string; statuses: readonly DevisStatus[] | null }[] = [
  { id: "en-cours", label: "En cours", statuses: ["BROUILLON", "ENVOYE"] },
  { id: "signes", label: "Signés", statuses: ["SIGNE"] },
  { id: "refuses", label: "Refusés", statuses: ["REFUSE"] },
  { id: "tous", label: "Tous", statuses: null },
];

export const DEFAULT_DEVIS_TAB: DevisTab = "en-cours";

// Paramètre d'URL non fiable : toute valeur inconnue retombe sur l'onglet par défaut.
export function parseDevisTab(value: string | undefined): DevisTab {
  return DEVIS_TABS.find((t) => t.id === value)?.id ?? DEFAULT_DEVIS_TAB;
}

export function statusesForTab(tab: DevisTab): readonly DevisStatus[] | null {
  return DEVIS_TABS.find((t) => t.id === tab)?.statuses ?? null;
}

export function countDevisByTab(countsByStatus: Partial<Record<DevisStatus, number>>): Record<DevisTab, number> {
  const total = Object.values(countsByStatus).reduce((sum, n) => sum + (n ?? 0), 0);
  const sum = (statuses: readonly DevisStatus[] | null) =>
    statuses === null ? total : statuses.reduce((n, s) => n + (countsByStatus[s] ?? 0), 0);
  return {
    "en-cours": sum(statusesForTab("en-cours")),
    signes: sum(statusesForTab("signes")),
    refuses: sum(statusesForTab("refuses")),
    tous: total,
  };
}

// Gestes proposés sur une ligne. Aucun « Marquer signé » : la signature passe par
// le parcours de conversion (convertDevisToClient), qui crée la fiche, la mission
// et ouvre le portail — d'où un LIEN vers cet écran, jamais un bouton de statut.
export type DevisRowActions = { canSend: boolean; canSign: boolean };

export function devisRowActions(status: DevisStatus, contactEmail: string | null): DevisRowActions {
  return {
    // Mêmes conditions que la fiche du devis : brouillon ou déjà envoyé (renvoi),
    // et une adresse à qui l'envoyer.
    canSend: (status === "BROUILLON" || status === "ENVOYE") && Boolean(contactEmail),
    canSign: isDevisSignable(status),
  };
}

// « Créé le 01/10/2026 · valable jusqu'au 31/10/2026 », ou « expiré le … » pour un
// devis encore en attente dont la validité est passée. Un devis signé ou refusé n'a
// plus d'échéance utile : on ne dit que sa date de création.
export function describeDevisDates(input: {
  status: DevisStatus;
  createdAt: Date;
  validUntil: Date;
  now: Date;
}): string {
  const created = `Créé le ${formatDate(input.createdAt)}`;
  if (input.status !== "BROUILLON" && input.status !== "ENVOYE") return created;
  const expired = input.validUntil < input.now;
  return `${created} · ${expired ? "expiré le" : "valable jusqu'au"} ${formatDate(input.validUntil)}`;
}
