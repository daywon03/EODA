-- 20/10/2026 — deux gestes de la consultante sur un document, additifs.

-- 1. « Ce n'est pas un compte-rendu CVS, c'est une enquête de satisfaction » :
--    le type d'un document peut être corrigé. L'analyse qui l'accompagne a été
--    notée contre les critères de l'ANCIEN type ; elle est donc effacée par
--    l'action, jamais conservée sous un autre nom (cf. changeDocumentType).
ALTER TYPE "AuditAction" ADD VALUE 'DOCUMENT_TYPE_CHANGED';

-- 2. Consigne de la consultante pour l'analyse (« ce document porte aussi sur
--    les entretiens téléphoniques, tiens-en compte »). Le texte vit sur le
--    DOCUMENT (il survit aux versions), le bouton dit s'il entre dans l'analyse,
--    et la version garde une copie de la consigne réellement appliquée — une
--    analyse passée ne doit pas laisser croire qu'elle a tenu compte d'un texte
--    écrit après elle.
ALTER TABLE "documents" ADD COLUMN "analysis_directive" TEXT;
ALTER TABLE "documents" ADD COLUMN "directive_in_analysis" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "document_versions" ADD COLUMN "analysis_directive_used" TEXT;
ALTER TYPE "AuditAction" ADD VALUE 'DOCUMENT_DIRECTIVE_UPDATED';
