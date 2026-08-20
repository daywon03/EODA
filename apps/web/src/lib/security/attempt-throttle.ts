import { getRateLimiter } from "./index";
import type { RateLimitPolicy } from "./rate-limiter-port";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import type { AuditAction } from "@eoda/database";

// Consommation d'une tentative sur un compteur limité, avec journalisation du
// dépassement. Factorisé ici parce que la connexion et le changement de mot de passe
// en ont besoin à l'identique : dupliquer ces six lignes, c'est garantir que la
// prochaine correction ne sera appliquée qu'à l'une des deux (règle D1).
//
// Le `detail` journalisé ne contient QUE la politique appliquée — jamais l'email ni
// l'IP, qui sont des données personnelles (cf. CLAUDE.md §5 bis).
export async function consumeThrottledAttempt(options: {
  key: string;
  policy: RateLimitPolicy;
  auditAction: AuditAction;
  actorUserId?: string | null;
}): Promise<boolean> {
  const { key, policy, auditAction, actorUserId } = options;
  const decision = await getRateLimiter().consume(key, policy);

  if (!decision.allowed) {
    await recordAuditEvent({
      action: auditAction,
      actorUserId: actorUserId ?? null,
      detail: `tentatives dépassées (${policy.limit} / ${policy.windowSeconds}s)`,
    });
    return false;
  }

  return true;
}
