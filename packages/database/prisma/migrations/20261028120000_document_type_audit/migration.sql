-- Lignes de « Documents » gérées par le cabinet (28/10/2026) : la création et le
-- renommage d'un type de document, valables pour toutes les structures, sont
-- inscrits au journal. Additive.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DOCUMENT_TYPE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DOCUMENT_TYPE_RENAMED';
