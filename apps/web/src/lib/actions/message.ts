"use server";

import { prisma, type MessageAuthorSide } from "@eoda/database";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  requireCabinetSession,
  requireClientEstablishment,
  requireEstablishmentInTenant,
  structureScopeWhere,
} from "@/lib/auth/guards";
import {
  canClientPostMessage,
  hasUnansweredMessage,
  MESSAGE_RATE_LIMIT,
  shouldNotifyNewMessage,
  sortThread,
  THREAD_MAX_MESSAGES,
  validateMessageBody,
} from "@/lib/services/message-thread-service";
import { notifyNewMessage } from "@/lib/email/notifications";
import { consumeThrottledAttempt } from "@/lib/security/attempt-throttle";
import { recordAuditEvent } from "@/lib/services/audit-log-service";

// ─────────────────────────────────────────────────────────────────────────────
// FIL D'ÉCHANGE MISSION ↔ CLIENT (CDC §5).
//
// Deux entrées, deux gardes, et c'est volontaire :
//   - le CABINET passe par `requireEstablishmentInTenant` et désigne un
//     établissement ;
//   - le CLIENT passe par `requireClientEstablishment`, qui résout SON établissement
//     depuis le lien `EstablishmentUser` de sa session. Un client ne fournit jamais
//     d'identifiant d'établissement : il n'y a donc rien à falsifier de ce côté.
//
// Fusionner les deux « puisque c'est le même fil » obligerait à accepter un
// `establishmentId` du client, et à le vérifier — c'est-à-dire à récréer à la main un
// cloisonnement que la session donne gratuitement.
//
// APPEND-ONLY : ni modification, ni suppression, aucune action pour le faire.
// ─────────────────────────────────────────────────────────────────────────────

export type ThreadMessage = {
  id: string;
  authorSide: MessageAuthorSide;
  authorName: string | null;
  body: string;
  createdAt: Date;
};

export type MessageResult = { ok: true } | { error: string };

const CLIENT_PATH = "/dashboard/client/echanges";

function cabinetPath(establishmentId: string): string {
  return `/dashboard/cabinet/etablissements/${establishmentId}/echanges`;
}

// Les derniers messages du fil (THREAD_MAX_MESSAGES), remis dans l'ordre de lecture.
async function readThread(establishmentId: string): Promise<ThreadMessage[]> {
  const messages = await prisma.missionMessage.findMany({
    where: { establishmentId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: THREAD_MAX_MESSAGES,
    select: {
      id: true,
      authorSide: true,
      body: true,
      createdAt: true,
      // Le NOM de l'auteur seulement — jamais l'objet User, qui ferait traverser
      // e-mail et empreinte de mot de passe jusqu'au composant (D2).
      author: { select: { name: true } },
    },
  });

  return sortThread(
    messages.map((message) => ({
      id: message.id,
      authorSide: message.authorSide,
      authorName: message.author.name,
      body: message.body,
      createdAt: message.createdAt,
    }))
  );
}

// ── Écriture : une seule porte pour les deux côtés ───────────────────────────
//
// Appelée APRÈS la garde de chaque côté. Audit du 28/10/2026 : débit borné par
// personne (sinon un compte inonde l'autre côté d'e-mails), message journalisé sans
// son texte, un seul e-mail par prise de parole.
async function postMessage(input: {
  side: MessageAuthorSide;
  tenantId: string;
  establishmentId: string;
  establishmentName: string;
  userId: string;
  formData: FormData;
}): Promise<MessageResult> {
  const raw = input.formData.get("body");
  const validation = validateMessageBody(typeof raw === "string" ? raw : null);
  if (!validation.ok) return { error: validation.error };

  const allowed = await consumeThrottledAttempt({
    key: `message:${input.userId}`,
    policy: MESSAGE_RATE_LIMIT,
    auditAction: "MISSION_MESSAGE_RATE_LIMITED",
    actorUserId: input.userId,
  });
  if (!allowed) return { error: "Vous avez envoyé beaucoup de messages en peu de temps. Réessayez dans quelques minutes." };

  const previous = await prisma.missionMessage.findFirst({
    where: { establishmentId: input.establishmentId },
    orderBy: { createdAt: "desc" },
    select: { authorSide: true, createdAt: true },
  });

  const message = await prisma.missionMessage.create({
    data: {
      tenantId: input.tenantId,
      establishmentId: input.establishmentId,
      authorUserId: input.userId,
      authorSide: input.side,
      body: validation.body,
    },
    select: { id: true },
  });

  // Le côté, jamais le texte : il peut évoquer une personne accompagnée.
  await recordAuditEvent({
    action: "MISSION_MESSAGE_POSTED",
    actorUserId: input.userId,
    establishmentId: input.establishmentId,
    targetId: message.id,
    detail: input.side,
  });

  // L'e-mail ne fait jamais échouer l'écriture : le message est enregistré, la
  // notification est un plus (même règle que l'invitation client).
  if (shouldNotifyNewMessage(previous, input.side, new Date())) {
    await notifyNewMessage({
      tenantId: input.tenantId,
      establishmentId: input.establishmentId,
      establishmentName: input.establishmentName,
      authorSide: input.side,
    });
  }

  revalidatePath(cabinetPath(input.establishmentId));
  revalidatePath(CLIENT_PATH);
  return { ok: true };
}

// ── Côté cabinet ─────────────────────────────────────────────────────────────

export async function getCabinetThread(establishmentId: string): Promise<ThreadMessage[]> {
  await requireEstablishmentInTenant(establishmentId, "READ");
  return readThread(establishmentId);
}

export async function postCabinetMessage(
  establishmentId: string,
  _prevState: MessageResult | null,
  formData: FormData
): Promise<MessageResult> {
  const { tenantId, userId } = await requireEstablishmentInTenant(establishmentId, "WRITE");

  const establishment = await prisma.establishment.findUnique({
    where: { id: establishmentId },
    select: { name: true },
  });
  if (!establishment) notFound();

  return postMessage({ side: "CABINET", tenantId, establishmentId, establishmentName: establishment.name, userId, formData });
}

// ── Côté client ──────────────────────────────────────────────────────────────

export async function getClientThread(): Promise<{
  establishmentName: string | null;
  messages: ThreadMessage[];
  canPost: boolean;
}> {
  const { establishment, missionAccess } = await requireClientEstablishment({ module: "MESSAGES", mode: "READ" });
  if (!establishment) {
    return { establishmentName: null, messages: [], canPost: false };
  }

  return {
    establishmentName: establishment.name,
    messages: await readThread(establishment.id),
    canPost: canClientPostMessage(missionAccess),
  };
}

// Badge de la barre de navigation ("Mes échanges") : le dernier mot du fil
// vient-il du cabinet ? Une seule ligne lue, pas tout le fil — ce n'est pas la
// page du fil, juste un indicateur affiché sur chaque écran du portail.
export async function getClientHasUnansweredMessage(): Promise<boolean> {
  const { establishment } = await requireClientEstablishment({ module: "MESSAGES", mode: "READ" });
  if (!establishment) return false;

  const last = await prisma.missionMessage.findFirst({
    where: { establishmentId: establishment.id },
    orderBy: { createdAt: "desc" },
    select: { authorSide: true },
  });
  if (!last) return false;

  return hasUnansweredMessage([last], "CLIENT");
}

// Symétrique côté CABINET, mais pour PLUSIEURS établissements à la fois — un
// évaluateur suit un portefeuille entier, pas un seul fil. Même logique
// approchée que côté client : le dernier message vient-il de l'autre côté ?
// Aucune table de lectures par utilisateur (cf. message-thread-service.ts).
//
// « Il faut qu'il y ait des notifications dans l'app » (Damon, 20/09/2026) — ce
// signal existait déjà côté client depuis le 01/09, jamais étendu au cabinet :
// un message client pouvait rester sans réponse sans qu'aucun signal visuel ne
// le dise, seul l'e-mail (notifyNewMessage) le portait.
//
// Une ligne par établissement (`distinct` + tri composé établissement/date
// décroissante = la plus récente en tête de chaque groupe), jamais une ligne
// par message : borné au nombre d'établissements du tenant, pas à l'historique
// des conversations (P5/P7).
export async function getEstablishmentIdsWithUnansweredMessage(): Promise<Set<string>> {
  const context = await requireCabinetSession("STRUCTURES_READ");

  const latestPerEstablishment = await prisma.missionMessage.findMany({
    where: { tenantId: context.tenantId, establishment: structureScopeWhere(context) },
    distinct: ["establishmentId"],
    orderBy: [{ establishmentId: "asc" }, { createdAt: "desc" }],
    select: { establishmentId: true, authorSide: true },
  });

  return new Set(
    latestPerEstablishment
      .filter((message) => hasUnansweredMessage([message], "CABINET"))
      .map((message) => message.establishmentId)
  );
}

export async function postClientMessage(
  _prevState: MessageResult | null,
  formData: FormData
): Promise<MessageResult> {
  // Aucun identifiant reçu : l'établissement vient du lien de la session.
  const { establishment, missionAccess, userId } = await requireClientEstablishment({ module: "MESSAGES", mode: "WRITE" });
  if (!establishment) return { error: "Aucun établissement n'est rattaché à votre compte." };

  // Refus porté par l'action, et pas seulement par l'absence de champ à l'écran.
  if (!canClientPostMessage(missionAccess)) {
    return { error: "Votre accès ne permet plus d'envoyer de message." };
  }

  const link = await prisma.establishment.findUnique({
    where: { id: establishment.id },
    select: { tenantId: true, name: true },
  });
  if (!link) notFound();

  return postMessage({ side: "CLIENT", tenantId: link.tenantId, establishmentId: establishment.id, establishmentName: link.name, userId, formData });
}
