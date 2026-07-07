-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CABINET_ADMIN', 'CABINET_EVALUATOR', 'CLIENT_USER');

-- CreateEnum
CREATE TYPE "EstablishmentType" AS ENUM ('SAD_AIDE', 'SAD_MIXTE');

-- CreateEnum
CREATE TYPE "CommercialTier" AS ENUM ('BETA', 'ESSENTIEL', 'PERFORMANCE', 'EXCELLENCE');

-- CreateEnum
CREATE TYPE "EstablishmentUserRole" AS ENUM ('DIRECTEUR', 'COORDINATEUR', 'ASSISTANT_QUALITE', 'AUTRE');

-- CreateEnum
CREATE TYPE "RequirementLevel" AS ENUM ('IMPERATIF', 'STANDARD');

-- CreateEnum
CREATE TYPE "ApplicableTo" AS ENUM ('SAD_AIDE', 'SAD_MIXTE', 'BOTH');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('LOI_2002_2', 'FONCTIONNEMENT', 'QUALITE_RISQUES', 'RH');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('MISSING', 'UPLOADED', 'ANALYZING', 'INCOMPLETE', 'COMPLIANT', 'EXPIRED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "ExpectedFrequency" AS ENUM ('ANNUAL', 'BIANNUAL', 'TRIENNIAL', 'ON_DEMAND');

-- CreateEnum
CREATE TYPE "Rating" AS ENUM ('R1', 'R2', 'R3', 'R4', 'STAR', 'NC', 'RI');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CLIENT_USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "establishments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "finess_number" TEXT,
    "type" "EstablishmentType" NOT NULL,
    "address" TEXT,
    "commercial_tier" "CommercialTier" NOT NULL DEFAULT 'BETA',
    "has_evaluation_target_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "establishments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "establishment_users" (
    "user_id" TEXT NOT NULL,
    "establishment_id" TEXT NOT NULL,
    "role_in_establishment" "EstablishmentUserRole" NOT NULL,

    CONSTRAINT "establishment_users_pkey" PRIMARY KEY ("user_id","establishment_id")
);

-- CreateTable
CREATE TABLE "has_referential_versions" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "effective_date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "has_referential_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" TEXT NOT NULL,
    "referential_version_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "method" TEXT NOT NULL,

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "themes" (
    "id" TEXT NOT NULL,
    "chapter_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "themes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objectives" (
    "id" TEXT NOT NULL,
    "theme_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "weight_percent" DOUBLE PRECISION,

    CONSTRAINT "objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "criteria" (
    "id" TEXT NOT NULL,
    "objective_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "requirement_level" "RequirementLevel" NOT NULL,
    "applicable_to" "ApplicableTo" NOT NULL,

    CONSTRAINT "criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_elements" (
    "id" TEXT NOT NULL,
    "criterion_id" TEXT NOT NULL,
    "original_text" TEXT NOT NULL,
    "reformulated_text" TEXT,
    "allows_ri" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "evaluation_elements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "label" TEXT NOT NULL,
    "is_conditional" BOOLEAN NOT NULL DEFAULT false,
    "expected_frequency" "ExpectedFrequency",

    CONSTRAINT "document_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_type_criteria" (
    "document_type_id" TEXT NOT NULL,
    "criterion_id" TEXT NOT NULL,

    CONSTRAINT "document_type_criteria_pkey" PRIMARY KEY ("document_type_id","criterion_id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "establishment_id" TEXT NOT NULL,
    "document_type_id" TEXT,
    "current_version_id" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'MISSING',
    "status_overridden_by_user" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "file_storage_key" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "uploaded_by_user_id" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extracted_text" TEXT,
    "analysis_result_json" JSONB,
    "regenerated_from_version_id" TEXT,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_sessions" (
    "id" TEXT NOT NULL,
    "establishment_id" TEXT NOT NULL,
    "chapter_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "duration_seconds" INTEGER,
    "performed_by_user_id" TEXT NOT NULL,

    CONSTRAINT "evaluation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "element_ratings" (
    "id" TEXT NOT NULL,
    "evaluation_session_id" TEXT NOT NULL,
    "evaluation_element_id" TEXT NOT NULL,
    "rating" "Rating" NOT NULL,
    "comment" TEXT,
    "suggested_by_system" BOOLEAN NOT NULL DEFAULT false,
    "confirmed_by_user" BOOLEAN NOT NULL DEFAULT false,
    "rated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "element_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "establishments_finess_number_key" ON "establishments"("finess_number");

-- CreateIndex
CREATE UNIQUE INDEX "criteria_code_key" ON "criteria"("code");

-- CreateIndex
CREATE UNIQUE INDEX "document_types_code_key" ON "document_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "documents_current_version_id_key" ON "documents"("current_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "element_ratings_evaluation_session_id_evaluation_element_id_key" ON "element_ratings"("evaluation_session_id", "evaluation_element_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "establishments" ADD CONSTRAINT "establishments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "establishment_users" ADD CONSTRAINT "establishment_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "establishment_users" ADD CONSTRAINT "establishment_users_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_referential_version_id_fkey" FOREIGN KEY ("referential_version_id") REFERENCES "has_referential_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "themes" ADD CONSTRAINT "themes_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "themes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "criteria" ADD CONSTRAINT "criteria_objective_id_fkey" FOREIGN KEY ("objective_id") REFERENCES "objectives"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_elements" ADD CONSTRAINT "evaluation_elements_criterion_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "criteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_type_criteria" ADD CONSTRAINT "document_type_criteria_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_type_criteria" ADD CONSTRAINT "document_type_criteria_criterion_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "criteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_regenerated_from_version_id_fkey" FOREIGN KEY ("regenerated_from_version_id") REFERENCES "document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_sessions" ADD CONSTRAINT "evaluation_sessions_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_sessions" ADD CONSTRAINT "evaluation_sessions_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_sessions" ADD CONSTRAINT "evaluation_sessions_performed_by_user_id_fkey" FOREIGN KEY ("performed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "element_ratings" ADD CONSTRAINT "element_ratings_evaluation_session_id_fkey" FOREIGN KEY ("evaluation_session_id") REFERENCES "evaluation_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "element_ratings" ADD CONSTRAINT "element_ratings_evaluation_element_id_fkey" FOREIGN KEY ("evaluation_element_id") REFERENCES "evaluation_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
