-- Validation d'un document — dernière étape du parcours décrit le 26/08 :
-- déposé → analysé → mis en conformité → restitué → VALIDÉ.
--
-- Les quatre premières étapes se dérivent de faits déjà présents (une version existe,
-- une analyse existe, une version corrigée existe, l'analyse a été relue). La
-- cinquième ne se dérive pas : valider, c'est engager la parole de l'évaluatrice sur
-- un document qui partira à la HAS.
--
-- Aucun rattrapage : aucun document existant n'a été validé, les marquer comme tels
-- reviendrait à signer à la place de quelqu'un.
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits sur
-- ce dépôt (incident du 19/08/2026). Application : `pnpm db:migrate:deploy` uniquement.
ALTER TABLE "documents" ADD COLUMN "validated_at" TIMESTAMP(3);
ALTER TABLE "documents" ADD COLUMN "validated_by_user_id" TEXT;

ALTER TABLE "documents"
    ADD CONSTRAINT "documents_validated_by_user_id_fkey"
    FOREIGN KEY ("validated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TYPE "AuditAction" ADD VALUE 'DOCUMENT_VALIDATED';
ALTER TYPE "AuditAction" ADD VALUE 'DOCUMENT_UNVALIDATED';
