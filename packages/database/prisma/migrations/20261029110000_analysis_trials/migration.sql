-- LABORATOIRE D'ANALYSE (29/10/2026) — voir le prompt envoyé, essayer plusieurs
-- versions, faire juger les résultats par la consultante.
--
--   - document_versions : avec quoi l'analyse officielle a été produite (version du
--     prompt, modèle, date) — colonnes facultatives, `NULL` = analyse antérieure ;
--   - analysis_trials : un essai = une version de prompt lancée sur une version de
--     document, SANS toucher à son analyse officielle, avec le verdict de la
--     consultante (jeu d'évaluation) ;
--   - trois actions de journal.
--
-- Additive : aucune suppression, aucune réécriture. Migration écrite à la main ;
-- application : `pnpm db:migrate:deploy` uniquement.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ANALYSIS_PROMPT_VIEWED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ANALYSIS_TRIAL_RUN';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ANALYSIS_TRIAL_JUDGED';

CREATE TYPE "AnalysisVerdict" AS ENUM ('BON', 'A_REVOIR');

ALTER TABLE "document_versions"
  ADD COLUMN "analysis_prompt_variant" TEXT,
  ADD COLUMN "analysis_prompt_version" INTEGER,
  ADD COLUMN "analysis_model" TEXT,
  ADD COLUMN "analyzed_at" TIMESTAMP(3);

CREATE TABLE "analysis_trials" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "document_version_id" TEXT NOT NULL,
    "prompt_variant" TEXT NOT NULL,
    "prompt_version" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "result_json" JSONB NOT NULL,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verdict" "AnalysisVerdict",
    "verdict_note" TEXT,
    "judged_by_user_id" TEXT,
    "judged_at" TIMESTAMP(3),

    CONSTRAINT "analysis_trials_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "analysis_trials_tenant_id_idx" ON "analysis_trials"("tenant_id");
CREATE INDEX "analysis_trials_document_version_id_idx" ON "analysis_trials"("document_version_id");
CREATE INDEX "analysis_trials_created_by_user_id_idx" ON "analysis_trials"("created_by_user_id");
CREATE INDEX "analysis_trials_judged_by_user_id_idx" ON "analysis_trials"("judged_by_user_id");

ALTER TABLE "analysis_trials" ADD CONSTRAINT "analysis_trials_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analysis_trials" ADD CONSTRAINT "analysis_trials_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analysis_trials" ADD CONSTRAINT "analysis_trials_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "analysis_trials" ADD CONSTRAINT "analysis_trials_judged_by_user_id_fkey" FOREIGN KEY ("judged_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
