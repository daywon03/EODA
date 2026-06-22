import type { DefaultSession } from "next-auth";
import type { UserRole } from "@eoda/database";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
  }
}

// next-auth v5 (Auth.js) — JWT type is from @auth/core/jwt
declare module "@auth/core/jwt" {
  interface JWT {
    role: UserRole;
    userId: string;
  }
}
