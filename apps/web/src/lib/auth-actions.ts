"use server";

import { headers } from "next/headers";
import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import {
  clientIpFromHeaders,
  peekLoginThrottle,
} from "@/lib/security/login-throttle";

// Message unique pour tout échec d'authentification — ne jamais distinguer
// « email inconnu » de « mot de passe incorrect » : la différence permet d'énumérer
// les comptes existants.
const GENERIC_AUTH_ERROR = "Email ou mot de passe incorrect.";

// Cette action n'est QU'UNE INTERFACE. La limitation de débit et la journalisation des
// échecs vivent dans authorize() (cf. auth.ts) : c'est le seul point par lequel passent
// aussi les POST directs sur /api/auth/callback/credentials. On se contente ici de lire
// l'état du compteur — sans le consommer — pour afficher un message utile.
export async function loginAction(formData: FormData) {
  const email = (formData.get("email") as string | null)?.trim().toLowerCase() ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  if (!email || !password) return { error: GENERIC_AUTH_ERROR };

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
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

  redirect("/dashboard");
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
