-- Base de connaissances IA — chunks des documents de RÉFÉRENCE de la bibliothèque
-- de modèles (manuel HAS, textes réglementaires), embeddés pour enrichir l'analyse
-- documentaire. Les documents CLIENTS ne passent jamais par cette table : seuls les
-- documents de référence de la bibliothèque, contrôlés par le cabinet, y sont indexés.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "template_version_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1024) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "knowledge_chunks_tenant_id_idx" ON "knowledge_chunks"("tenant_id");
CREATE INDEX "knowledge_chunks_template_version_id_idx" ON "knowledge_chunks"("template_version_id");

-- Similarité cosinus. HNSW plutôt qu'IVFFlat : pas de nombre de listes à calibrer sur
-- un volume encore petit (une bibliothèque de référence, pas les documents clients).
CREATE INDEX "knowledge_chunks_embedding_hnsw_idx" ON "knowledge_chunks"
  USING hnsw ("embedding" vector_cosine_ops);

ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_template_version_id_fkey"
  FOREIGN KEY ("template_version_id") REFERENCES "template_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
