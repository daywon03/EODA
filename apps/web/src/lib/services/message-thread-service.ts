import type { MessageAuthorSide } from "@eoda/database";

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
