-- Critères & preuves (tranche N4), 11/10/2026 — traces d'audit de la matrice
-- type de document → critère HAS. ADDITIVE : deux valeurs d'enum.
-- Les rattachements eux-mêmes ne sont JAMAIS écrits par migration ni par seed :
-- uniquement par l'écran de validation (spec 04).
ALTER TYPE "AuditAction" ADD VALUE 'DOCUMENT_TYPE_CRITERIA_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'DOCUMENT_TYPE_CRITERION_PROMOTED';
