-- BIBLIOTHÈQUE DE MODÈLES EODA — les gabarits du cabinet, versionnés par la
-- consultante elle-même.
--
-- « Est-ce qu'on pourrait avoir un endroit dans le portail où j'uploade les versions
-- vierges ? […] S'il faut une nouvelle version avec un nouvel article de loi, que j'y
-- aille directement, que je crée une version 1.2, une version 1.3. Je ne pourrai pas
-- garder tout ça sur mon PC à un moment donné » (call du 01/09).
--
-- ⚠️ Tables DISTINCTES de `documents` / `document_versions`, qui portent les pièces
-- d'une structure. Rien ici n'appartient à un établissement : ce sont les gabarits
-- d'EODA. Les fusionner aurait obligé à rattacher chaque modèle à un client fictif et
-- fait entrer des documents internes dans les checklists et les livrables clients.
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits
-- sur ce dépôt (incident du 19/08/2026). Application : `pnpm db:migrate:deploy`.

CREATE TYPE "TemplateStage" AS ENUM ('VIERGE', 'INITIALE', 'FINALE');

ALTER TYPE "AuditAction" ADD VALUE 'TEMPLATE_VERSION_UPLOADED';
ALTER TYPE "AuditAction" ADD VALUE 'TEMPLATE_VERSION_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'TEMPLATE_DOCUMENT_DELETED';

CREATE TABLE "template_documents" (
  "id"          TEXT NOT NULL,
  "tenant_id"   TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "category"    "DocumentCategory" NOT NULL,
  "description" TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "template_documents_pkey" PRIMARY KEY ("id")
);

-- Un même titre deux fois dans la bibliothèque, ce sont deux fiches qui divergent :
-- l'une reçoit les mises à jour, l'autre est oubliée.
CREATE UNIQUE INDEX "template_documents_tenant_id_title_key"
  ON "template_documents" ("tenant_id", "title");

CREATE TABLE "template_versions" (
  "id"                   TEXT NOT NULL,
  "template_document_id" TEXT NOT NULL,
  "version_label"        TEXT NOT NULL,
  "stage"                "TemplateStage" NOT NULL,
  "change_note"          TEXT,
  "file_storage_key"     TEXT NOT NULL,
  "original_filename"    TEXT NOT NULL,
  "content_type"         TEXT NOT NULL,
  "size_bytes"           INTEGER NOT NULL,
  "uploaded_by_user_id"  TEXT NOT NULL,
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "template_versions_pkey" PRIMARY KEY ("id")
);

-- Le même libellé ne peut pas désigner deux fichiers différents au même stade.
CREATE UNIQUE INDEX "template_versions_template_document_id_stage_version_label_key"
  ON "template_versions" ("template_document_id", "stage", "version_label");

ALTER TABLE "template_documents"
  ADD CONSTRAINT "template_documents_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CASCADE : supprimer une fiche de modèle emporte ses versions. Le fichier physique,
-- lui, est retiré du stockage par l'action serveur avant la suppression en base — la
-- base ne sait pas effacer un objet dans un bucket.
ALTER TABLE "template_versions"
  ADD CONSTRAINT "template_versions_template_document_id_fkey"
  FOREIGN KEY ("template_document_id") REFERENCES "template_documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "template_versions"
  ADD CONSTRAINT "template_versions_uploaded_by_user_id_fkey"
  FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
