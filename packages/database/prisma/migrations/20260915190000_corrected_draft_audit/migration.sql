-- Actions d'audit pour le brouillon de document corrigé généré par l'IA
-- (`targetId` = identifiant de la version de document analysée). Migration
-- séparée : PostgreSQL refuse d'utiliser une valeur d'enum dans la transaction
-- qui l'ajoute.
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits
-- sur ce dépôt (incident du 19/08/2026). Application : `prisma migrate deploy`.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CORRECTED_DRAFT_GENERATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CORRECTED_DRAFT_EDITED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CORRECTED_DRAFT_DOWNLOADED';
