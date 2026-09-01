-- Nouvelle action d'audit : export des cotations d'auto-évaluation.
--
-- Un export fait SORTIR les données de la plateforme, sous une forme qui circule
-- ensuite par e-mail et sur des postes qu'on ne maîtrise pas. C'est exactement le
-- type d'accès dont le secteur médico-social demande de pouvoir dire qui, quand, et
-- pour quel établissement (CLAUDE.md §5 bis).
--
-- `ADD VALUE` seul, sans utilisation de la nouvelle valeur dans la même transaction :
-- accepté par PostgreSQL 12+ à cette condition, qui est remplie ici.
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits
-- sur ce dépôt (incident du 19/08/2026). Application : `pnpm db:migrate:deploy`.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EVALUATION_EXPORTED';
