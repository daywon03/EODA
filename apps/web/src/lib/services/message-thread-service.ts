import type { MessageAuthorSide } from "@eoda/database";
import { formatDayHeading } from "./date-format-service";

// ─────────────────────────────────────────────────────────────────────────────
// FIL D'ÉCHANGE MISSION ↔ CLIENT — règles pures.
//
// CDC §5 : « fil d'échange léger consultante ↔ client rattaché à la mission, pour
// limiter les allers-retours par e-mail ». Priorité « souhaitable », d'où le mot
// LÉGER : un fil par établissement, aucune pièce jointe (les documents ont leur
// propre dépôt, versionné, analysé et journalisé), aucune conversation par document.
//
// Deux choses vivent ici parce qu'elles n'ont rien à faire dans un composant :
// qui a le droit d'écrire selon l'état de la mission, et comment un message vide se
// distingue d'un message trop long.
//
// Ni Prisma, ni React.
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_MESSAGE_LENGTH = 4000;

export const AUTHOR_SIDE_LABELS: Record<MessageAuthorSide, string> = {
  CABINET: "EODA Conseil",
  CLIENT: "Votre structure",
};

export type MessageValidation = { ok: true; body: string } | { ok: false; error: string };

export function validateMessageBody(raw: string | null): MessageValidation {
  const body = (raw ?? "").trim();
  if (body.length === 0) return { ok: false, error: "Le message est vide." };
  if (body.length > MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      error: `Le message est trop long (${MAX_MESSAGE_LENGTH} caractères maximum).`,
    };
  }
  return { ok: true, body };
}

// Le client peut-il écrire ? Non quand son accès est révoqué — il ne voit alors plus
// rien du tout. En bibliothèque (mission clôturée, lecture seule), OUI : c'est
// précisément le moment où il écrit pour demander une mise à jour, et §12.5 est
// explicite — « on ne coupe pas leur accès, on leur préconise de s'abonner ». Un fil
// coupé à la clôture renverrait cette demande vers l'e-mail, c'est-à-dire vers le
// problème que ce fil existe pour régler.
export function canClientPostMessage(accessState: "ACTIVE" | "LIBRARY" | "REVOKED"): boolean {
  return accessState !== "REVOKED";
}

// Nom affiché de l'auteur. Le nom du compte quand il existe, sinon le côté : un
// message signé d'une chaîne vide donne l'impression que personne ne l'a écrit.
export function displayAuthor(input: {
  authorName: string | null;
  authorSide: MessageAuthorSide;
}): string {
  const name = input.authorName?.trim();
  if (name && name.length > 0) return name;
  return AUTHOR_SIDE_LABELS[input.authorSide];
}

// Le fil se lit du plus ANCIEN au plus récent, contrairement à l'historique d'un
// prospect : on lit une conversation dans l'ordre où elle a eu lieu, et le champ de
// saisie est en bas, là où on l'attend.
export function sortThread<T extends { createdAt: Date }>(messages: readonly T[]): T[] {
  return [...messages].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

// Y a-t-il quelque chose de nouveau depuis la dernière visite de CE côté ? Réponse
// approchée et volontairement grossière : le dernier message vient-il de l'autre
// côté ? On évite ainsi une table de lectures par utilisateur — et un compteur de non
// lus faux serait pire qu'aucun compteur.
export function hasUnansweredMessage(
  messages: readonly { authorSide: MessageAuthorSide }[],
  viewerSide: MessageAuthorSide
): boolean {
  const last = messages[messages.length - 1];
  if (!last) return false;
  return last.authorSide !== viewerSide;
}

// ─────────────────────────────────────────────────────────────────────────────
// LECTURE DU FIL — groupement par jour et par prise de parole.
//
// Un fil qui répète « Jean Dupont · 03/09/2026 » au-dessus de chaque message devient
// illisible au dixième : l'information la plus utile dans une conversation n'est pas
// la date, c'est l'HEURE et le changement d'interlocuteur. La date remonte donc en
// séparateur de journée, et l'en-tête d'auteur ne réapparaît qu'à un vrai changement.
//
// Règles PURES, `now` injecté : une frise calculée à partir de `new Date()` ne se
// teste pas, et « Aujourd'hui » deviendrait faux à minuit sans que rien ne le dise.
// ─────────────────────────────────────────────────────────────────────────────

// Clé de journée en heure LOCALE. `toISOString()` convertit en UTC et rangerait un
// message de 23 h 30 dans la journée du lendemain.
export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

// « Aujourd'hui », « Hier », sinon la date en toutes lettres. Les deux premiers ne
// sont pas de la coquetterie : ils répondent à la seule question qu'on se pose en
// ouvrant un fil — est-ce que ça vient de bouger ?
export function relativeDayHeading(date: Date, now: Date): string {
  const today = dayKey(now);
  if (dayKey(date) === today) return "Aujourd'hui";

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayKey(date) === dayKey(yesterday)) return "Hier";

  return formatDayHeading(date);
}

export type MessageDayGroup<T> = { key: string; heading: string; messages: T[] };

export function groupMessagesByDay<T extends { createdAt: Date }>(
  messages: readonly T[],
  now: Date
): MessageDayGroup<T>[] {
  const groups: MessageDayGroup<T>[] = [];

  for (const message of messages) {
    const key = dayKey(message.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.messages.push(message);
      continue;
    }
    groups.push({ key, heading: relativeDayHeading(message.createdAt, now), messages: [message] });
  }

  return groups;
}

// Deux messages du même auteur à quelques minutes d'intervalle sont UNE prise de
// parole : c'est souvent la même phrase coupée en deux. Le seuil est bas — cinq
// minutes — parce qu'au-delà, la reprise mérite d'être signalée.
const SAME_BLOCK_WINDOW_MS = 5 * 60 * 1000;

export function startsNewBlock(
  message: { authorSide: MessageAuthorSide; authorName: string | null; createdAt: Date },
  previous: { authorSide: MessageAuthorSide; authorName: string | null; createdAt: Date } | undefined
): boolean {
  if (!previous) return true;
  if (previous.authorSide !== message.authorSide) return true;
  // Deux personnes DIFFÉRENTES du même côté : masquer le second nom laisserait croire
  // que la directrice a écrit ce que sa secrétaire a écrit.
  if (previous.authorName !== message.authorName) return true;
  return message.createdAt.getTime() - previous.createdAt.getTime() > SAME_BLOCK_WINDOW_MS;
}
