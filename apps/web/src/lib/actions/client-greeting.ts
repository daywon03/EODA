"use server";

import { prisma } from "@eoda/database";
import { requireClientEstablishment } from "@/lib/auth/guards";
import { firstNameOf } from "@/lib/services/structures-overview-service";

// Prénom pour « Bonjour {prénom}. » sur l'accueil d'un rôle réduit (intervenant).
// Source, dans l'ordre : la fiche salarié liée au compte DANS SA structure (c'est le
// nom que la direction a saisi), sinon le nom du compte. Rien plutôt qu'un e-mail.
// L'établissement vient du lien du compte (garde), jamais de l'adresse.
export async function getClientGreetingName(): Promise<string | null> {
  const { userId, establishment } = await requireClientEstablishment("HOME");

  const staff = establishment
    ? await prisma.staffMember.findFirst({
        where: { userId, establishmentId: establishment.id, active: true },
        select: { displayName: true },
      })
    : null;
  if (staff) return firstNameOf(staff.displayName);

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  return firstNameOf(user?.name);
}
