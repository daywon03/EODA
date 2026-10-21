-- Forme de participation des usagers d'une structure sans CVS (21/10/2026) : portée par
-- le document de la ligne « Autre forme de participation des usagers ». Colonnes
-- nullables : aucune ligne existante n'est réécrite.
CREATE TYPE "ParticipationForm" AS ENUM ('ENQUETE_SATISFACTION', 'GROUPE_PAROLE', 'AUTRE');

ALTER TABLE "documents" ADD COLUMN "participation_form" "ParticipationForm";
ALTER TABLE "documents" ADD COLUMN "participation_other_label" TEXT;

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PARTICIPATION_FORM_SET';
