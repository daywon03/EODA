-- Revue humaine avant restitution au client.
--
-- Exigence écrite DEUX FOIS dans le cahier des charges du 20/08/2026 : « première
-- analyse automatisée du niveau de conformité […] TOUJOURS validée par la consultante
-- avant affichage au client » (§5), et « aucune analyse de conformité automatisée ne
-- doit être présentée au client sans revue préalable de la consultante » (§7,
-- points de vigilance).
--
-- L'affichage de l'analyse côté portail client, livré plus tôt le 26/08, ne portait
-- que la mention de réserve. Ce champ pose la barrière réelle : tant qu'il est NULL,
-- l'analyse existe, le cabinet la voit, le client non.
--
-- Nullable sans valeur par défaut, et surtout PAS de rattrapage qui publierait
-- rétroactivement les analyses existantes : aucune n'a été revue, les marquer comme
-- telles serait exactement la faute qu'on corrige.
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits sur
-- ce dépôt (incident du 19/08/2026). Application : `pnpm db:migrate:deploy` uniquement.
ALTER TABLE "document_versions" ADD COLUMN "analysis_reviewed_at" TIMESTAMP(3);
ALTER TABLE "document_versions" ADD COLUMN "analysis_reviewed_by_user_id" TEXT;

ALTER TABLE "document_versions"
    ADD CONSTRAINT "document_versions_analysis_reviewed_by_user_id_fkey"
    FOREIGN KEY ("analysis_reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Traçabilité de la décision de restitution.
ALTER TYPE "AuditAction" ADD VALUE 'ANALYSIS_PUBLISHED';
ALTER TYPE "AuditAction" ADD VALUE 'ANALYSIS_UNPUBLISHED';
