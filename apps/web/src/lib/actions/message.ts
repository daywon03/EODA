"use server";

import { prisma, type MessageAuthorSide } from "@eoda/database";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireClientEstablishment, requireEstablishmentInTenant } from "@/lib/auth/guards";
import {
  canClientPostMessage,
  sortThread,
  validateMessageBody,
} from "@/lib/services/message-thread-service";
import { notifyNewMessage } from "@/lib/email/notifications";

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

async function readThread(establishmentId: string): Promise<ThreadMessage[]> {
  const messages = await prisma.missionMessage.findMany({
    where: { establishmentId },
    orderBy: { createdAt: "asc" },
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

// ── Côté cabinet ─────────────────────────────────────────────────────────────

export async function getCabinetThread(establishmentId: string): Promise<ThreadMessage[]> {
  await requireEstablishmentInTenant(establishmentId);
  return readThread(establishmentId);
}

export async function postCabinetMessage(
  establishmentId: string,
  _prevState: MessageResult | null,
  formData: FormData
): Promise<MessageResult> {
  const { tenantId, userId } = await requireEstablishmentInTenant(establishmentId);

  const raw = formData.get("body");
  const validation = validateMessageBody(typeof raw === "string" ? raw : null);
  if (!validation.ok) return { error: validation.error };

  const establishment = await prisma.establishment.findUnique({
    where: { id: establishmentId },
    select: { name: true },
  });
  if (!establishment) notFound();

  await prisma.missionMessage.create({
    data: {
      tenantId,
      establishmentId,
      authorUserId: userId,
      authorSide: "CABINET",
      body: validation.body,
    },
  });

  // L'e-mail ne fait jamais échouer l'écriture : le message est enregistré, la
  // notification est un plus (même règle que l'invitation client).
  await notifyNewMessage({
    tenantId,
    establishmentId,
    establishmentName: establishment.name,
    authorSide: "CABINET",
  });

  revalidatePath(cabinetPath(establishmentId));
  revalidatePath(CLIENT_PATH);
  return { ok: true };
}

// ── Côté client ──────────────────────────────────────────────────────────────

export async function getClientThread(): Promise<{
  establishmentName: string | null;
  messages: ThreadMessage[];
  canPost: boolean;
}> {
  const { establishment, missionAccess } = await requireClientEstablishment();
  if (!establishment) {
    return { establishmentName: null, messages: [], canPost: false };
  }

  return {
    establishmentName: establishment.name,
    messages: await readThread(establishment.id),
    canPost: canClientPostMessage(missionAccess),
  };
}

export async function postClientMessage(
  _prevState: MessageResult | null,
  formData: FormData
): Promise<MessageResult> {
  // Aucun identifiant reçu : l'établissement vient du lien de la session.
  const { establishment, missionAccess, userId } = await requireClientEstablishment();
  if (!establishment) return { error: "Aucun établissement n'est rattaché à votre compte." };

  // Refus porté par l'action, et pas seulement par l'absence de champ à l'écran.
  if (!canClientPostMessage(missionAccess)) {
    return { error: "Votre accès ne permet plus d'envoyer de message." };
  }

  const raw = formData.get("body");
  const validation = validateMessageBody(typeof raw === "string" ? raw : null);
  if (!validation.ok) return { error: validation.error };

  const link = await prisma.establishment.findUnique({
    where: { id: establishment.id },
    select: { tenantId: true, name: true },
  });
  if (!link) notFound();

  await prisma.missionMessage.create({
    data: {
      tenantId: link.tenantId,
      establishmentId: establishment.id,
      authorUserId: userId,
      authorSide: "CLIENT",
      body: validation.body,
    },
  });

  await notifyNewMessage({
    tenantId: link.tenantId,
    establishmentId: establishment.id,
    establishmentName: link.name,
    authorSide: "CLIENT",
  });

  revalidatePath(CLIENT_PATH);
  revalidatePath(cabinetPath(establishment.id));
  return { ok: true };
}
