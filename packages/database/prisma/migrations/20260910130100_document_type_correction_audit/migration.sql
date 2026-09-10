-- Action d'audit pour l'ajout d'une correction du cabinet sur une analyse IA
-- (`targetId` = identifiant du type de document, jamais le contenu de la
-- correction). Migration séparée de celle qui crée document_type_corrections :
-- PostgreSQL refuse d'utiliser une valeur d'enum dans la transaction qui l'ajoute.
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits
-- sur ce dépôt (incident du 19/08/2026). Application : `prisma migrate deploy`.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DOCUMENT_TYPE_CORRECTION_ADDED';
