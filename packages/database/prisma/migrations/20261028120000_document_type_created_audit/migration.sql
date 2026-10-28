-- Nouvelle ligne dans « Documents » créée par le cabinet (28/10/2026) : la
-- création d'un type de document, valable pour toutes les structures, est inscrite
-- au journal. Additive.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DOCUMENT_TYPE_CREATED';
