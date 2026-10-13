-- Libre-service : inscription en ligne d'une structure, espace prospect, « Être
-- accompagné » — maquettes v2, décision 1 du plan v2 (D5), 13/10/2026.
--
-- ADDITIVE uniquement : un rôle (PROSPECT_USER), un canal d'acquisition
-- (LIBRE_SERVICE), un statut de rendez-vous (DEMANDE), cinq valeurs d'audit, deux
-- tables neuves et leurs index (chaque clé étrangère indexée, convention P6).
-- Aucune donnée réécrite. Une inscription crée un PROSPECT et un compte rattaché —
-- jamais un établissement (une fiche ne naît que de la signature d'un devis).
-- Migration générée schéma à schéma (prisma migrate diff --from-schema-datamodel),
-- sans connexion à la base ; application : migrate deploy uniquement.

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'PROSPECT_USER';

-- AlterEnum
ALTER TYPE "AppointmentStatus" ADD VALUE 'DEMANDE';

-- AlterEnum
ALTER TYPE "AcquisitionChannel" ADD VALUE 'LIBRE_SERVICE';

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'SELF_SERVICE_SIGNUP';
ALTER TYPE "AuditAction" ADD VALUE 'SELF_SERVICE_SIGNUP_RATE_LIMITED';
ALTER TYPE "AuditAction" ADD VALUE 'ACCOMPANIMENT_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE 'PROSPECT_REMINDER_SENT';
ALTER TYPE "AuditAction" ADD VALUE 'PROSPECT_PRACTICE_ANSWERED';

-- CreateTable
CREATE TABLE "prospect_accounts" (
    "id" TEXT NOT NULL,
    "prospect_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospect_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospect_practice_answers" (
    "id" TEXT NOT NULL,
    "prospect_id" TEXT NOT NULL,
    "criterion_id" TEXT NOT NULL,
    "question_version" INTEGER NOT NULL,
    "answer" "PracticeAnswerValue" NOT NULL,
    "text" TEXT,
    "answered_by_id" TEXT,
    "answered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospect_practice_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prospect_accounts_user_id_key" ON "prospect_accounts"("user_id");

-- CreateIndex
CREATE INDEX "prospect_accounts_prospect_id_idx" ON "prospect_accounts"("prospect_id");

-- CreateIndex
CREATE INDEX "prospect_practice_answers_prospect_id_criterion_id_answered_idx" ON "prospect_practice_answers"("prospect_id", "criterion_id", "answered_at");

-- CreateIndex
CREATE INDEX "prospect_practice_answers_criterion_id_idx" ON "prospect_practice_answers"("criterion_id");

-- CreateIndex
CREATE INDEX "prospect_practice_answers_answered_by_id_idx" ON "prospect_practice_answers"("answered_by_id");

-- AddForeignKey
ALTER TABLE "prospect_accounts" ADD CONSTRAINT "prospect_accounts_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospect_accounts" ADD CONSTRAINT "prospect_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospect_practice_answers" ADD CONSTRAINT "prospect_practice_answers_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospect_practice_answers" ADD CONSTRAINT "prospect_practice_answers_criterion_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "criteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospect_practice_answers" ADD CONSTRAINT "prospect_practice_answers_answered_by_id_fkey" FOREIGN KEY ("answered_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

