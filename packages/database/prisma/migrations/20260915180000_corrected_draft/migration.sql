-- Brouillon de document corrigé, généré par l'IA à partir de l'analyse — Markdown
-- (converti en .docx à l'affichage/au téléchargement, jamais stocké en .docx).
ALTER TABLE "document_versions" ADD COLUMN "corrected_draft_markdown" TEXT;
ALTER TABLE "document_versions" ADD COLUMN "corrected_draft_generated_at" TIMESTAMP(3);
