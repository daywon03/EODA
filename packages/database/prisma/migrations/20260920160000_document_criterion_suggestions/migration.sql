-- Suggestion de critère HAS détectée par l'IA sur un document CLIENT, en plus des
-- critères déjà rattachés au type de document (document_type_criteria, configuré
-- une fois pour toutes par le cabinet). Persona « adjoint IA qualité HAS »
-- (Damon, 20/09/2026) : un document peut répondre à plusieurs critères — parfois
-- jusqu'à 10 — et l'IA doit les détecter tous, jamais se limiter à un seul.
--
-- PENDING tant qu'aucun humain n'a tranché ; jamais appliqué ni affiché au client
-- avant confirmation (même doctrine que documents.validated_at). Ancrée sur
-- document_id, pas document_version_id : le rattachement supplémentaire est une
-- propriété du document dans son ensemble ; document_version_id ne fait que
-- garder la trace de la version qui a motivé la suggestion.
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont
-- interdits sur ce dépôt (incident du 19/08/2026). Application :
-- `pnpm db:migrate:deploy` uniquement.

CREATE TYPE "CriterionSuggestionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

CREATE TABLE "document_criterion_suggestions" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "criterion_id" TEXT NOT NULL,
    "document_version_id" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "status" "CriterionSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_criterion_suggestions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "document_criterion_suggestions_document_id_criterion_id_key"
  ON "document_criterion_suggestions"("document_id", "criterion_id");
CREATE INDEX "document_criterion_suggestions_criterion_id_idx"
  ON "document_criterion_suggestions"("criterion_id");
CREATE INDEX "document_criterion_suggestions_document_id_status_idx"
  ON "document_criterion_suggestions"("document_id", "status");
CREATE INDEX "document_criterion_suggestions_document_version_id_idx"
  ON "document_criterion_suggestions"("document_version_id");

ALTER TABLE "document_criterion_suggestions" ADD CONSTRAINT "document_criterion_suggestions_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_criterion_suggestions" ADD CONSTRAINT "document_criterion_suggestions_criterion_id_fkey"
  FOREIGN KEY ("criterion_id") REFERENCES "criteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_criterion_suggestions" ADD CONSTRAINT "document_criterion_suggestions_document_version_id_fkey"
  FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_criterion_suggestions" ADD CONSTRAINT "document_criterion_suggestions_reviewed_by_user_id_fkey"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TYPE "AuditAction" ADD VALUE 'CRITERION_SUGGESTION_CONFIRMED';
ALTER TYPE "AuditAction" ADD VALUE 'CRITERION_SUGGESTION_REJECTED';
