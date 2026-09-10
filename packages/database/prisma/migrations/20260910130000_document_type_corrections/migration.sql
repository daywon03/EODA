-- Corrections du cabinet sur l'analyse IA, PAR TYPE DE DOCUMENT — la base de
-- connaissances apprend des erreurs constatées par Sandrine sans passer par la
-- recherche vectorielle (contrairement à knowledge_chunks) : une correction sur le
-- DIPC est rappelée à CHAQUE analyse d'un DIPC, pour tout établissement du tenant.
-- Append-only : aucune colonne de modification, pas de suppression exposée.
CREATE TABLE "document_type_corrections" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "document_type_id" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_type_corrections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "document_type_corrections_tenant_id_document_type_id_created_at_idx"
  ON "document_type_corrections"("tenant_id", "document_type_id", "created_at");
CREATE INDEX "document_type_corrections_document_type_id_idx" ON "document_type_corrections"("document_type_id");

ALTER TABLE "document_type_corrections" ADD CONSTRAINT "document_type_corrections_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_type_corrections" ADD CONSTRAINT "document_type_corrections_document_type_id_fkey"
  FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_type_corrections" ADD CONSTRAINT "document_type_corrections_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
