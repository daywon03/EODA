-- Rattache une fiche de la bibliothèque de modèles à des critères HAS — même
-- patron que document_type_criteria, pour la bibliothèque de modèles plutôt que
-- pour les documents attendus du client (demande du 16/09/2026).
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits
-- sur ce dépôt (incident du 19/08/2026, cf. CLAUDE.md). Application : `prisma migrate deploy`.

CREATE TABLE "template_document_criteria" (
    "template_document_id" TEXT NOT NULL,
    "criterion_id" TEXT NOT NULL,

    CONSTRAINT "template_document_criteria_pkey" PRIMARY KEY ("template_document_id", "criterion_id")
);

CREATE INDEX "template_document_criteria_criterion_id_idx" ON "template_document_criteria"("criterion_id");

ALTER TABLE "template_document_criteria" ADD CONSTRAINT "template_document_criteria_template_document_id_fkey"
    FOREIGN KEY ("template_document_id") REFERENCES "template_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "template_document_criteria" ADD CONSTRAINT "template_document_criteria_criterion_id_fkey"
    FOREIGN KEY ("criterion_id") REFERENCES "criteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
