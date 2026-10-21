-- Call du 18/10/2026 : un commentaire du cabinet sur l'analyse peut être pris en
-- compte par l'IA ou non. Toutes les guidelines existantes restent en service.
ALTER TABLE "criterion_guidelines" ADD COLUMN "ai_enabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CRITERION_GUIDELINE_AI_TOGGLED';
