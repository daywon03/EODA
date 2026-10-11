-- Correctifs du bilan du 08/10/2026 (specs/05-bilan-2026-10.md §3.2), 11/10/2026.
--
-- ADDITIVE uniquement : trois colonnes de `devis` et une de `missions` deviennent
-- nullables (aucune donnée réécrite — toutes les lignes existantes gardent leur
-- valeur), une valeur d'audit ajoutée. La clé étrangère `devis_catalogue_formule_id_fkey`
-- n'est PAS touchée (`onDelete: Restrict` explicite dans le schéma).
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sur la base sont
-- interdits sur ce dépôt. Application : `migrate deploy` uniquement.

-- Devis SANS offre (prestations à la carte seules, call du 01/09) : la formule et ses
-- deux snapshots deviennent facultatifs, ensemble. Au moins une option est alors exigée
-- côté serveur (devis-calculation-service).
ALTER TABLE "devis" ALTER COLUMN "catalogue_formule_id" DROP NOT NULL,
ALTER COLUMN "formule_label_snapshot" DROP NOT NULL,
ALTER COLUMN "formule_price_snapshot_euros" DROP NOT NULL;

-- La mission née d'un tel devis n'a pas de formule : aucun périmètre d'offre, mode
-- accompagné, aucun droit de génération (offer-scope-service).
ALTER TABLE "missions" ALTER COLUMN "formule" DROP NOT NULL;

-- Rattachement d'un compte client existant (même cabinet) à une autre structure.
ALTER TYPE "AuditAction" ADD VALUE 'CLIENT_USER_LINKED';
