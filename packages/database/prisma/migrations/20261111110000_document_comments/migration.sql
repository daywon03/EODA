-- FIL DE COMMENTAIRES D'UN DOCUMENT (retour de Sandrine, 10/11/2026 : « J'ai cumulé
-- les commentaires, car je ne vois pas l'historique »). Chaque commentaire s'empile,
-- daté, avec son auteur ; rien ne s'écrase ; l'IA relit tous ceux qui sont cochés.
--
-- Additive : une table neuve, une action de journal. Le commentaire unique existant
-- (`documents.missing_justification`) est RECOPIÉ comme premier élément du fil de son
-- document — auteur inconnu, daté de la dernière mise à jour du document, coché pour
-- l'IA s'il l'était. La colonne d'origine n'est ni vidée ni supprimée : les relances
-- et le contrat la lisent toujours. Migration écrite à la main ; application :
-- `pnpm db:migrate:deploy` uniquement.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DOCUMENT_COMMENT_ADDED';

CREATE TABLE "document_comments" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "author_user_id" TEXT,
    "text" TEXT NOT NULL,
    "ai_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "document_comments_document_id_created_at_idx" ON "document_comments"("document_id", "created_at");
CREATE INDEX "document_comments_author_user_id_idx" ON "document_comments"("author_user_id");

ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Reprise : le commentaire unique de chaque document devient le premier du fil.
-- Identifiant déterministe (`legacy-<document>`) : rejouer la migration ne doublonne rien.
INSERT INTO "document_comments" ("id", "document_id", "author_user_id", "text", "ai_enabled", "created_at")
SELECT 'legacy-' || d."id", d."id", NULL, btrim(d."missing_justification"), d."comment_used_by_ai", d."updated_at"
FROM "documents" d
WHERE d."missing_justification" IS NOT NULL AND btrim(d."missing_justification") <> ''
ON CONFLICT ("id") DO NOTHING;
