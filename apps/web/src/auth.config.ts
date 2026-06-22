// Sous-configuration Auth.js sans dépendances Node.js — safe pour Edge Runtime (middleware)
import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@eoda/database";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
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
