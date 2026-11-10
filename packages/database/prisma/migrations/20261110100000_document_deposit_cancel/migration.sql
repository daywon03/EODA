-- DÉPÔT ANNULABLE (10/11/2026, retour de Sandrine du 09/11 : « Il me faut la
-- possibilité d'annuler un dépôt de doc en cours… je me suis trompée et je n'ai pas pu
-- empêcher l'action »).
--
-- Un dépôt du cabinet coché « Version finale d'EODA » vaut validation : il écrase
-- `documents.validated_at`. Pour que son annulation rétablisse l'état d'AVANT au lieu
-- de le deviner, la version garde ce qu'elle a remplacé :
--   - `validated_on_deposit` : ce dépôt a posé la validation ;
--   - `prior_validated_at` / `prior_validated_by_user_id` : la validation antérieure
--     (NULL = le document n'était pas validé). Copie datée, sans clé étrangère.
-- Plus une action de journal, DOCUMENT_DEPOSIT_CANCELLED.
--
-- Additive : trois colonnes (une à défaut `false`, deux facultatives), une valeur
-- d'énumération ; aucune suppression, aucune réécriture. Migration écrite à la main ;
-- application : `pnpm db:migrate:deploy` uniquement.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DOCUMENT_DEPOSIT_CANCELLED';

ALTER TABLE "document_versions" ADD COLUMN "validated_on_deposit" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "document_versions" ADD COLUMN "prior_validated_at" TIMESTAMP(3);
ALTER TABLE "document_versions" ADD COLUMN "prior_validated_by_user_id" TEXT;
