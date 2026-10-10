-- Auteur du geste de cotation (10/10/2026, tranche R4 des maquettes v2) : l'écran
-- d'auto-évaluation distingue « Proposé par la plateforme » (suggestion machine) de
-- « Coté par {nom} · date » (geste humain). Jusqu'ici seule la personne qui avait
-- OUVERT la session était connue, pas celle qui avait coté.
--
-- Additive : colonne nullable (les cotations existantes restent sans auteur — on ne
-- le devine pas), index de la clé étrangère (convention P6), aucune réécriture.
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sur la base sont
-- interdits sur ce dépôt. Application : `pnpm db:migrate:deploy` uniquement.

ALTER TABLE "element_ratings" ADD COLUMN "rated_by_user_id" TEXT;

CREATE INDEX "element_ratings_rated_by_user_id_idx" ON "element_ratings"("rated_by_user_id");

ALTER TABLE "element_ratings"
  ADD CONSTRAINT "element_ratings_rated_by_user_id_fkey"
  FOREIGN KEY ("rated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
