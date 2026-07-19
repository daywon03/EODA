-- CreateEnum
CREATE TYPE "ProspectStatus" AS ENUM ('NOUVEAU', 'RDV', 'DEVIS_ENVOYE', 'NEGOCIATION', 'SIGNE', 'PERDU');

-- CreateEnum
CREATE TYPE "ProspectType" AS ENUM ('ASSOCIATION', 'PRIVE', 'PUBLIC');

-- CreateEnum
CREATE TYPE "AcquisitionChannel" AS ENUM ('BOUCHE_A_OREILLE', 'REFERENCEMENT_UNA', 'EMAILING', 'REFERENCEMENT_GOOGLE', 'LINKEDIN', 'AUTRE');

-- CreateEnum
CREATE TYPE "DevisStatus" AS ENUM ('BROUILLON', 'ENVOYE', 'SIGNE', 'REFUSE');

-- CreateTable
CREATE TABLE "catalogue_formules" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "formule" "CommercialTier" NOT NULL,
    "label" TEXT NOT NULL,
    "price_euros" INTEGER NOT NULL,
    "modules_label" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalogue_formules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogue_options" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "price_euros" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalogue_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "default_deposit_percent" INTEGER NOT NULL DEFAULT 30,
    "default_validity_days" INTEGER NOT NULL DEFAULT 30,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devis_counters" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "devis_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospects" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "structure_name" TEXT NOT NULL,
    "structure_type" "ProspectType" NOT NULL,
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "channel" "AcquisitionChannel" NOT NULL,
    "status" "ProspectStatus" NOT NULL DEFAULT 'NOUVEAU',
    "envisaged_formule" "CommercialTier",
    "estimated_amount_euros" INTEGER,
    "first_contact_date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "establishment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prospects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devis" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "prospect_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "DevisStatus" NOT NULL DEFAULT 'BROUILLON',
    "catalogue_formule_id" TEXT NOT NULL,
    "formule_label_snapshot" TEXT NOT NULL,
    "formule_price_snapshot_euros" INTEGER NOT NULL,
    "deposit_percent" INTEGER NOT NULL,
    "installment_count" INTEGER NOT NULL,
    "validity_days" INTEGER NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "total_amount_euros" INTEGER NOT NULL,
    "deposit_amount_euros" INTEGER NOT NULL,
    "balance_amount_euros" INTEGER NOT NULL,
    "installment_amount_euros" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devis_options" (
    "id" TEXT NOT NULL,
    "devis_id" TEXT NOT NULL,
    "catalogue_option_id" TEXT NOT NULL,
    "label_snapshot" TEXT NOT NULL,
    "price_snapshot_euros" INTEGER NOT NULL,

    CONSTRAINT "devis_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "catalogue_formules_tenant_id_formule_key" ON "catalogue_formules"("tenant_id", "formule");

-- CreateIndex
CREATE UNIQUE INDEX "catalogue_options_tenant_id_code_key" ON "catalogue_options"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "billing_settings_tenant_id_key" ON "billing_settings"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "devis_counters_tenant_id_year_key" ON "devis_counters"("tenant_id", "year");

-- CreateIndex
CREATE UNIQUE INDEX "prospects_establishment_id_key" ON "prospects"("establishment_id");

-- CreateIndex
CREATE UNIQUE INDEX "devis_number_key" ON "devis"("number");

-- CreateIndex
CREATE UNIQUE INDEX "devis_options_devis_id_catalogue_option_id_key" ON "devis_options"("devis_id", "catalogue_option_id");

-- AddForeignKey
ALTER TABLE "catalogue_formules" ADD CONSTRAINT "catalogue_formules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogue_options" ADD CONSTRAINT "catalogue_options_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_settings" ADD CONSTRAINT "billing_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devis_counters" ADD CONSTRAINT "devis_counters_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devis" ADD CONSTRAINT "devis_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devis" ADD CONSTRAINT "devis_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devis" ADD CONSTRAINT "devis_catalogue_formule_id_fkey" FOREIGN KEY ("catalogue_formule_id") REFERENCES "catalogue_formules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devis_options" ADD CONSTRAINT "devis_options_devis_id_fkey" FOREIGN KEY ("devis_id") REFERENCES "devis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devis_options" ADD CONSTRAINT "devis_options_catalogue_option_id_fkey" FOREIGN KEY ("catalogue_option_id") REFERENCES "catalogue_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
