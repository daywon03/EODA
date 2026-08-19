// Sous-configuration Auth.js sans dépendances Node.js — safe pour Edge Runtime (middleware)
import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@eoda/database";

// Durée de vie de session volontairement courte pour un outil manipulant des données
// de santé/social : 8 heures couvrent une journée de travail (une visite sur site
// complète, cf. mode opératoire) sans laisser un poste partagé authentifié pendant
// des semaines. `updateAge` prolonge la session sur activité réelle, donc une
// journée de saisie continue n'est jamais interrompue.
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const SESSION_UPDATE_AGE_SECONDS = 60 * 60;

export const authConfig: NextAuthConfig = {
  // trustHost est nécessaire derrière le reverse proxy de l'hébergeur (l'URL vue par
  // l'application n'est pas l'URL publique). Sûr ici car l'hôte est maîtrisé et
  // NEXTAUTH_URL est fixé explicitement par environnement.
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
    updateAge: SESSION_UPDATE_AGE_SECONDS,
  },
  jwt: { maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: UserRole }).role;
        token.userId = user.id ?? "";
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.userId as string;
      session.user.role = token.role as UserRole;
      return session;
    },
  },
};
