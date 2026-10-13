-- Rôles cabinet et affectation consultante ↔ structures — tranche N9, 13/10/2026.
--
-- ADDITIVE uniquement : deux valeurs de rôle, quatre valeurs d'audit, une colonne
-- nullable (dernière connexion) et une table neuve avec ses index (chaque clé
-- étrangère indexée, convention P6). Aucune donnée réécrite : aucun compte ne change
-- de rôle, aucune affectation n'est créée — un CABINET_EVALUATOR sans affectation
-- garde l'accès à toutes les structures (compatibilité, cf. schema.prisma).
-- Migration générée schéma à schéma (prisma migrate diff --from-schema-datamodel),
-- sans connexion à la base ; application : migrate deploy uniquement.

-- AlterEnum


ALTER TYPE "UserRole" ADD VALUE 'CABINET_COMMERCIAL';
ALTER TYPE "UserRole" ADD VALUE 'CABINET_READONLY';

-- AlterEnum


ALTER TYPE "AuditAction" ADD VALUE 'CABINET_USER_INVITED';
ALTER TYPE "AuditAction" ADD VALUE 'CABINET_USER_ROLE_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'CABINET_USER_ACCESS_REMOVED';
ALTER TYPE "AuditAction" ADD VALUE 'CABINET_USER_ASSIGNMENTS_UPDATED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_login_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "establishment_assignments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "establishment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "establishment_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "establishment_assignments_tenant_id_idx" ON "establishment_assignments"("tenant_id");

-- CreateIndex
CREATE INDEX "establishment_assignments_establishment_id_idx" ON "establishment_assignments"("establishment_id");

-- CreateIndex
CREATE UNIQUE INDEX "establishment_assignments_user_id_establishment_id_key" ON "establishment_assignments"("user_id", "establishment_id");

-- AddForeignKey
ALTER TABLE "establishment_assignments" ADD CONSTRAINT "establishment_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "establishment_assignments" ADD CONSTRAINT "establishment_assignments_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "establishment_assignments" ADD CONSTRAINT "establishment_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

