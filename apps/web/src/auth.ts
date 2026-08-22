// Configuration complète Auth.js — Node.js uniquement (jamais importé dans middleware)
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@eoda/database";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import {
  clientIpFromHeaders,
  consumeLoginAttempt,
  resetLoginThrottle,
} from "@/lib/security/login-throttle";
import { recordAuditEvent } from "@/lib/services/audit-log-service";

// Empreinte bcrypt factice, de coût identique aux vraies. Comparer contre elle quand
// l'email est inconnu fait que la réponse prend le même temps que pour un compte
// existant : sans ça, la différence de latence permet d'énumérer les comptes, alors
// même que le message d'erreur est volontairement identique dans les deux cas.
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEe.7bY7QC0z0.KhOTfPYVWv0BFGKGe1qbe";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      // ⚠️ Ce point est le SEUL par lequel passent toutes les tentatives de connexion :
      // le formulaire via son action serveur, mais aussi un POST direct sur
      // /api/auth/callback/credentials, qui est une route publique. Tout contrôle de
      // sécurité sur la connexion doit donc vivre ici, et pas dans l'action serveur —
      // un contrôle placé dans l'interface est un contrôle contournable (vérifié : 12
      // tentatives en curl passaient quand la limitation vivait dans l'action).
      async authorize(credentials, request) {
        const email = (credentials?.email as string | undefined)?.trim().toLowerCase();
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const identity = { ip: clientIpFromHeaders(request.headers), email };
        if (!(await consumeLoginAttempt(identity))) return null;

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
          // Comparaison à vide volontaire — voir DUMMY_HASH ci-dessus.
          await bcrypt.compare(password, DUMMY_HASH);
          await recordAuditEvent({ action: "LOGIN_FAILED", detail: "compte inconnu" });
          return null;
        }

        if (!(await bcrypt.compare(password, user.passwordHash))) {
          await recordAuditEvent({
            action: "LOGIN_FAILED",
            actorUserId: user.id,
            actorRole: user.role,
            detail: "mot de passe incorrect",
          });
          return null;
        }

        // Compte désactivé : refusé APRÈS la comparaison bcrypt, jamais avant. Un
        // refus anticipé répondrait plus vite que pour un compte actif — la
        // différence de latence distinguerait « compte désactivé » de « mot de passe
        // faux », c'est-à-dire exactement l'oracle que DUMMY_HASH évite plus haut.
        // La révocation est portée en double : ici pour la connexion, et dans
        // lib/auth/guards.ts pour les sessions déjà ouvertes.
        if (!user.isActive) {
          await recordAuditEvent({
            action: "LOGIN_REFUSED_INACTIVE",
            actorUserId: user.id,
            actorRole: user.role,
            detail: "compte désactivé",
          });
          return null;
        }

        // Succès : le compteur repart de zéro pour que les erreurs de frappe d'un
        // utilisateur légitime ne s'accumulent pas jusqu'au blocage.
        await resetLoginThrottle(identity);

        // Le jeton ne porte que l'identifiant et le rôle — jamais l'objet utilisateur
        // complet. Le rôle qui sert à AUTORISER est de toute façon relu en base à
        // chaque contrôle (cf. lib/auth/guards.ts) ; celui du jeton ne sert qu'au
        // routage grossier dans le middleware, qui tourne en Edge et n'a pas la base.
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          // Porté dans le jeton pour que le middleware (Edge, sans base) puisse
          // router vers la page de rotation dès la première requête. L'autorisation
          // réelle reste faite en base par lib/auth/guards.ts.
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
});
