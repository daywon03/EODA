// Middleware Edge Runtime — n'importe que authConfig (pas bcryptjs ni Prisma)
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";
import type { UserRole } from "@eoda/database";
import { classifyPath, PASSWORD_ROTATION_PATH, ROTATION_EXEMPT_PATHS } from "@/lib/auth/routes";
import {
  capabilityRequiredForPath,
  hasCabinetCapability,
  portalRedirectFor,
  roleHomePath,
} from "@/lib/auth/capabilities";
import {
  buildContentSecurityPolicy,
  generateCspNonce,
} from "@/lib/security/content-security-policy";
// Seul point de lecture de l'environnement (règle S6). `isProductionRuntime()` ne
// déclenche pas la validation complète du profil : le middleware tourne en Edge
// Runtime, où l'on contrôle ce qui est évalué.
import { isProductionRuntime } from "@/lib/config/env";

const { auth } = NextAuth(authConfig);



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
  const access = classifyPath(nextUrl.pathname);
  const isPublic = access === "AUTH";

  // Quiz par QR code (N10) : public, connecté ou non — aucune redirection, seulement
  // la CSP à nonce (même chemin de sortie que toute autre page ci-dessous).
  if (access === "ANONYMOUS") return passThroughWithCsp(req.headers, nonce, csp);

  if (!isLoggedIn && !isPublic) {
    const loginUrl = new URL("/login", nextUrl);
    // Chemin ET paramètres (onglet, filtre) : la connexion ramène exactement à la
    // page demandée. Relu à l'arrivée par safeCallbackPath (chemin interne seul).
    loginUrl.searchParams.set("callbackUrl", `${nextUrl.pathname}${nextUrl.search}`);
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
    const role: UserRole = session.user.role;
    return applyCsp(NextResponse.redirect(new URL(roleHomePath(role), nextUrl)), csp);
  }

  // Structure inscrite seule (libre-service) : son espace, rien d'autre ; et personne
  // d'autre n'entre dans /espace.
  const portalRedirect = isLoggedIn ? portalRedirectFor(session.user.role, nextUrl.pathname) : null;
  if (portalRedirect) {
    return applyCsp(NextResponse.redirect(new URL(portalRedirect, nextUrl)), csp);
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

  // Modules réservés à une capacité (commercial, équipe EODA, montants d'une
  // structure) — filet sur le rôle du jeton, la garde de chaque page relit la base.
  const required = capabilityRequiredForPath(nextUrl.pathname);
  if (isLoggedIn && required && !hasCabinetCapability(session.user.role, required)) {
    return applyCsp(NextResponse.redirect(new URL(roleHomePath(session.user.role), nextUrl)), csp);
  }

  return passThroughWithCsp(req.headers, nonce, csp);
});

// Le nonce voyage vers le rendu par les en-têtes de la requête : c'est ainsi que
// Next.js le retrouve pour ses propres scripts.
function passThroughWithCsp(incoming: Headers, nonce: string, csp: string): NextResponse {
  const requestHeaders = new Headers(incoming);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  return applyCsp(NextResponse.next({ request: { headers: requestHeaders } }), csp);
}

export const config = {
  // Les assets de MARQUE sont publics : le logo doit se charger dans un e-mail, donc
  // hors session. Sans cette exclusion, le middleware redirige `/logo-eoda.png` vers
  // /login et l'image casse dans tous les messages envoyés — constaté en exécution.
  //
  // Aucun contenu sensible n'est servi ainsi : les documents clients passent par
  // /api/local-storage (déjà hors matcher, avec son propre contrôle d'accès) ou par
  // une URL signée du bucket.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)"],
};
