-- Validation du diagnostic en deux gestes — tranche N6 des maquettes v2, 12/10/2026.
--
-- ADDITIVE uniquement : trois valeurs d'audit, une table neuve et ses index (chaque
-- clé étrangère indexée, convention P6). Aucune donnée réécrite. Le diagnostic reste
-- DÉRIVÉ (critères & preuves) ; seuls les gestes « relu par EODA » et « accepté par
-- la structure » sont stockés, avec la photo de ce qui a été relu.
-- Migration générée schéma à schéma (prisma migrate diff --from-schema-datamodel),
-- sans connexion à la base ; application : migrate deploy uniquement.

-- AlterEnum


ALTER TYPE "AuditAction" ADD VALUE 'DIAGNOSTIC_REVIEWED_BY_EODA';
ALTER TYPE "AuditAction" ADD VALUE 'DIAGNOSTIC_ACCEPTED_BY_CLIENT';
ALTER TYPE "AuditAction" ADD VALUE 'DIAGNOSTIC_REPORT_PRINTED';

-- CreateTable
CREATE TABLE "diagnostic_validations" (
    "id" TEXT NOT NULL,
    "establishment_id" TEXT NOT NULL,
    "snapshot_json" JSONB NOT NULL,
    "reviewed_by_eoda_at" TIMESTAMP(3),
    "reviewed_by_eoda_by_id" TEXT,
    "accepted_by_client_at" TIMESTAMP(3),
    "accepted_by_client_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnostic_validations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "diagnostic_validations_establishment_id_created_at_idx" ON "diagnostic_validations"("establishment_id", "created_at");

-- CreateIndex
CREATE INDEX "diagnostic_validations_reviewed_by_eoda_by_id_idx" ON "diagnostic_validations"("reviewed_by_eoda_by_id");

-- CreateIndex
CREATE INDEX "diagnostic_validations_accepted_by_client_by_id_idx" ON "diagnostic_validations"("accepted_by_client_by_id");

-- AddForeignKey
ALTER TABLE "diagnostic_validations" ADD CONSTRAINT "diagnostic_validations_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_validations" ADD CONSTRAINT "diagnostic_validations_reviewed_by_eoda_by_id_fkey" FOREIGN KEY ("reviewed_by_eoda_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_validations" ADD CONSTRAINT "diagnostic_validations_accepted_by_client_by_id_fkey" FOREIGN KEY ("accepted_by_client_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

