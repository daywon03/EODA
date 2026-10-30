-- RÔLES SUR LA TABLETTE (30/10/2026, demande de Damon : « seuls les admins ont accès
-- à tout ; ceux qui signent les contrats et font les enquêtes ne font que ça »).
-- L'intervenant fait signer les nouveaux contrats et passe les enquêtes ;
-- l'administrateur voit aussi les contrats déjà faits, les dossiers, exporte et
-- importe la liste.
--
-- Tout salarié, existant ou nouveau, part INTERVENANT (le moins de droits) : la
-- direction désigne ses administrateurs depuis « Tablettes et codes ». Mettre les
-- existants administrateurs aurait ouvert l'export de tous les contrats à chaque
-- salarié qui avait déjà un code.
--
-- Additive : un type, une colonne, une action de journal ; aucune suppression.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'STAFF_TABLET_ROLE_SET';

CREATE TYPE "TabletRole" AS ENUM ('ADMINISTRATEUR', 'INTERVENANT');

ALTER TABLE "staff_members" ADD COLUMN "tablet_role" "TabletRole" NOT NULL DEFAULT 'INTERVENANT';
