-- Action d'audit pour l'ajout d'une guideline du cabinet sur un critère HAS.
-- Migration séparée de celle qui crée criterion_guidelines : PostgreSQL refuse
-- d'utiliser une valeur d'enum dans la transaction qui l'ajoute.
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits
-- sur ce dépôt (incident du 19/08/2026). Application : `prisma migrate deploy`.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CRITERION_GUIDELINE_ADDED';
