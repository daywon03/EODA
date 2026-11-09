-- RETIRER UNE LIGNE DE « DOCUMENTS » (09/11/2026, retour de Sandrine : « il manque des
-- poubelles »). Une ligne créée par le cabinet (code EODA_…) se retire :
--   - jamais utilisée (aucun document, aucun gabarit) : elle est SUPPRIMÉE ;
--   - déjà utilisée : elle est ARCHIVÉE (`archived_at` posé) — masquée de toutes les
--     listes, historique gardé (versions, journal, analyses).
-- La loi 2002-2 et les lignes du référentiel ne se retirent pas (refus côté serveur).
--
-- Additive : une colonne facultative (NULL = ligne en service), deux actions de
-- journal ; aucune suppression, aucune réécriture. Migration écrite à la main ;
-- application : `pnpm db:migrate:deploy` uniquement.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DOCUMENT_TYPE_ARCHIVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DOCUMENT_TYPE_DELETED';

ALTER TABLE "document_types" ADD COLUMN "archived_at" TIMESTAMP(3);
