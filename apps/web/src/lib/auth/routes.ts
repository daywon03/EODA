// Chemins de la rotation de mot de passe, partagés par le middleware (Edge Runtime,
// sans base ni Prisma) et par la couche d'autorisation (Node.js, avec base). Module
// volontairement SANS dépendance : importer guards.ts depuis le middleware y ferait
// entrer Prisma, qui ne tourne pas en Edge.
export const PASSWORD_ROTATION_PATH = "/changer-mot-de-passe";
export const SIGN_OUT_PATH = "/deconnexion";

// Les deux seules routes authentifiées qu'un compte en attente de rotation peut
// atteindre : changer son mot de passe, ou se déconnecter.
export const ROTATION_EXEMPT_PATHS = [PASSWORD_ROTATION_PATH, SIGN_OUT_PATH] as const;

// ── Routes sans session ──────────────────────────────────────────────────────
// Deux sortes, à ne pas confondre :
//   - AUTH : la connexion. Un visiteur connecté y est renvoyé vers son tableau de bord.
//   - ANONYMOUS : le quiz par QR code (N10), la SEULE route publique ouverte à un
//     salarié sans compte. Son jeton fait office d'autorisation ; ni redirection vers
//     la connexion, ni vers un tableau de bord. La CSP à nonce s'y applique comme
//     partout (le middleware la pose avant de laisser passer).
// Toute autre adresse est PROTÉGÉE : refuser par défaut.
export const QUIZ_PUBLIC_PREFIX = "/quiz/";

export type PathAccess = "AUTH" | "ANONYMOUS" | "PROTECTED";

export function classifyPath(pathname: string): PathAccess {
  if (pathname === "/login" || pathname.startsWith("/login/")) return "AUTH";
  // Un seul segment après /quiz/ : /quiz/<jeton>. /quiz seul ou /quiz/a/b restent protégés.
  if (pathname.startsWith(QUIZ_PUBLIC_PREFIX) && /^\/quiz\/[A-Za-z0-9_-]+$/.test(pathname)) return "ANONYMOUS";
  return "PROTECTED";
}
