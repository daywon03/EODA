-- Ajoute "Responsable Qualité" aux fonctions possibles d'un interlocuteur client
-- (demande de Sandrine, call du 15/09/2026).
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits
-- sur ce dépôt (incident du 19/08/2026, cf. CLAUDE.md). Application : `prisma migrate deploy`.

ALTER TYPE "EstablishmentUserRole" ADD VALUE IF NOT EXISTS 'RESPONSABLE_QUALITE';
