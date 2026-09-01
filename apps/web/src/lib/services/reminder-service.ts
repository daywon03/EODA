import type { DocumentStatus } from "@eoda/database";

// ─────────────────────────────────────────────────────────────────────────────
// RELANCE DES PIÈCES MANQUANTES — quoi relancer, et quand ça n'a pas de sens.
//
// §12.5 demande des « relances automatiques des clients qui ne fournissent pas ».
// §12.7 constate que les DÉLAIS, la CADENCE et la condition d'arrêt n'ont jamais été
// spécifiés. Ce fichier livre donc la relance, pas l'automate : c'est Sandrine qui
// déclenche. Un automate dont personne n'a fixé le rythme est soit inutile, soit
// harcelant, et le rythme n'est pas une décision de développeur.
//
// Ce qu'on relance : les pièces MANQUANTES et non justifiées. Une pièce dont le
// client a déjà répondu « nous n'en avons pas » n'est pas un oubli, c'est une
// réponse : la relancer donnerait le sentiment de ne pas être lu, et c'est le
// meilleur moyen de ne plus être lu en retour.
//
// Règles PURES : ni Prisma, ni e-mail.
// ─────────────────────────────────────────────────────────────────────────────

export type ReminderCandidate = {
  label: string;
  status: DocumentStatus;
  missingJustification: string | null;
  // Réclamé au client, ou produit par EODA (`DocumentType.requestedFromClient`).
  // Relancer une structure sur un document que le cabinet doit produire serait lui
  // réclamer le travail qu'elle a acheté.
  requestedFromClient: boolean;
};

export function selectReminderLabels(items: readonly ReminderCandidate[]): string[] {
  return items
    .filter((item) => item.requestedFromClient)
    .filter((item) => item.status === "MISSING")
    .filter((item) => item.missingJustification === null)
    .map((item) => item.label);
}

export type ReminderEligibility = { ok: true; labels: string[] } | { ok: false; error: string };

// Deux refus, et ils ne disent pas la même chose.
export function checkReminderEligibility(input: {
  items: readonly ReminderCandidate[];
  depositOpen: boolean;
}): ReminderEligibility {
  // Mission close ou accès révoqué : plus rien ne se dépose. Relancer quelqu'un sur
  // un espace qui refuse ses dépôts, c'est l'envoyer se cogner à une porte fermée.
  if (!input.depositOpen) {
    return {
      ok: false,
      error: "L'accompagnement est terminé : aucun dépôt n'est possible, une relance n'aurait pas de sens.",
    };
  }

  const labels = selectReminderLabels(input.items);
  if (labels.length === 0) {
    return { ok: false, error: "Aucune pièce réclamée ne manque : il n'y a rien à relancer." };
  }

  return { ok: true, labels };
}

// Phrase de retour, après envoi. Elle DIT le nombre de destinataires : une relance
// « envoyée » sans plus de précision laisse croire que le client l'a reçue alors que
// personne n'était rattaché à l'établissement.
export function describeReminderOutcome(input: { sent: number; total: number }): string {
  if (input.total === 0) {
    return "Aucun interlocuteur n'est rattaché à cette structure : personne n'a pu être relancé.";
  }
  if (input.sent === 0) {
    return "Envoi impossible pour l'instant : la relance n'est partie chez personne.";
  }
  if (input.sent < input.total) {
    return `Relance envoyée à ${input.sent} interlocuteur(s) sur ${input.total}.`;
  }
  return `Relance envoyée à ${input.sent} interlocuteur${input.sent > 1 ? "s" : ""}.`;
}
