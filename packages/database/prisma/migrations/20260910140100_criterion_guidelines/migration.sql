-- Ancrage repensé le jour même de sa création : document_type_corrections (créée
-- il y a quelques heures, jamais utilisée en pratique — 0 ligne écrite) est
-- remplacée par criterion_guidelines, ancrée sur le CRITÈRE HAS plutôt que le type
-- de document. Un critère est rattaché à plusieurs types de documents
-- (document_type_criteria) : une leçon apprise doit profiter à tous, pas être
-- ressaisie type par type. Suppression sans risque : table vide, jamais exposée
-- au-delà de cette session de travail.
DROP TABLE "document_type_corrections";

CREATE TABLE "criterion_guidelines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "criterion_id" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "criterion_guidelines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "criterion_guidelines_tenant_id_criterion_id_created_at_idx"
  ON "criterion_guidelines"("tenant_id", "criterion_id", "created_at");
CREATE INDEX "criterion_guidelines_criterion_id_idx" ON "criterion_guidelines"("criterion_id");

ALTER TABLE "criterion_guidelines" ADD CONSTRAINT "criterion_guidelines_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "criterion_guidelines" ADD CONSTRAINT "criterion_guidelines_criterion_id_fkey"
  FOREIGN KEY ("criterion_id") REFERENCES "criteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "criterion_guidelines" ADD CONSTRAINT "criterion_guidelines_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
