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

// Tablette terrain (lot C) : ni compte ni session Auth.js — l'autorisation vient de
// l'APPAREIL ENREGISTRÉ et du code du salarié (resolveTabletSession, guards.ts). La
// démonstration tourne en mémoire du navigateur sur des données fictives. Liste
// EXACTE : tout sous-chemin reste protégé.
export const TABLET_PATH = "/tablette";
export const TABLET_DEMO_PATH = "/tablette/demonstration";
const TABLET_PATHS: readonly string[] = [TABLET_PATH, TABLET_DEMO_PATH];

export function classifyPath(pathname: string): PathAccess {
  if (pathname === "/login" || pathname.startsWith("/login/")) return "AUTH";
  if (PUBLIC_AUTH_PATHS.includes(pathname)) return "AUTH";
  // Un seul segment après /quiz/ : /quiz/<jeton>. /quiz seul ou /quiz/a/b restent protégés.
  if (pathname.startsWith(QUIZ_PUBLIC_PREFIX) && /^\/quiz\/[A-Za-z0-9_-]+$/.test(pathname)) return "ANONYMOUS";
  if (/^\/confirmer-email(?:\/[A-Za-z0-9_-]+)?$/.test(pathname)) return "ANONYMOUS";
  if (TABLET_PATHS.includes(pathname)) return "ANONYMOUS";
  return "PROTECTED";
}

// ── Retour après connexion (`callbackUrl`) ───────────────────────────────────
// Le middleware renvoie vers /login?callbackUrl=<chemin demandé>. Ce paramètre arrive
// par l'adresse : c'est une entrée HOSTILE. Sans contrôle, /login?callbackUrl=
// https://site-piege.example envoie la personne, juste après une connexion réussie,
// vers une page qui imite la plateforme (open redirect).
//
// Seul un CHEMIN INTERNE est accepté : un « / » unique en tête, aucune barre
// oblique inverse, aucun caractère de contrôle ni espace (un navigateur retire les
// tabulations d'une URL : « /\t/piege.example » deviendrait « //piege.example »,
// l'adresse d'un autre site), et la résolution contre une origine fictive doit
// rester sur cette origine. Les pages de connexion et de déconnexion sont refusées
// (boucle). null = repli sur la page d'arrivée du rôle (/dashboard aiguille par rôle).
const CALLBACK_MAX_LENGTH = 512;
const PROBE_ORIGIN = "https://origine.invalid";
const FORBIDDEN_CALLBACK_CHARS = /[\\\s\u0000-\u001f\u007f]/;

export function safeCallbackPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (raw.length === 0 || raw.length > CALLBACK_MAX_LENGTH) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  if (FORBIDDEN_CALLBACK_CHARS.test(raw)) return null;

  let resolved: URL;
  try {
    resolved = new URL(raw, PROBE_ORIGIN);
  } catch {
    return null;
  }
  if (resolved.origin !== PROBE_ORIGIN) return null;
  if (classifyPath(resolved.pathname) === "AUTH" || resolved.pathname.startsWith(SIGN_OUT_PATH)) return null;

  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}
