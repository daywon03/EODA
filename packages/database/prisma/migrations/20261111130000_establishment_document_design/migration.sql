-- MISE EN PAGE DES DOCUMENTS D'UNE STRUCTURE (11/11/2026). La mise en conformité garde
-- désormais le design du client : elle reprend son Word d'origine, sinon ce modèle de
-- mise en page déposé pour la structure ; les consignes écrites sont remises à la
-- génération comme une donnée.
--
-- Additive : une table neuve, une action de journal. Supprimer une structure supprime
-- sa mise en page (ON DELETE CASCADE). Migration écrite à la main ; application :
-- `pnpm db:migrate:deploy` uniquement.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DOCUMENT_DESIGN_UPDATED';

CREATE TABLE "establishment_document_designs" (
    "establishment_id" TEXT NOT NULL,
    "model_file_key" TEXT,
    "model_filename" TEXT,
    "notes" TEXT,
    "updated_by_user_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "establishment_document_designs_pkey" PRIMARY KEY ("establishment_id")
);

ALTER TABLE "establishment_document_designs" ADD CONSTRAINT "establishment_document_designs_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
