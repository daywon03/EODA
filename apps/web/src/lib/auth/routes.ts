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

// Pages publiques du libre-service (maquettes v2, 13/10/2026) : la page d'accueil
// (landing) et l'inscription. Même comportement que la connexion : servies sans
// session, et un visiteur CONNECTÉ est renvoyé vers son espace. Liste EXACTE — un
// sous-chemin (/inscription/x) reste protégé.
export const LANDING_PATH = "/";
export const SIGNUP_PATH = "/inscription";
const PUBLIC_AUTH_PATHS: readonly string[] = [LANDING_PATH, SIGNUP_PATH];

// Confirmation de l'adresse d'un compte libre-service (tranche 11) : ANONYMOUS, comme
// le quiz — le lien arrive par e-mail, souvent ouvert sur un autre appareil, connecté
// ou non ; aucune redirection. `/confirmer-email` seul (formulaire « renvoyer le
// lien ») et `/confirmer-email/<jeton>` (un seul segment) ; tout sous-chemin plus
// profond reste protégé. Le jeton n'ouvre RIEN d'autre que la confirmation, et la
// page ne la fait qu'au clic (un scanner de liens ne la consomme pas).
export const EMAIL_CONFIRMATION_PREFIX = "/confirmer-email";

// Espace d'une structure inscrite seule (rôle PROSPECT_USER).
export const PROSPECT_SPACE_PATH = "/espace";

export function classifyPath(pathname: string): PathAccess {
  if (pathname === "/login" || pathname.startsWith("/login/")) return "AUTH";
  if (PUBLIC_AUTH_PATHS.includes(pathname)) return "AUTH";
  // Un seul segment après /quiz/ : /quiz/<jeton>. /quiz seul ou /quiz/a/b restent protégés.
  if (pathname.startsWith(QUIZ_PUBLIC_PREFIX) && /^\/quiz\/[A-Za-z0-9_-]+$/.test(pathname)) return "ANONYMOUS";
  if (/^\/confirmer-email(?:\/[A-Za-z0-9_-]+)?$/.test(pathname)) return "ANONYMOUS";
  return "PROTECTED";
}
