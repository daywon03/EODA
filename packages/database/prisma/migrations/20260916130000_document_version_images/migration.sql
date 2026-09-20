-- Images extraites d'un document déposé, stockées à part — jamais réintégrées en
-- base64 dans le texte envoyé à un LLM (cause de la troncature de documents longs
-- constatée le 15/09/2026 : le texte extrait contenait les images du document en
-- base64 inline, ce qui épuisait le budget de caractères envoyé au modèle avant
-- même d'atteindre le vrai contenu textuel).
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits
-- sur ce dépôt (incident du 19/08/2026). Application : `prisma migrate deploy`.

CREATE TABLE "document_version_images" (
    "id" TEXT NOT NULL,
    "document_version_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "file_storage_key" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_version_images_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "document_version_images_document_version_id_idx" ON "document_version_images"("document_version_id");

ALTER TABLE "document_version_images" ADD CONSTRAINT "document_version_images_document_version_id_fkey"
    FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
