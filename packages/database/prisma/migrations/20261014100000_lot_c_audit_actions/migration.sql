-- Lot C (14/10/2026) — actions du journal d'audit pour la tablette (appareil
-- enregistré, code salarié, connexion) et l'export agrégé de l'enquête. Additive.
ALTER TYPE "AuditAction" ADD VALUE 'DEVICE_ENROLLED';
ALTER TYPE "AuditAction" ADD VALUE 'DEVICE_REVOKED';
ALTER TYPE "AuditAction" ADD VALUE 'STAFF_PIN_SET';
ALTER TYPE "AuditAction" ADD VALUE 'STAFF_PIN_UNLOCKED';
ALTER TYPE "AuditAction" ADD VALUE 'TABLET_SIGN_IN_FAILED';
ALTER TYPE "AuditAction" ADD VALUE 'TABLET_PIN_LOCKED';
ALTER TYPE "AuditAction" ADD VALUE 'TABLET_SIGNED_IN';
ALTER TYPE "AuditAction" ADD VALUE 'SURVEY_RESULTS_EXPORTED';
