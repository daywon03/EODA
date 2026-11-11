-- MASQUER UNE LIGNE DE « DOCUMENTS » POUR UNE SEULE STRUCTURE (retour de Sandrine,
-- 10/11/2026 : doublons et lignes devenues inutiles chez un client). Une ligne
-- masquée quitte la liste, les compteurs, l'avancement, les preuves attendues et le
-- portail de CETTE structure seulement ; elle se rétablit.
--
-- Additive : une table neuve et deux actions de journal, aucune réécriture. Supprimer
-- une structure ou une ligne supprime ses exclusions (ON DELETE CASCADE). Migration
-- écrite à la main ; application : `pnpm db:migrate:deploy` uniquement.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DOCUMENT_TYPE_HIDDEN_FOR_ESTABLISHMENT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DOCUMENT_TYPE_RESTORED_FOR_ESTABLISHMENT';

CREATE TABLE "establishment_document_type_exclusions" (
    "establishment_id" TEXT NOT NULL,
    "document_type_id" TEXT NOT NULL,
    "hidden_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "establishment_document_type_exclusions_pkey" PRIMARY KEY ("establishment_id","document_type_id")
);

CREATE INDEX "establishment_document_type_exclusions_document_type_id_idx" ON "establishment_document_type_exclusions"("document_type_id");

ALTER TABLE "establishment_document_type_exclusions" ADD CONSTRAINT "establishment_document_type_exclusions_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "establishment_document_type_exclusions" ADD CONSTRAINT "establishment_document_type_exclusions_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
