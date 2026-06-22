"use server";

import { prisma } from "@eoda/database";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

async function requireCabinetSession() {
  const session = await auth();
  if (!session || session.user.role === "CLIENT_USER") redirect("/login");
  return session;
}

function generateTempPassword(): string {
  // 12 caractères alphanumériques — affiché une seule fois à Sandrine
  return randomBytes(9).toString("base64url").slice(0, 12);
}

export async function inviteClientUser(formData: FormData) {
  await requireCabinetSession();

  const establishmentId = formData.get("establishmentId") as string;
  const email = formData.get("email") as string;
  const name = formData.get("name") as string;
  const roleInEstablishment = formData.get("roleInEstablishment") as
    | "DIRECTEUR"
    | "COORDINATEUR"
    | "ASSISTANT_QUALITE"
    | "AUTRE";

  if (!establishmentId || !email || !name || !roleInEstablishment) {
    return { error: "Tous les champs sont obligatoires." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "Un compte existe déjà pour cette adresse email." };

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: "CLIENT_USER",
    },
  });

  await prisma.establishmentUser.create({
    data: {
      userId: user.id,
      establishmentId,
      roleInEstablishment,
    },
  });

  revalidatePath(`/dashboard/cabinet/etablissements/${establishmentId}`);

  // Retourner le mot de passe temp en clair — affiché une seule fois, jamais stocké
  return { success: true as const, tempPassword, userName: name, userEmail: email };
}
