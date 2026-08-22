import { getRateLimiter, LOGIN_IP_RATE_LIMIT, LOGIN_RATE_LIMIT } from "./index";
import { consumeThrottledAttempt } from "./attempt-throttle";

// ─────────────────────────────────────────────────────────────────────────────
// LIMITATION DE DÉBIT DE L'AUTHENTIFICATION
//
// ⚠️ Leçon d'un test réel : une première version de ce contrôle vivait uniquement dans
// l'action serveur du formulaire de connexion. Or `POST /api/auth/callback/credentials`
// est une route publique joignable directement — 12 tentatives en curl passaient sans
// jamais être comptées. Le contrôle doit vivre au point où TOUS les chemins convergent,
// c'est-à-dire dans `authorize()` du provider, pas dans l'interface qui l'appelle.
//
// Règle générale : un contrôle de sécurité placé dans le composant d'interface est un
// contrôle contournable. Il appartient au point d'entrée effectif.
// ─────────────────────────────────────────────────────────────────────────────

// Récupère l'IP côté proxy. Derrière le reverse proxy de l'hébergeur, l'IP réelle est le
// premier élément de x-forwarded-for.
export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "ip-inconnue";
}

// ── Deux compteurs, jamais un seul ───────────────────────────────────────────
// La limitation de la connexion est portée par DEUX compteurs complémentaires, et
// c'est délibéré :
//
//   1. (IP, email) — ferme le bourrage de mots de passe sur UN compte donné, sans
//      qu'une IP partagée (NAT d'une association) ne bloque tous ses collègues.
//   2. IP seule    — ferme le BALAYAGE (« password spraying »), que le compteur 1
//      laisse entièrement passer : changer d'email remet son compteur à zéro.
//
// L'API publique de ce module prend donc l'identité `(ip, email)` et jamais une clé
// déjà construite : un appelant ne peut pas oublier le second compteur, parce qu'il
// n'a aucun moyen de n'en viser qu'un. C'est le même raisonnement que la couche
// d'autorisation unique — un contrôle qu'on peut contourner par inadvertance n'en
// est pas un.
export type LoginIdentity = { ip: string; email: string };

export function loginThrottleKey(ip: string, email: string): string {
  return `login:${ip}:${email.trim().toLowerCase()}`;
}

export function loginIpThrottleKey(ip: string): string {
  return `login-ip:${ip}`;
}

// Consomme une tentative sur les DEUX compteurs. Appelé UNE SEULE FOIS par tentative
// réelle, depuis `authorize()`. Retourne false quand la tentative doit être refusée.
//
// Le compteur par IP est consommé EN PREMIER et court-circuite : une IP déjà bloquée
// pour balayage ne doit pas continuer à faire monter le compteur d'un compte précis,
// sinon elle verrouillerait un utilisateur légitime au passage.
export async function consumeLoginAttempt(identity: LoginIdentity): Promise<boolean> {
  const ipAllowed = await consumeThrottledAttempt({
    key: loginIpThrottleKey(identity.ip),
    policy: LOGIN_IP_RATE_LIMIT,
    auditAction: "LOGIN_RATE_LIMITED",
  });
  if (!ipAllowed) return false;

  return consumeThrottledAttempt({
    key: loginThrottleKey(identity.ip, identity.email),
    policy: LOGIN_RATE_LIMIT,
    auditAction: "LOGIN_RATE_LIMITED",
  });
}

// Lecture sans consommation — permet à l'action serveur d'afficher un message précis
// (« nouvel essai dans N minutes ») sans compter une tentative de plus. Renvoie l'état
// le PLUS restrictif des deux compteurs : l'utilisateur doit connaître le délai réel
// avant réouverture, pas celui du compteur le moins contraignant.
export async function peekLoginThrottle(
  identity: LoginIdentity
): Promise<{ blocked: boolean; retryAfterSeconds: number }> {
  const limiter = getRateLimiter();
  const [couple, perIp] = await Promise.all([
    limiter.peek(loginThrottleKey(identity.ip, identity.email), LOGIN_RATE_LIMIT),
    limiter.peek(loginIpThrottleKey(identity.ip), LOGIN_IP_RATE_LIMIT),
  ]);

  return {
    blocked: couple.blocked || perIp.blocked,
    retryAfterSeconds: Math.max(
      couple.blocked ? couple.retryAfterSeconds : 0,
      perIp.blocked ? perIp.retryAfterSeconds : 0
    ),
  };
}

// Remet à zéro le compteur du COUPLE uniquement, jamais celui de l'IP.
//
// Point non négociable : une connexion réussie ne doit pas effacer le compteur de
// balayage. Sinon un attaquant qui possède un seul compte valide (un ancien salarié
// d'une structure cliente, un compte de démonstration) le réutilise comme bouton de
// remise à zéro entre deux séries d'essais, et le compteur par IP ne bloque plus rien.
// Le compteur du couple, lui, doit bien repartir de zéro : c'est ce qui évite qu'un
// utilisateur légitime reste pénalisé par ses propres erreurs de frappe.
export async function resetLoginThrottle(identity: LoginIdentity): Promise<void> {
  await getRateLimiter().reset(loginThrottleKey(identity.ip, identity.email));
}
