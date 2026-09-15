-- Action d'audit pour la ré-analyse à la demande d'une version de document
-- (`targetId` = identifiant de la version). Migration séparée : PostgreSQL refuse
-- d'utiliser une valeur d'enum dans la transaction qui l'ajoute.
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits
-- sur ce dépôt (incident du 19/08/2026). Application : `prisma migrate deploy`.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DOCUMENT_REANALYZED';
