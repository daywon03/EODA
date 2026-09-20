-- Suggestion de critère HAS détectée par l'IA sur un GABARIT (bibliothèque de
-- modèles) — pendant de document_criterion_suggestions pour la bibliothèque.
-- « Fait tout ce qu'il y a dans l'artifact » (Damon, 20/09/2026) : la pipeline
-- visuelle (dépôt → extraction → détection IA → cohérence → revue → publié)
-- manquait cette brique côté gabarits.
--
-- Pas de profil SAD ici : un gabarit n'appartient à aucune structure.
--
-- Migration écrite à la main. Application : `pnpm db:migrate:deploy` uniquement.

CREATE TABLE "template_criterion_suggestions" (
    "id" TEXT NOT NULL,
    "template_document_id" TEXT NOT NULL,
    "criterion_id" TEXT NOT NULL,
    "template_version_id" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "status" "CriterionSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_criterion_suggestions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "template_criterion_suggestions_template_document_id_criterion_key"
  ON "template_criterion_suggestions"("template_document_id", "criterion_id");
CREATE INDEX "template_criterion_suggestions_criterion_id_idx"
  ON "template_criterion_suggestions"("criterion_id");
CREATE INDEX "template_criterion_suggestions_template_document_id_status_idx"
  ON "template_criterion_suggestions"("template_document_id", "status");
CREATE INDEX "template_criterion_suggestions_template_version_id_idx"
  ON "template_criterion_suggestions"("template_version_id");

ALTER TABLE "template_criterion_suggestions" ADD CONSTRAINT "template_criterion_suggestions_template_document_id_fkey"
  FOREIGN KEY ("template_document_id") REFERENCES "template_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "template_criterion_suggestions" ADD CONSTRAINT "template_criterion_suggestions_criterion_id_fkey"
  FOREIGN KEY ("criterion_id") REFERENCES "criteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "template_criterion_suggestions" ADD CONSTRAINT "template_criterion_suggestions_template_version_id_fkey"
  FOREIGN KEY ("template_version_id") REFERENCES "template_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "template_criterion_suggestions" ADD CONSTRAINT "template_criterion_suggestions_reviewed_by_user_id_fkey"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TYPE "AuditAction" ADD VALUE 'TEMPLATE_CRITERION_SUGGESTION_CONFIRMED';
ALTER TYPE "AuditAction" ADD VALUE 'TEMPLATE_CRITERION_SUGGESTION_REJECTED';
