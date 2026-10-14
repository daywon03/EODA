-- Lot C (terrain) — 14/10/2026. Migration ADDITIVE : nouveaux types et nouvelles tables,
-- aucune colonne existante modifiée, aucune donnée insérée.
--
-- ⚠️ Les tables usager (beneficiaries, beneficiary_*, signature_evidences,
-- delivery_records, survey_*) restent VIDES sur l'infrastructure actuelle : elles ne
-- s'écrivent que par BeneficiaryDataPort, verrouillé tant que le backend n'est pas
-- chez un hébergeur certifié HDS (ADR .claude/specs/adr/20261014_ADR_lot-C-verrou-HDS.md).
-- device_enrollments et staff_pins portent des données de salariés, hors verrou.

-- CreateEnum
CREATE TYPE "RepresentativeKind" AS ENUM ('PROCHE', 'TUTEUR', 'CURATEUR');

-- CreateEnum
CREATE TYPE "BeneficiaryDocumentKind" AS ENUM ('FEUILLE_RECEPTION', 'DIPC', 'PAP', 'LIVRET_REMIS', 'REGLEMENT_REMIS');

-- CreateEnum
CREATE TYPE "SignerRole" AS ENUM ('PERSONNE', 'REPRESENTANT', 'SERVICE');

-- CreateEnum
CREATE TYPE "DeliveryChannel" AS ENUM ('MAIN_PROPRE', 'EMAIL');

-- CreateEnum
CREATE TYPE "SurveyTemplateCode" AS ENUM ('PERSONNE', 'FAMILLE');

-- CreateEnum
CREATE TYPE "SurveyRespondentKind" AS ENUM ('PERSONNE', 'PROCHE');

-- CreateEnum
CREATE TYPE "SurveyMode" AS ENUM ('ASSISTEE', 'SEULE');

-- CreateEnum
CREATE TYPE "SurveyChoice" AS ENUM ('TRES', 'PLUTOT', 'PEU', 'PAS', 'NSP', 'NON_CONCERNE');

-- CreateTable
CREATE TABLE "beneficiaries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "establishment_id" TEXT NOT NULL,
    "civility" "Civility",
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "birth_date" DATE,
    "address" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "gir_level" INTEGER,
    "monthly_hours" INTEGER,
    "started_on" DATE NOT NULL,
    "referent_staff_member_id" TEXT,
    "external_erp_id" TEXT,
    "ended_on" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beneficiaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beneficiary_representatives" (
    "id" TEXT NOT NULL,
    "beneficiary_id" TEXT NOT NULL,
    "kind" "RepresentativeKind" NOT NULL,
    "full_name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beneficiary_representatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beneficiary_documents" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "establishment_id" TEXT NOT NULL,
    "beneficiary_id" TEXT NOT NULL,
    "kind" "BeneficiaryDocumentKind" NOT NULL,
    "source_template_version_id" TEXT,
    "rendered_file_key" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL,
    "renew_due_on" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beneficiary_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signature_evidences" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "signer_role" "SignerRole" NOT NULL,
    "signer_name" TEXT NOT NULL,
    "witness_staff_member_id" TEXT NOT NULL,
    "device_enrollment_id" TEXT NOT NULL,
    "signed_at" TIMESTAMP(3) NOT NULL,
    "signature_image_key" TEXT NOT NULL,
    "document_sha256" TEXT NOT NULL,
    "checklist_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signature_evidences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_records" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "channel" "DeliveryChannel" NOT NULL,
    "delivered_at" TIMESTAMP(3) NOT NULL,
    "recorded_by_staff_member_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beneficiary_journal_entries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "beneficiary_id" TEXT NOT NULL,
    "author_staff_member_id" TEXT,
    "author_user_id" TEXT,
    "text" TEXT NOT NULL,
    "possible_adverse_event" BOOLEAN NOT NULL DEFAULT false,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beneficiary_journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_responses" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "establishment_id" TEXT NOT NULL,
    "beneficiary_id" TEXT,
    "template_code" "SurveyTemplateCode" NOT NULL,
    "template_version" INTEGER NOT NULL,
    "respondent_kind" "SurveyRespondentKind" NOT NULL,
    "mode" "SurveyMode" NOT NULL,
    "collected_by_staff_member_id" TEXT,
    "completed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_answers" (
    "id" TEXT NOT NULL,
    "response_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "choice" "SurveyChoice",
    "free_text" TEXT,

    CONSTRAINT "survey_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_enrollments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "establishment_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "enrolled_by_user_id" TEXT,
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "revoked_by_user_id" TEXT,

    CONSTRAINT "device_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_pins" (
    "id" TEXT NOT NULL,
    "staff_member_id" TEXT NOT NULL,
    "pin_hash" TEXT NOT NULL,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_at" TIMESTAMP(3),
    "set_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "beneficiaries_tenant_id_idx" ON "beneficiaries"("tenant_id");

-- CreateIndex
CREATE INDEX "beneficiaries_establishment_id_ended_on_idx" ON "beneficiaries"("establishment_id", "ended_on");

-- CreateIndex
CREATE INDEX "beneficiaries_referent_staff_member_id_idx" ON "beneficiaries"("referent_staff_member_id");

-- CreateIndex
CREATE INDEX "beneficiary_representatives_beneficiary_id_idx" ON "beneficiary_representatives"("beneficiary_id");

-- CreateIndex
CREATE INDEX "beneficiary_documents_tenant_id_idx" ON "beneficiary_documents"("tenant_id");

-- CreateIndex
CREATE INDEX "beneficiary_documents_establishment_id_renew_due_on_idx" ON "beneficiary_documents"("establishment_id", "renew_due_on");

-- CreateIndex
CREATE INDEX "beneficiary_documents_beneficiary_id_idx" ON "beneficiary_documents"("beneficiary_id");

-- CreateIndex
CREATE INDEX "beneficiary_documents_source_template_version_id_idx" ON "beneficiary_documents"("source_template_version_id");

-- CreateIndex
CREATE INDEX "signature_evidences_document_id_idx" ON "signature_evidences"("document_id");

-- CreateIndex
CREATE INDEX "signature_evidences_witness_staff_member_id_idx" ON "signature_evidences"("witness_staff_member_id");

-- CreateIndex
CREATE INDEX "signature_evidences_device_enrollment_id_idx" ON "signature_evidences"("device_enrollment_id");

-- CreateIndex
CREATE INDEX "delivery_records_document_id_idx" ON "delivery_records"("document_id");

-- CreateIndex
CREATE INDEX "delivery_records_recorded_by_staff_member_id_idx" ON "delivery_records"("recorded_by_staff_member_id");

-- CreateIndex
CREATE INDEX "beneficiary_journal_entries_tenant_id_idx" ON "beneficiary_journal_entries"("tenant_id");

-- CreateIndex
CREATE INDEX "beneficiary_journal_entries_beneficiary_id_occurred_at_idx" ON "beneficiary_journal_entries"("beneficiary_id", "occurred_at");

-- CreateIndex
CREATE INDEX "beneficiary_journal_entries_author_staff_member_id_idx" ON "beneficiary_journal_entries"("author_staff_member_id");

-- CreateIndex
CREATE INDEX "beneficiary_journal_entries_author_user_id_idx" ON "beneficiary_journal_entries"("author_user_id");

-- CreateIndex
CREATE INDEX "survey_responses_tenant_id_idx" ON "survey_responses"("tenant_id");

-- CreateIndex
CREATE INDEX "survey_responses_establishment_id_completed_at_idx" ON "survey_responses"("establishment_id", "completed_at");

-- CreateIndex
CREATE INDEX "survey_responses_beneficiary_id_idx" ON "survey_responses"("beneficiary_id");

-- CreateIndex
CREATE INDEX "survey_responses_collected_by_staff_member_id_idx" ON "survey_responses"("collected_by_staff_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "survey_answers_response_id_question_id_key" ON "survey_answers"("response_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "device_enrollments_token_hash_key" ON "device_enrollments"("token_hash");

-- CreateIndex
CREATE INDEX "device_enrollments_tenant_id_idx" ON "device_enrollments"("tenant_id");

-- CreateIndex
CREATE INDEX "device_enrollments_establishment_id_revoked_at_idx" ON "device_enrollments"("establishment_id", "revoked_at");

-- CreateIndex
CREATE INDEX "device_enrollments_enrolled_by_user_id_idx" ON "device_enrollments"("enrolled_by_user_id");

-- CreateIndex
CREATE INDEX "device_enrollments_revoked_by_user_id_idx" ON "device_enrollments"("revoked_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_pins_staff_member_id_key" ON "staff_pins"("staff_member_id");

-- CreateIndex
CREATE INDEX "staff_pins_set_by_user_id_idx" ON "staff_pins"("set_by_user_id");

-- AddForeignKey
ALTER TABLE "beneficiaries" ADD CONSTRAINT "beneficiaries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiaries" ADD CONSTRAINT "beneficiaries_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiaries" ADD CONSTRAINT "beneficiaries_referent_staff_member_id_fkey" FOREIGN KEY ("referent_staff_member_id") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiary_representatives" ADD CONSTRAINT "beneficiary_representatives_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiary_documents" ADD CONSTRAINT "beneficiary_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiary_documents" ADD CONSTRAINT "beneficiary_documents_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiary_documents" ADD CONSTRAINT "beneficiary_documents_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiary_documents" ADD CONSTRAINT "beneficiary_documents_source_template_version_id_fkey" FOREIGN KEY ("source_template_version_id") REFERENCES "template_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_evidences" ADD CONSTRAINT "signature_evidences_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "beneficiary_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_evidences" ADD CONSTRAINT "signature_evidences_witness_staff_member_id_fkey" FOREIGN KEY ("witness_staff_member_id") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_evidences" ADD CONSTRAINT "signature_evidences_device_enrollment_id_fkey" FOREIGN KEY ("device_enrollment_id") REFERENCES "device_enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_records" ADD CONSTRAINT "delivery_records_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "beneficiary_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_records" ADD CONSTRAINT "delivery_records_recorded_by_staff_member_id_fkey" FOREIGN KEY ("recorded_by_staff_member_id") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiary_journal_entries" ADD CONSTRAINT "beneficiary_journal_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiary_journal_entries" ADD CONSTRAINT "beneficiary_journal_entries_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiary_journal_entries" ADD CONSTRAINT "beneficiary_journal_entries_author_staff_member_id_fkey" FOREIGN KEY ("author_staff_member_id") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiary_journal_entries" ADD CONSTRAINT "beneficiary_journal_entries_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_collected_by_staff_member_id_fkey" FOREIGN KEY ("collected_by_staff_member_id") REFERENCES "staff_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "survey_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_enrollments" ADD CONSTRAINT "device_enrollments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_enrollments" ADD CONSTRAINT "device_enrollments_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_enrollments" ADD CONSTRAINT "device_enrollments_enrolled_by_user_id_fkey" FOREIGN KEY ("enrolled_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_enrollments" ADD CONSTRAINT "device_enrollments_revoked_by_user_id_fkey" FOREIGN KEY ("revoked_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_pins" ADD CONSTRAINT "staff_pins_staff_member_id_fkey" FOREIGN KEY ("staff_member_id") REFERENCES "staff_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_pins" ADD CONSTRAINT "staff_pins_set_by_user_id_fkey" FOREIGN KEY ("set_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

