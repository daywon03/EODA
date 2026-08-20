// Middleware Edge Runtime — n'importe que authConfig (pas bcryptjs ni Prisma)
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";
import type { UserRole } from "@eoda/database";
import { PASSWORD_ROTATION_PATH, ROTATION_EXEMPT_PATHS } from "@/lib/auth/routes";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login"];

const ROLE_DASHBOARDS: Record<UserRole, string> = {
  CABINET_ADMIN: "/dashboard/cabinet",
  CABINET_EVALUATOR: "/dashboard/cabinet",
  CLIENT_USER: "/dashboard/client",
};

export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;
  const isLoggedIn = !!session;
  const isPublic = PUBLIC_PATHS.some((p) => nextUrl.pathname.startsWith(p));

  if (!isLoggedIn && !isPublic) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Rotation du mot de passe due : aucune autre route authentifiée n'est servie.
  // Filet grossier basé sur la revendication du jeton — l'autorité reste la base,
  // relue par lib/auth/guards.ts à chaque contrôle. Ce filet couvre les routes qui
  // ne passent pas par une garde (et /login, où renvoyer vers le tableau de bord
  // ferait rebondir l'utilisateur sans fin).
  if (
    isLoggedIn &&
    session.user.mustChangePassword &&
    !ROTATION_EXEMPT_PATHS.some((p) => nextUrl.pathname.startsWith(p))
  ) {
    return NextResponse.redirect(new URL(PASSWORD_ROTATION_PATH, nextUrl));
  }

  if (isLoggedIn && isPublic) {
    const role = session.user.role;
    const dest = ROLE_DASHBOARDS[role] ?? "/dashboard/cabinet";
    return NextResponse.redirect(new URL(dest, nextUrl));
  }

  if (isLoggedIn && nextUrl.pathname.startsWith("/dashboard/cabinet")) {
    if (session.user.role === "CLIENT_USER") {
      return NextResponse.redirect(new URL("/dashboard/client", nextUrl));
    }
  }
  if (isLoggedIn && nextUrl.pathname.startsWith("/dashboard/client")) {
    if (session.user.role !== "CLIENT_USER") {
      return NextResponse.redirect(new URL("/dashboard/cabinet", nextUrl));
    }
  }

  // Pipeline commercial (prospects/devis/catalogue) — réservé à CABINET_ADMIN,
  // même un CABINET_EVALUATOR légitimement connecté n'y a pas accès.
  const ADMIN_ONLY_PREFIXES = ["/dashboard/cabinet/commercial", "/imprimer/devis"];
  if (isLoggedIn && ADMIN_ONLY_PREFIXES.some((p) => nextUrl.pathname.startsWith(p))) {
    if (session.user.role !== "CABINET_ADMIN") {
      return NextResponse.redirect(new URL("/dashboard/cabinet", nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
