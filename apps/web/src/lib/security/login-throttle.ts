import { getRateLimiter, LOGIN_RATE_LIMIT } from "./index";
import { recordAuditEvent } from "@/lib/services/audit-log-service";

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

// Clé sur le couple (IP, email) : bloque le bourrage de mots de passe sur un compte
// donné sans qu'une IP partagée (NAT d'entreprise) ne bloque tous ses collègues.
export function loginThrottleKey(ip: string, email: string): string {
  return `login:${ip}:${email.trim().toLowerCase()}`;
}

// Consomme une tentative. Appelé UNE SEULE FOIS par tentative réelle, depuis
// `authorize()`. Retourne false quand la tentative doit être refusée.
export async function consumeLoginAttempt(key: string): Promise<boolean> {
  const decision = await getRateLimiter().consume(key, LOGIN_RATE_LIMIT);

  if (!decision.allowed) {
    await recordAuditEvent({
      action: "LOGIN_RATE_LIMITED",
      detail: `tentatives dépassées (${LOGIN_RATE_LIMIT.limit} / ${LOGIN_RATE_LIMIT.windowSeconds}s)`,
    });
    return false;
  }

  return true;
}

// Lecture sans consommation — permet à l'action serveur d'afficher un message précis
// (« nouvel essai dans N minutes ») sans compter une tentative de plus.
export async function peekLoginThrottle(key: string): Promise<{ blocked: boolean; retryAfterSeconds: number }> {
  const state = await getRateLimiter().peek(key, LOGIN_RATE_LIMIT);
  return { blocked: state.blocked, retryAfterSeconds: state.retryAfterSeconds };
}

export async function resetLoginThrottle(key: string): Promise<void> {
  await getRateLimiter().reset(key);
}
