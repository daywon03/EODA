-- Tâches = plan d'action (PAC) — tranche N5 des maquettes v2, 11/10/2026.
--
-- ADDITIVE uniquement : deux types, quatre valeurs d'audit, une table neuve et ses
-- index (chaque clé étrangère indexée, convention P6). Aucune donnée réécrite.
-- « En retard » n'est PAS une colonne : il se dérive (action-item-service).
-- Migration générée schéma à schéma (prisma migrate diff --from-schema-datamodel),
-- sans connexion à la base ; application : migrate deploy uniquement.

-- CreateEnum
CREATE TYPE "ActionOwnerKind" AS ENUM ('CABINET', 'STRUCTURE');

-- CreateEnum
CREATE TYPE "ActionSource" AS ENUM ('MANUEL', 'DOCUMENT', 'DIAGNOSTIC', 'PAC', 'ENQUETE', 'QUIZ');

-- AlterEnum


ALTER TYPE "AuditAction" ADD VALUE 'ACTION_ITEM_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'ACTION_ITEM_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE 'ACTION_ITEM_REOPENED';
ALTER TYPE "AuditAction" ADD VALUE 'ACTION_ITEM_REASSIGNED';

-- CreateTable
CREATE TABLE "action_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "establishment_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "owner_kind" "ActionOwnerKind" NOT NULL,
    "owner_user_id" TEXT,
    "owner_function" "EstablishmentUserRole",
    "due_on" DATE,
    "done_at" TIMESTAMP(3),
    "done_by_user_id" TEXT,
    "source" "ActionSource" NOT NULL DEFAULT 'MANUEL',
    "linked_document_id" TEXT,
    "linked_criterion_id" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "action_items_tenant_id_idx" ON "action_items"("tenant_id");

-- CreateIndex
CREATE INDEX "action_items_establishment_id_done_at_idx" ON "action_items"("establishment_id", "done_at");

-- CreateIndex
CREATE INDEX "action_items_owner_user_id_idx" ON "action_items"("owner_user_id");

-- CreateIndex
CREATE INDEX "action_items_done_by_user_id_idx" ON "action_items"("done_by_user_id");

-- CreateIndex
CREATE INDEX "action_items_created_by_user_id_idx" ON "action_items"("created_by_user_id");

-- CreateIndex
CREATE INDEX "action_items_linked_document_id_idx" ON "action_items"("linked_document_id");

-- CreateIndex
CREATE INDEX "action_items_linked_criterion_id_idx" ON "action_items"("linked_criterion_id");

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_done_by_user_id_fkey" FOREIGN KEY ("done_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_linked_document_id_fkey" FOREIGN KEY ("linked_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_linked_criterion_id_fkey" FOREIGN KEY ("linked_criterion_id") REFERENCES "criteria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

