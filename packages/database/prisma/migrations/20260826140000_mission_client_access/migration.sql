-- Fin de mission : trois états d'accès, aucune suppression.
--
-- La clôture (`closed_at`, migration du 23/08) ne coupe rien par elle-même. Position
-- finale du call du 16/08/2026, après deux rétractations : « à la fin de
-- l'accompagnement, on ne coupe pas leur accès. Ils auront accès à la bibliothèque des
-- documents générés, mais nous leur préconisons de s'abonner. »
--
--   mission active        closed_at IS NULL                     dépôt + lecture
--   bibliothèque abonnée  closed_at renseigné, révocation NULL  lecture seule
--   accès révoqué         client_access_revoked_at renseigné    zéro accès client
--
-- Couper l'accès devient donc un geste explicite et RÉVERSIBLE, jamais un effet de
-- bord de la clôture. Les documents ne sont jamais supprimés : la rétention reste
-- côté cabinet.
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits sur
-- ce dépôt (incident du 19/08/2026). Application : `pnpm db:migrate:deploy` uniquement.
ALTER TABLE "missions" ADD COLUMN "client_access_revoked_at" TIMESTAMP(3);

-- Traçabilité des quatre gestes de fin de mission. Ils ouvrent ou ferment l'accès d'un
-- client à ses propres documents : c'est l'opération la plus sensible du module, elle
-- doit laisser une trace datée (secteur médico-social, CLAUDE.md §5 bis).
ALTER TYPE "AuditAction" ADD VALUE 'MISSION_CLOSED';
ALTER TYPE "AuditAction" ADD VALUE 'MISSION_REOPENED';
ALTER TYPE "AuditAction" ADD VALUE 'MISSION_CLIENT_ACCESS_REVOKED';
ALTER TYPE "AuditAction" ADD VALUE 'MISSION_CLIENT_ACCESS_RESTORED';
