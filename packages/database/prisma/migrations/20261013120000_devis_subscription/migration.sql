-- Devis par abonnement — maquettes v2 « Nouveau devis » et « Catalogue », 13/10/2026.
--
-- ADDITIVE uniquement : une valeur d'audit (relance manuelle d'un devis), une colonne
-- nullable au catalogue (prix mensuel d'une offre, « à partir de xx € » tant qu'il
-- n'est pas fixé) et trois colonnes nullables sur le devis (snapshot du prix mensuel,
-- engagement en mois, note pour la structure). Aucune donnée réécrite : un devis
-- existant garde des montants identiques, son engagement reste inconnu (NULL).
-- Migration générée schéma à schéma (prisma migrate diff --from-schema-datamodel),
-- sans connexion à la base ; application : migrate deploy uniquement.

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'DEVIS_REMINDER_SENT';

-- AlterTable
ALTER TABLE "catalogue_formules" ADD COLUMN     "monthly_price_euros" INTEGER;

-- AlterTable
ALTER TABLE "devis" ADD COLUMN     "client_note" TEXT,
ADD COLUMN     "commitment_months" INTEGER,
ADD COLUMN     "formule_monthly_price_snapshot_euros" INTEGER;
