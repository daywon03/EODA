// Middleware Edge Runtime — n'importe que authConfig (pas bcryptjs ni Prisma)
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";
import type { UserRole } from "@eoda/database";
import { PASSWORD_ROTATION_PATH, ROTATION_EXEMPT_PATHS } from "@/lib/auth/routes";
import {
  buildContentSecurityPolicy,
  generateCspNonce,
} from "@/lib/security/content-security-policy";
// Seul point de lecture de l'environnement (règle S6). `isProductionRuntime()` ne
// déclenche pas la validation complète du profil : le middleware tourne en Edge
// Runtime, où l'on contrôle ce qui est évalué.
import { isProductionRuntime } from "@/lib/config/env";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login"];

const ROLE_DASHBOARDS: Record<UserRole, string> = {
  CABINET_ADMIN: "/dashboard/cabinet",
  CABINET_EVALUATOR: "/dashboard/cabinet",
  CLIENT_USER: "/dashboard/client",
};

// CSP à nonce : la politique ne peut plus être un en-tête statique de next.config,
// puisqu'elle contient une valeur tirée à chaque requête. Elle est donc posée ici,
// pour toutes les routes que couvre le `matcher` ci-dessous — les routes /api, qui en
// sont exclues, gardent leur politique statique dans next.config.
//
// Le nonce est transmis DEUX fois, et les deux comptent :
//   - dans les en-têtes de la REQUÊTE, où Next.js va le lire pour le recopier sur ses
//     propres balises <script> ;
//   - dans les en-têtes de la RÉPONSE, où le navigateur l'applique.
// Poser seulement le second casserait toutes les pages : les scripts de Next
// n'auraient pas le nonce que la politique exige.
function applyCsp(response: NextResponse, csp: string): NextResponse {
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export default auth((req) => {
  const { nextUrl } = req;
  const nonce = generateCspNonce();
  const csp = buildContentSecurityPolicy({ nonce, isProduction: isProductionRuntime() });
  const session = req.auth;
  const isLoggedIn = !!session;
  const isPublic = PUBLIC_PATHS.some((p) => nextUrl.pathname.startsWith(p));

  if (!isLoggedIn && !isPublic) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return applyCsp(NextResponse.redirect(loginUrl), csp);
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
    return applyCsp(NextResponse.redirect(new URL(PASSWORD_ROTATION_PATH, nextUrl)), csp);
  }

  if (isLoggedIn && isPublic) {
    const role = session.user.role;
    const dest = ROLE_DASHBOARDS[role] ?? "/dashboard/cabinet";
    return applyCsp(NextResponse.redirect(new URL(dest, nextUrl)), csp);
  }

  if (isLoggedIn && nextUrl.pathname.startsWith("/dashboard/cabinet")) {
    if (session.user.role === "CLIENT_USER") {
      return applyCsp(NextResponse.redirect(new URL("/dashboard/client", nextUrl)), csp);
    }
  }
  if (isLoggedIn && nextUrl.pathname.startsWith("/dashboard/client")) {
    if (session.user.role !== "CLIENT_USER") {
      return applyCsp(NextResponse.redirect(new URL("/dashboard/cabinet", nextUrl)), csp);
    }
  }

  // Pipeline commercial (prospects/devis/catalogue) — réservé à CABINET_ADMIN,
  // même un CABINET_EVALUATOR légitimement connecté n'y a pas accès.
  const ADMIN_ONLY_PREFIXES = ["/dashboard/cabinet/commercial", "/imprimer/devis"];
  if (isLoggedIn && ADMIN_ONLY_PREFIXES.some((p) => nextUrl.pathname.startsWith(p))) {
    if (session.user.role !== "CABINET_ADMIN") {
      return applyCsp(NextResponse.redirect(new URL("/dashboard/cabinet", nextUrl)), csp);
    }
  }

  // Le nonce voyage vers le rendu par les en-têtes de la requête : c'est ainsi que
  // Next.js le retrouve pour ses propres scripts.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  return applyCsp(NextResponse.next({ request: { headers: requestHeaders } }), csp);
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
