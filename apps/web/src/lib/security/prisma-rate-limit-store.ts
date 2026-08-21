import { Prisma, prisma } from "@eoda/database";
import type { IncrementInput, RateLimitCounterStore } from "./postgres-rate-limiter";
import type { RateLimitCounter } from "./rate-limit-window";

// ─────────────────────────────────────────────────────────────────────────────
// FRONTIÈRE SQL DU COMPTEUR PARTAGÉ
//
// Requête brute assumée, pour une raison précise : Prisma n'exprime pas
// « incrémenter OU réinitialiser selon l'expiration, et me rendre le résultat »
// en une seule instruction. `findUnique` puis `update` serait un read-then-write,
// c'est-à-dire la course exacte que ce compteur doit fermer — deux requêtes
// simultanées liraient toutes les deux `count = limit - 1` et passeraient toutes
// les deux.
//
// ── CE QUI GARANTIT L'ATOMICITÉ ──────────────────────────────────────────────
// `INSERT … ON CONFLICT ("key") DO UPDATE … RETURNING`.
//
// PostgreSQL prend un verrou de LIGNE sur la ligne en conflit avant d'appliquer
// la branche UPDATE. Deux transactions concurrentes sur la même clé sont donc
// sérialisées : la seconde attend le COMMIT de la première, puis réévalue son
// UPDATE sur la version à jour de la ligne (ON CONFLICT DO UPDATE relit la ligne
// gagnante même en READ COMMITTED, contrairement à un UPDATE … WHERE ordinaire).
// Aucun incrément n'est perdu, et `RETURNING` rend le compteur RÉSULTANT — celui
// sur lequel la décision est prise. Une seule instruction, un seul aller-retour,
// aucune transaction explicite à gérer.
//
// La remise à zéro d'une fenêtre échue est portée par le `CASE` du même UPDATE :
// elle est donc atomique avec l'incrément, pas dans une seconde requête.
// ─────────────────────────────────────────────────────────────────────────────

type CounterRow = { count: number; expires_at: Date };

function toCounter(row: CounterRow): RateLimitCounter {
  return { count: Number(row.count), expiresAtMs: row.expires_at.getTime() };
}

export class PrismaRateLimitCounterStore implements RateLimitCounterStore {
  async incrementWithinWindow(input: IncrementInput): Promise<RateLimitCounter> {
    const now = new Date(input.nowMs);
    const windowEnd = new Date(input.windowExpiresAtMs);

    // Purge opportuniste greffée en CTE modifiante SUR LA MÊME INSTRUCTION : pas
    // de cron, pas de second aller-retour. Tirée au sort en amont (2 % des
    // écritures) pour que le balayage ne pèse pas sur chaque connexion.
    // `"key" <> $key` exclut notre propre ligne : la CTE et l'INSERT voient le
    // même instantané, supprimer la ligne qu'on est en train d'upserter rendrait
    // le résultat ambigu.
    const purge = input.purgeExpired
      ? Prisma.sql`WITH purged AS (
            DELETE FROM "rate_limit_counters"
            WHERE "expires_at" <= ${now} AND "key" <> ${input.key}
          )`
      : Prisma.empty;

    const rows = await prisma.$queryRaw<CounterRow[]>(Prisma.sql`
      ${purge}
      INSERT INTO "rate_limit_counters" ("key", "count", "expires_at")
      VALUES (${input.key}, 1, ${windowEnd})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "rate_limit_counters"."expires_at" <= ${now} THEN 1
          ELSE "rate_limit_counters"."count" + 1
        END,
        "expires_at" = CASE
          WHEN "rate_limit_counters"."expires_at" <= ${now} THEN ${windowEnd}
          ELSE "rate_limit_counters"."expires_at"
        END
      RETURNING "count", "expires_at"
    `);

    const row = rows[0];
    // `RETURNING` d'un upsert rend toujours exactement une ligne. Si ce n'est pas
    // le cas, on ne sait rien du compteur : on lève, et l'appelant referme
    // (fail-closed) plutôt que d'inventer une valeur permissive.
    if (!row) throw new Error("Compteur de limitation : aucune ligne renvoyée par l'upsert.");

    return toCounter(row);
  }

  async read(key: string): Promise<RateLimitCounter | null> {
    const counter = await prisma.rateLimitCounter.findUnique({
      where: { key },
      select: { count: true, expiresAt: true },
    });

    if (!counter) return null;
    return { count: counter.count, expiresAtMs: counter.expiresAt.getTime() };
  }

  async remove(key: string): Promise<void> {
    // `deleteMany` et non `delete` : effacer une clé absente est le cas nominal
    // (authentification réussie du premier coup), pas une erreur.
    await prisma.rateLimitCounter.deleteMany({ where: { key } });
  }
}
