-- Copie signée et tamponnée d'un document accepté par la structure (12/11/2026).
--
-- Rangée SUR la version acceptée, jamais comme une nouvelle version : une version N+1
-- rendrait caducs « Relu par EODA » et « Accepté » et repartirait à l'analyse (le
-- tampon, à accès restreint, n'est jamais remis à un modèle). Colonnes facultatives,
-- aucune donnée existante touchée.
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits sur
-- ce dépôt (incident du 19/08/2026). Application : `prisma migrate deploy`.
ALTER TABLE "document_versions" ADD COLUMN "signed_file_storage_key" TEXT;
ALTER TABLE "document_versions" ADD COLUMN "signed_at" TIMESTAMP(3);
ALTER TABLE "document_versions" ADD COLUMN "signed_by_user_id" TEXT;

ALTER TABLE "document_versions"
  ADD CONSTRAINT "document_versions_signed_by_user_id_fkey"
  FOREIGN KEY ("signed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "document_versions_signed_by_user_id_idx" ON "document_versions"("signed_by_user_id");
