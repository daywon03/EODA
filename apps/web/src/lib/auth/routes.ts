// Chemins de la rotation de mot de passe, partagés par le middleware (Edge Runtime,
// sans base ni Prisma) et par la couche d'autorisation (Node.js, avec base). Module
// volontairement SANS dépendance : importer guards.ts depuis le middleware y ferait
// entrer Prisma, qui ne tourne pas en Edge.
export const PASSWORD_ROTATION_PATH = "/changer-mot-de-passe";
export const SIGN_OUT_PATH = "/deconnexion";

// Les deux seules routes authentifiées qu'un compte en attente de rotation peut
// atteindre : changer son mot de passe, ou se déconnecter.
export const ROTATION_EXEMPT_PATHS = [PASSWORD_ROTATION_PATH, SIGN_OUT_PATH] as const;
