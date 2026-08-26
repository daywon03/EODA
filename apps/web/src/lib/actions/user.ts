"use server";

import { prisma, EstablishmentUserRole } from "@eoda/database";
import { requireEstablishmentInTenant } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { firstError, requiredEmail, requiredEnum, requiredString } from "@/lib/validation/form-parsers";
import { generateTemporaryPassword, hashPassword } from "@/lib/security/password-hashing";

export type InviteClientUserResult =
  | { success: true; tempPassword: string; userName: string; userEmail: string }
  | { error: string };

export async function inviteClientUser(formData: FormData): Promise<InviteClientUserResult> {
  const establishmentIdRaw = formData.get("establishmentId");
  if (typeof establishmentIdRaw !== "string" || establishmentIdRaw.length === 0) {
    return { error: "Établissement manquant." };
  }

  // Contrôle déterminant : l'établissement doit appartenir au tenant de l'appelant.
  // Sans ce contrôle, un utilisateur Cabinet pouvait créer un compte client rattaché
  // à l'établissement d'un autre cabinet, et donc ouvrir un accès à ses données.
  const { establishmentId, session, userId } = await requireEstablishmentInTenant(
    establishmentIdRaw
  );

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

  const existing = await prisma.user.findUnique({ where: { email: email.value } });
  if (existing) return { error: "Un compte existe déjà pour cette adresse email." };

  const tempPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(tempPassword);

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
        // Explicite bien que ce soit aussi le défaut du schéma : le mot de passe
        // ci-dessous est transmis de vive voix ou par messagerie, il ne doit pas
        // survivre à la première connexion (cf. specs/02-architecture-technique.md §4.10).
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
  // du composant client est perdu, donc le panneau qui affiche le mot de passe
  // temporaire. Observé précisément : le compte était créé, et Sandrine ne voyait
  // jamais le mot de passe — qui n'est affiché qu'une fois et n'est stocké nulle part.
  //
  // Le rafraîchissement de la liste des interlocuteurs se fait donc côté composant,
  // par `router.refresh()`, juste après l'affichage du panneau : contrairement à
  // `revalidatePath`, il re-rend l'arbre serveur en conservant l'état React du client.
  // Sans lui, le compte créé n'apparaissait dans la liste qu'après un rechargement
  // manuel de la page.

  // Mot de passe temporaire retourné en clair — affiché une seule fois, jamais
  // stocké ni journalisé (il n'apparaît volontairement pas dans l'audit ci-dessus).
  // Il ne vaut que pour la première connexion : le compte est créé avec
  // `mustChangePassword`, la plateforme exige une rotation avant tout autre accès.
  return {
    success: true,
    tempPassword,
    userName: name.value,
    userEmail: email.value,
  };
}
