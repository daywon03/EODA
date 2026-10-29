-- Audit de sécurité du 28/10/2026 : le fil d'échange se journalise (sans le texte),
-- et un dépassement du débit d'envoi aussi.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MISSION_MESSAGE_POSTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MISSION_MESSAGE_RATE_LIMITED';
-- Création d'accès par la direction d'une structure : débit dépassé.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CLIENT_ACCESS_RATE_LIMITED';
