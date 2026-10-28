"use server";

import { prisma, EstablishmentUserRole } from "@eoda/database";
import { requireEstablishmentInTenant } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { firstError, requiredEmail, requiredEnum, requiredString } from "@/lib/validation/form-parsers";
import { generateTemporaryPassword, hashPassword } from "@/lib/security/password-hashing";
import { sendClientInvitationEmail } from "@/lib/email/notifications";
import type { InvitationDelivery } from "@/lib/services/email-delivery-service";
import { issuePasswordSetupLink } from "@/lib/db/password-setup-tokens";
import { setupLinkToShow } from "@/lib/services/password-setup-service";
import {
  decideExistingAccount,
  describeExistingAccount,
  type ExistingAccountDecision,
  type ExistingAccountFacts,
} from "@/lib/services/existing-account-service";

export type InviteClientUserResult =
  | {
      success: true;
      // Lien de création du mot de passe, rendu SEULEMENT si l'e-mail n'est pas parti
      // (Sandrine le transmet alors elle-même) ; null sinon.
      setupLink: string | null;
      userName: string;
      userEmail: string;
      // L'e-mail d'invitation est-il parti ? Rendu à l'écran plutôt que supposé.
      invitationDelivery: InvitationDelivery;
    }
  | { error: string }
  // Le compte existe, dans ce cabinet seulement : le cabinet peut le rattacher ici
  // (`linkExistingClientUser`) au lieu d'en créer un second.
  | { error: string; linkableEmail: string };

// Ce qu'on sait d'un compte existant, pour la décision pure. Lecture étroite : jamais
// le nom ni l'empreinte, seulement le rôle, l'état et les structures rattachées.
async function loadExistingAccount(email: string): Promise<ExistingAccountFacts | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      role: true,
      isActive: true,
      tenantId: true,
      establishmentUsers: {
        select: {
          establishmentId: true,
          revokedAt: true,
          establishment: { select: { name: true, tenantId: true } },
        },
      },
    },
  });
  if (!user) return null;
  return {
    role: user.role,
    isActive: user.isActive,
    tenantId: user.tenantId,
    links: user.establishmentUsers.map((link) => ({
      establishmentId: link.establishmentId,
      establishmentName: link.establishment.name,
      tenantId: link.establishment.tenantId,
      revoked: Boolean(link.revokedAt),
    })),
  };
}

function existingAccountError(decision: ExistingAccountDecision, email: string): InviteClientUserResult {
  const message = describeExistingAccount(decision) ?? "Formulaire invalide.";
  return decision.kind === "LINKABLE" ? { error: message, linkableEmail: email } : { error: message };
}

export async function inviteClientUser(formData: FormData): Promise<InviteClientUserResult> {
  const establishmentIdRaw = formData.get("establishmentId");
  if (typeof establishmentIdRaw !== "string" || establishmentIdRaw.length === 0) {
    return { error: "Établissement manquant." };
  }

  // Contrôle déterminant : l'établissement doit appartenir au tenant de l'appelant.
  // Sans ce contrôle, un utilisateur Cabinet pouvait créer un compte client rattaché
  // à l'établissement d'un autre cabinet, et donc ouvrir un accès à ses données.
  const { establishmentId, session, userId, tenantId } = await requireEstablishmentInTenant(
    establishmentIdRaw,
    "WRITE"
  );

  const establishment = await prisma.establishment.findUnique({
    where: { id: establishmentId },
    select: { name: true },
  });

  const email = requiredEmail(formData, "email", "L'adresse email");
  const name = requiredString(formData, "name", "Le nom", 120);
  const roleInEstablishment = requiredEnum(
    formData,
    "roleInEstablishment",
    "Le rôle dans l'établissement",
    EstablishmentUserRole
  );

  const error = firstError(email, name, roleInEstablishment);
  if (error) return { error };
  if (!email.ok || !name.ok || !roleInEstablishment.ok) return { error: "Formulaire invalide." };

  // Compte déjà là : on dit OÙ seulement s'il ne touche que ce cabinet
  // (existing-account-service) — sinon la phrase opaque, sans oracle d'existence.
  const decision = decideExistingAccount(await loadExistingAccount(email.value), {
    establishmentId,
    tenantId,
  });
  if (decision.kind !== "NONE") return existingAccountError(decision, email.value);

  // Un mot de passe aléatoire que PERSONNE ne connaît (audit du 28/10/2026) : la
  // personne choisit le sien par le lien envoyé ci-dessous. Rien ne s'affiche ni ne
  // part par e-mail en clair.
  const passwordHash = await hashPassword(generateTemporaryPassword());

  // Création du compte et du rattachement dans la même transaction : un User
  // CLIENT_USER sans lien EstablishmentUser serait un compte qui peut se connecter
  // sans voir aucun établissement — état incohérent à ne jamais laisser persister.
  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: email.value,
        name: name.value,
        passwordHash,
        role: "CLIENT_USER",
        // Aucun mot de passe utilisable tant que la personne n'a pas choisi le sien
        // par le lien ; celui-ci lève l'obligation de changement.
        mustChangePassword: true,
        passwordChangedAt: null,
      },
    });

    await tx.establishmentUser.create({
      data: {
        userId: user.id,
        establishmentId,
        roleInEstablishment: roleInEstablishment.value,
      },
    });

    return user;
  });

  await recordAuditEvent({
    action: "CLIENT_USER_INVITED",
    actorUserId: userId,
    actorRole: session.user.role,
    establishmentId,
    targetId: created.id,
    detail: roleInEstablishment.value,
  });

  // PAS de revalidatePath ici, volontairement — et vérifié en pilotant l'application.
  // La revalidation rejoue le rendu serveur de la fiche et remplace l'arbre : l'état
  // du composant client est perdu, donc le panneau qui affiche le résultat. Le
  // rafraîchissement de la liste se fait côté composant, par `router.refresh()`.

  // Le lien de création du mot de passe part par e-mail APRÈS l'audit et hors
  // transaction : un e-mail qui échoue n'annule pas la création du compte. Il n'est
  // montré à l'écran que s'il n'est PAS parti (setupLinkToShow), jamais journalisé.
  const setupUrl = await issuePasswordSetupLink(created.id);
  const invitationDelivery = await sendClientInvitationEmail({
    recipientName: name.value,
    email: email.value,
    setupUrl,
    establishmentName: establishment?.name ?? "votre structure",
  });
  await recordAuditEvent({ action: "PASSWORD_SETUP_LINK_SENT", actorUserId: userId, establishmentId, targetId: created.id, detail: `invitation · ${invitationDelivery}` });

  return {
    success: true,
    setupLink: setupLinkToShow(invitationDelivery, setupUrl),
    userName: name.value,
    userEmail: email.value,
    invitationDelivery,
  };
}

// ── Rattacher un compte EXISTANT à une autre structure du même cabinet ────────
// Le cas du directeur de deux SAD accompagnés (retours du 15 et du 22/09). Geste
// cabinet, gardé par `requireEstablishmentInTenant`. L'adresse est relue et la
// décision recalculée ICI : l'écran ne fait que proposer, il ne prouve rien. Aucun
// mot de passe n'est créé ni réinitialisé — le compte garde le sien.
export async function linkExistingClientUser(
  formData: FormData
): Promise<{ success: true } | { error: string }> {
  const establishmentIdRaw = formData.get("establishmentId");
  if (typeof establishmentIdRaw !== "string" || establishmentIdRaw.length === 0) {
    return { error: "Établissement manquant." };
  }
  const { establishmentId, session, userId, tenantId } = await requireEstablishmentInTenant(
    establishmentIdRaw,
    "WRITE"
  );

  const email = requiredEmail(formData, "email", "L'adresse email");
  const roleInEstablishment = requiredEnum(
    formData,
    "roleInEstablishment",
    "Le rôle dans l'établissement",
    EstablishmentUserRole
  );
  const error = firstError(email, roleInEstablishment);
  if (error) return { error };
  if (!email.ok || !roleInEstablishment.ok) return { error: "Formulaire invalide." };

  const decision = decideExistingAccount(await loadExistingAccount(email.value), {
    establishmentId,
    tenantId,
  });
  if (decision.kind !== "LINKABLE") {
    return { error: describeExistingAccount(decision) ?? "Aucun compte à rattacher pour cette adresse." };
  }

  const user = await prisma.user.findUnique({ where: { email: email.value }, select: { id: true } });
  if (!user) return { error: "Aucun compte à rattacher pour cette adresse." };

  // Un lien retiré auparavant est RÉTABLI (le retrait ne supprime plus la ligne) ;
  // sinon il est créé.
  await prisma.establishmentUser.upsert({
    where: { userId_establishmentId: { userId: user.id, establishmentId } },
    create: { userId: user.id, establishmentId, roleInEstablishment: roleInEstablishment.value },
    update: { revokedAt: null, roleInEstablishment: roleInEstablishment.value },
  });

  await recordAuditEvent({
    action: "CLIENT_USER_LINKED",
    actorUserId: userId,
    actorRole: session.user.role,
    establishmentId,
    targetId: user.id,
    detail: roleInEstablishment.value,
  });

  return { success: true };
}
