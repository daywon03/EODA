"use server";

import { headers } from "next/headers";
import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import {
  clientIpFromHeaders,
  peekLoginThrottle,
} from "@/lib/security/login-throttle";
import { isEmailNotVerifiedError } from "@/lib/auth/email-not-verified";
import { safeCallbackPath } from "@/lib/auth/routes";
import { UNVERIFIED_LOGIN_MESSAGE } from "@/lib/services/email-verification-service";

// Message unique pour tout échec d'authentification — ne jamais distinguer
// « email inconnu » de « mot de passe incorrect » : la différence permet d'énumérer
// les comptes existants.
const GENERIC_AUTH_ERROR = "Email ou mot de passe incorrect.";

// Cette action n'est QU'UNE INTERFACE. La limitation de débit et la journalisation des
// échecs vivent dans authorize() (cf. auth.ts) : c'est le seul point par lequel passent
// aussi les POST directs sur /api/auth/callback/credentials. On se contente ici de lire
// l'état du compteur — sans le consommer — pour afficher un message utile.
export type LoginResult = { error: string; unverifiedEmail?: string } | { redirectTo: string };

export async function loginAction(formData: FormData): Promise<LoginResult> {
  const email = (formData.get("email") as string | null)?.trim().toLowerCase() ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  if (!email || !password) return { error: GENERIC_AUTH_ERROR };

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      // Mot de passe juste, adresse pas encore confirmée (compte libre-service) : le
      // message le dit, et l'écran propose de renvoyer le lien à cette adresse.
      if (isEmailNotVerifiedError(error)) return { error: UNVERIFIED_LOGIN_MESSAGE, unverifiedEmail: email };

      // Lecture sans consommation : distinguer « identifiants faux » de « trop de
      // tentatives » côté message, sans fausser le comptage fait par authorize().
      const throttle = await peekLoginThrottle({
        ip: clientIpFromHeaders(await headers()),
        email,
      });

      if (throttle.blocked) {
        const minutes = Math.ceil(throttle.retryAfterSeconds / 60);
        return {
          error: `Trop de tentatives de connexion. Nouvel essai possible dans ${minutes} minute${minutes > 1 ? "s" : ""}.`,
        };
      }

      return { error: GENERIC_AUTH_ERROR };
    }
    throw error;
  }

  // Pas de redirect() d'action serveur : après une déconnexion forcée, le routeur
  // client resservait sa copie en cache de /dashboard (écran blanc, recette du
  // 13/10/2026). L'écran fait une navigation complète ; /dashboard aiguille par rôle.
  // La page demandée avant la connexion (`callbackUrl`) est reprise si — et
  // seulement si — c'est un chemin interne (safeCallbackPath, anti open-redirect).
  // Un chemin hors du portail du rôle est rattrapé par le middleware et les gardes.
  return { redirectTo: safeCallbackPath(formData.get("callbackUrl")) ?? "/dashboard" };
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
