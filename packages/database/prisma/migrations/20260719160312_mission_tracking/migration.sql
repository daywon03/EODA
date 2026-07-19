-- CreateEnum
CREATE TYPE "MissionChecklistScope" AS ENUM ('DIAGNOSTIC', 'FONDATIONS', 'DEPLOIEMENT', 'CONSOLIDATION', 'PREPARATION_FINALE');

-- CreateTable
CREATE TABLE "mission_checklist_items" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "scope" "MissionChecklistScope" NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "mission_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "missions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "establishment_id" TEXT NOT NULL,
    "formule" "CommercialTier" NOT NULL,
    "gratuit" BOOLEAN NOT NULL DEFAULT false,
    "fondations_start_date" TIMESTAMP(3),
    "fondations_end_date" TIMESTAMP(3),
    "deploiement_start_date" TIMESTAMP(3),
    "deploiement_end_date" TIMESTAMP(3),
    "consolidation_start_date" TIMESTAMP(3),
    "consolidation_end_date" TIMESTAMP(3),
    "preparation_finale_start_date" TIMESTAMP(3),
    "preparation_finale_end_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "missions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mission_checklist_item_statuses" (
    "id" TEXT NOT NULL,
    "mission_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "mission_checklist_item_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mission_checklist_items_code_key" ON "mission_checklist_items"("code");

-- CreateIndex
CREATE UNIQUE INDEX "missions_establishment_id_key" ON "missions"("establishment_id");

-- CreateIndex
CREATE UNIQUE INDEX "mission_checklist_item_statuses_mission_id_item_id_key" ON "mission_checklist_item_statuses"("mission_id", "item_id");

-- AddForeignKey
ALTER TABLE "missions" ADD CONSTRAINT "missions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missions" ADD CONSTRAINT "missions_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission_checklist_item_statuses" ADD CONSTRAINT "mission_checklist_item_statuses_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission_checklist_item_statuses" ADD CONSTRAINT "mission_checklist_item_statuses_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "mission_checklist_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
