-- Mettre en conformité côte à côte + exemples validés — tranche N8 des maquettes v2,
-- 12/10/2026 (context/10 §9).
--
-- ADDITIVE uniquement : un type, quatre valeurs d'audit, une colonne nullable sur
-- template_documents (lien gabarit → type de document), une colonne avec défaut sur
-- knowledge_chunks (nature REFERENCE / EXEMPLE_VALIDE — toutes les lignes existantes
-- sont des références, d'où le défaut), une table neuve et leurs index (chaque clé
-- étrangère indexée, convention P6). Aucune donnée réécrite, aucun index supprimé.
-- Migration générée schéma à schéma (prisma migrate diff --from-schema-datamodel),
-- sans connexion à la base ; application : migrate deploy uniquement.

-- CreateEnum
CREATE TYPE "KnowledgeNature" AS ENUM ('REFERENCE', 'EXEMPLE_VALIDE');

-- AlterEnum


ALTER TYPE "AuditAction" ADD VALUE 'CORRECTION_PROPOSAL_APPLIED';
ALTER TYPE "AuditAction" ADD VALUE 'CORRECTION_PROPOSAL_EXPORTED';
ALTER TYPE "AuditAction" ADD VALUE 'CHANGE_REPORT_DOWNLOADED';
ALTER TYPE "AuditAction" ADD VALUE 'TEMPLATE_DOCUMENT_TYPE_LINKED';

-- AlterTable
ALTER TABLE "template_documents" ADD COLUMN     "document_type_id" TEXT;

-- AlterTable
ALTER TABLE "knowledge_chunks" ADD COLUMN     "nature" "KnowledgeNature" NOT NULL DEFAULT 'REFERENCE';

-- CreateTable
CREATE TABLE "correction_proposals" (
    "id" TEXT NOT NULL,
    "source_version_id" TEXT NOT NULL,
    "proposal_json" JSONB NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generated_by_id" TEXT,
    "result_version_id" TEXT,
    "decisions_json" JSONB,
    "applied_at" TIMESTAMP(3),
    "applied_by_id" TEXT,

    CONSTRAINT "correction_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "correction_proposals_result_version_id_key" ON "correction_proposals"("result_version_id");

-- CreateIndex
CREATE INDEX "correction_proposals_source_version_id_generated_at_idx" ON "correction_proposals"("source_version_id", "generated_at");

-- CreateIndex
CREATE INDEX "correction_proposals_generated_by_id_idx" ON "correction_proposals"("generated_by_id");

-- CreateIndex
CREATE INDEX "correction_proposals_applied_by_id_idx" ON "correction_proposals"("applied_by_id");

-- CreateIndex
CREATE INDEX "template_documents_document_type_id_idx" ON "template_documents"("document_type_id");

-- CreateIndex
CREATE INDEX "knowledge_chunks_tenant_id_nature_idx" ON "knowledge_chunks"("tenant_id", "nature");

-- AddForeignKey
ALTER TABLE "template_documents" ADD CONSTRAINT "template_documents_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_proposals" ADD CONSTRAINT "correction_proposals_source_version_id_fkey" FOREIGN KEY ("source_version_id") REFERENCES "document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_proposals" ADD CONSTRAINT "correction_proposals_result_version_id_fkey" FOREIGN KEY ("result_version_id") REFERENCES "document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_proposals" ADD CONSTRAINT "correction_proposals_generated_by_id_fkey" FOREIGN KEY ("generated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_proposals" ADD CONSTRAINT "correction_proposals_applied_by_id_fkey" FOREIGN KEY ("applied_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

