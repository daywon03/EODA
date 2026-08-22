-- Compteur de limitation de débit partagé entre instances.
--
-- Contexte : la cible de déploiement est passée à Vercel (serverless). Le
-- compteur anti-force-brute vivait dans une Map du processus
-- (apps/web/src/lib/security/in-memory-rate-limiter.ts) : chaque invocation peut
-- s'exécuter sur une instance différente et un démarrage à froid remet la Map à
-- zéro, donc le quota effectif de connexion était multiplié par le nombre
-- d'instances. Le compteur doit être partagé ; la base est la seule ressource
-- déjà commune à toutes les instances.
--
-- Migration ADDITIVE : une table nouvelle, aucune colonne ni contrainte existante
-- touchée.
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont
-- interdits sur ce dépôt (destruction de la base désignée en shadow database,
-- incident du 19/08/2026). Application : `pnpm db:migrate:deploy` uniquement.

CREATE TABLE "rate_limit_counters" (
    -- La clé applicative (`login:<ip>:<email>`) est la clé primaire. Elle porte
    -- donc l'index unique EXIGÉ par le `ON CONFLICT ("key")` de l'upsert atomique
    -- — c'est cet index qui permet à PostgreSQL de verrouiller la ligne en
    -- conflit et de sérialiser deux tentatives simultanées sur la même clé.
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_counters_pkey" PRIMARY KEY ("key")
);

-- Purge des fenêtres échues : `DELETE FROM rate_limit_counters WHERE expires_at
-- <= now`. Sans cet index, la purge opportuniste dégénèrerait en balayage
-- séquentiel complet — et la table ne doit pas croître sans borne, un attaquant
-- pouvant sinon la faire grossir à volonté en variant les couples (IP, email).
CREATE INDEX "rate_limit_counters_expires_at_idx" ON "rate_limit_counters"("expires_at");
