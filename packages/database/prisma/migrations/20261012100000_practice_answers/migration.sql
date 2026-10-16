-- Questions sur les pratiques — tranche N7 des maquettes v2, 12/10/2026.
--
-- ADDITIVE uniquement : un type, une valeur d'audit, une table neuve et ses index
-- (chaque clé étrangère indexée, convention P6). Aucune donnée réécrite. Le TEXTE des
-- questions est un contenu versionné (apps/web/src/content/pratiques/), jamais une
-- colonne : seule la réponse de la structure est stockée, append-only.
-- Migration générée schéma à schéma (prisma migrate diff --from-schema-datamodel),
-- sans connexion à la base ; application : migrate deploy uniquement.

-- CreateEnum
CREATE TYPE "PracticeAnswerValue" AS ENUM ('OUI', 'EN_PARTIE', 'PAS_ENCORE', 'NE_SAIS_PAS');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'PRACTICE_ANSWER_SAVED';

-- CreateTable
CREATE TABLE "practice_answers" (
    "id" TEXT NOT NULL,
    "establishment_id" TEXT NOT NULL,
    "criterion_id" TEXT NOT NULL,
    "question_version" INTEGER NOT NULL,
    "answer" "PracticeAnswerValue" NOT NULL,
    "text" TEXT,
    "answered_by_id" TEXT,
    "answered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practice_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "practice_answers_establishment_id_criterion_id_answered_at_idx" ON "practice_answers"("establishment_id", "criterion_id", "answered_at");

-- CreateIndex
CREATE INDEX "practice_answers_criterion_id_idx" ON "practice_answers"("criterion_id");

-- CreateIndex
CREATE INDEX "practice_answers_answered_by_id_idx" ON "practice_answers"("answered_by_id");

-- AddForeignKey
ALTER TABLE "practice_answers" ADD CONSTRAINT "practice_answers_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_answers" ADD CONSTRAINT "practice_answers_criterion_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "criteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_answers" ADD CONSTRAINT "practice_answers_answered_by_id_fkey" FOREIGN KEY ("answered_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

