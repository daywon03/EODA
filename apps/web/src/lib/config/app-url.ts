import { getEnv } from "./env";

// Adresse ABSOLUE d'une page de la plateforme — pour un lien qui sort de l'écran :
// e-mail, QR code imprimé. En production, `NEXTAUTH_URL` est exigée par le profil de
// démarrage ; un lien relatif hors du navigateur ne mène nulle part.
export function appUrl(path: string): string {
  const base = getEnv().nextAuthUrl ?? "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}${path}`;
}
