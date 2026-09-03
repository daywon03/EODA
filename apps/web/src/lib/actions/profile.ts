"use server";

import { prisma } from "@eoda/database";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePasswordRotationSession } from "@/lib/auth/guards";
import { firstError, requiredString } from "@/lib/validation/form-parsers";
import { recordAuditEvent } from "@/lib/services/audit-log-service";

// ─────────────────────────────────────────────────────────────────────────────
// PROFIL — ce que chacun peut changer sur SON PROPRE compte.
//
// Ouvert aux trois rôles : un compte client doit pouvoir corriger son nom et son mot
// de passe sans écrire à la consultante, et la consultante sans toucher à la base.
//
// `requirePasswordRotationSession` et non une garde plus stricte : c'est la seule qui
// laisse entrer un compte dont le mot de passe temporaire n'a pas encore été changé —
// or c'est précisément ici qu'il va le changer. Une garde qui le refuserait
// l'enfermerait dehors de la page qui l'en sortirait.
//
// 🔐 UN SEUL CHAMP EST MODIFIABLE ICI, et ce n'est pas un oubli (règle S2). Le rôle,
// l'état actif, le tenant, le rattachement à un établissement et l'ADRESSE E-MAIL
// n'entrent pas dans ce parseur : ce sont des champs sensibles, et un endpoint
// self-service qui les accepterait suffirait à s'octroyer un rôle ou à détourner un
// compte. L'e-mail en particulier EST l'identifiant de connexion — le changer soi-même
// déplace le point d'entrée d'un compte sans qu'aucune vérification ne l'accompagne.
// Il reste affiché en lecture seule, et se change côté cabinet.
//
// Le mot de passe ne passe pas non plus par ici : il a son action dédiée
// (`lib/actions/password.ts`), avec limitation de débit, vérification du mot de passe
// courant et invalidation des sessions ouvertes.
// ─────────────────────────────────────────────────────────────────────────────

const PROFILE_PATH = "/dashboard/profil";

export type OwnProfile = {
  name: string;
  email: string;
  role: string;
  // Structures rattachées — vide côté cabinet, une (ou plusieurs) côté client. Sert à
  // répondre à « de quel espace suis-je en train de parler ? ».
  establishments: string[];
  mustChangePassword: boolean;
  passwordChangedAt: Date | null;
};

export async function getOwnProfile(): Promise<OwnProfile> {
  const { session } = await requirePasswordRotationSession();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      role: true,
      mustChangePassword: true,
      passwordChangedAt: true,
      establishmentUsers: { select: { establishment: { select: { name: true } } } },
    },
  });
  if (!user) redirect("/login");

  return {
    name: user.name,
    email: user.email,
    role: user.role,
    establishments: user.establishmentUsers.map((link) => link.establishment.name),
    mustChangePassword: user.mustChangePassword,
    passwordChangedAt: user.passwordChangedAt,
  };
}

export async function updateOwnProfile(
  _prevState: { error: string } | { ok: true } | null,
  formData: FormData
): Promise<{ error: string } | { ok: true }> {
  const { session } = await requirePasswordRotationSession();

  const name = requiredString(formData, "name", "Votre nom", 200);
  const error = firstError(name);
  if (error) return { error };
  if (!name.ok) return { error: "Formulaire invalide." };

  // `where: { id: session.user.id }` — l'identité vient du jeton vérifié, jamais du
  // formulaire. Un identifiant d'utilisateur posté serait une entrée non fiable.
  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: name.value },
  });

  await recordAuditEvent({
    action: "CLIENT_USER_UPDATED",
    actorUserId: session.user.id,
    actorRole: session.user.role,
    targetId: session.user.id,
    // Jamais la valeur : un nom est une donnée personnelle, et le journal d'audit ne
    // doit pas devenir lui-même un gisement à protéger.
    detail: "profil modifié par son titulaire",
  });

  revalidatePath(PROFILE_PATH);
  return { ok: true };
}
