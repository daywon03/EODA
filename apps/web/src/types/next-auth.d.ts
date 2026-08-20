import type { DefaultSession } from "next-auth";
import type { UserRole } from "@eoda/database";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      // Drapeau de rotation, tel qu'il était À LA CONNEXION. Sert au routage grossier
      // du middleware (Edge, sans base). La vérité fait foi en base, relue à chaque
      // contrôle par lib/auth/guards.ts.
      mustChangePassword: boolean;
      // Horodatage de la connexion effective, posé une seule fois et conservé à
      // travers les rotations de jeton d'Auth.js. Comparé à `User.passwordChangedAt`
      // par les gardes : une session ouverte AVANT un changement de mot de passe est
      // refusée. `null` pour un jeton émis avant l'introduction de la revendication.
      authAt: number | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    mustChangePassword?: boolean;
  }
}

// next-auth v5 (Auth.js) — JWT type is from @auth/core/jwt
declare module "@auth/core/jwt" {
  interface JWT {
    role: UserRole;
    userId: string;
    mustChangePassword?: boolean;
    authAt?: number;
  }
}
