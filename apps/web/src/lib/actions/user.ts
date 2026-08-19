"use server";

import { prisma, EstablishmentUserRole } from "@eoda/database";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { requireEstablishmentInTenant } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { firstError, requiredEmail, requiredEnum, requiredString } from "@/lib/validation/form-parsers";

const BCRYPT_COST = 12;

function generateTempPassword(): string {
  // 16 caractères issus de 12 octets aléatoires cryptographiques — affiché une
  // seule fois à l'utilisateur Cabinet, jamais stocké en clair.
  return randomBytes(12).toString("base64url").slice(0, 16);
}

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

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_COST);

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

  revalidatePath(`/dashboard/cabinet/etablissements/${establishmentId}`);

  // Mot de passe temporaire retourné en clair — affiché une seule fois, jamais
  // stocké ni journalisé (il n'apparaît volontairement pas dans l'audit ci-dessus).
  return {
    success: true,
    tempPassword,
    userName: name.value,
    userEmail: email.value,
  };
}
