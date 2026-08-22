-- Alignement du catalogue commercial sur l'offre commerciale v10 (18/08/2026) §04.
-- Les prestations à la carte ne sont plus toutes des forfaits : certaines sont
-- tarifées à l'heure (avec fourchette et minimum facturable), au document, au
-- support ou au mois (abonnement à engagement d'un an).

-- CreateEnum
CREATE TYPE "PricingUnit" AS ENUM ('FORFAIT', 'HEURE', 'JOUR', 'DOCUMENT', 'SUPPORT', 'MOIS');

-- AlterTable : les lignes existantes du catalogue sont toutes des forfaits sans
-- fourchette ni minimum — le DEFAULT les rétro-remplit sans backfill explicite.
ALTER TABLE "catalogue_options"
    ADD COLUMN "pricing_unit" "PricingUnit" NOT NULL DEFAULT 'FORFAIT',
    ADD COLUMN "price_max_euros" INTEGER,
    ADD COLUMN "min_quantity" INTEGER;

-- AlterTable : mêmes champs figés sur la ligne de devis (snapshot du prix).
ALTER TABLE "devis_options"
    ADD COLUMN "pricing_unit_snapshot" "PricingUnit" NOT NULL DEFAULT 'FORFAIT',
    ADD COLUMN "price_max_snapshot_euros" INTEGER,
    ADD COLUMN "min_quantity_snapshot" INTEGER;

-- AlterTable : acompte de 40 % à la commande (CGP v10 §06, auparavant 30 %).
ALTER TABLE "billing_settings"
    ALTER COLUMN "default_deposit_percent" SET DEFAULT 40;

-- Pas de backfill volontaire : un taux déjà enregistré à 30 % peut être un réglage
-- choisi par le cabinet dans Catalogue → Réglages de facturation. On ne peut pas le
-- distinguer de l'ancienne valeur par défaut, et l'écraser changerait silencieusement
-- le taux de tous les devis futurs d'un tenant qui ne l'a pas demandé. Le nouveau
-- défaut ci-dessus couvre les tenants créés ensuite ; l'existant se change dans l'UI.
