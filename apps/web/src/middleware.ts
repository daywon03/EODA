// Middleware Edge Runtime — n'importe que authConfig (pas bcryptjs ni Prisma)
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";
import type { UserRole } from "@eoda/database";

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

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
