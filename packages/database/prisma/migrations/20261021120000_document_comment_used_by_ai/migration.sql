-- « Commentaire sur ce document » remis à l'IA, oui ou non (21/10/2026). Oui par défaut
-- pour tous les documents existants.
ALTER TABLE "documents" ADD COLUMN "comment_used_by_ai" BOOLEAN NOT NULL DEFAULT true;

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DOCUMENT_COMMENT_AI_TOGGLED';
