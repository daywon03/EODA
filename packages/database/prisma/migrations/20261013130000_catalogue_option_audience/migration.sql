-- Catalogue v2 — « Pour qui » d'une option (maquette v2 « Catalogue », 13/10/2026).
--
-- ADDITIVE uniquement : une colonne texte nullable. Aucune donnée écrite : le champ
-- reste vide (« — » à l'écran) tant que le cabinet ne l'a pas renseigné — rien n'est
-- inventé. Il ne restreint aucune vente.
-- Migration générée schéma à schéma (prisma migrate diff --from-schema-datamodel),
-- sans connexion à la base ; application : migrate deploy uniquement.

-- AlterTable
ALTER TABLE "catalogue_options" ADD COLUMN     "audience_label" TEXT;
