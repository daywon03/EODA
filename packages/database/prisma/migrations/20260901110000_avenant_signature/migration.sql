-- Signature de l'avenant qui régularise une option rattachée hors devis signé.
--
-- L'avenant se générait (§12.6) sans qu'aucun statut ne dise s'il était revenu signé.
-- Le champ porte ce fait, et seulement ce fait : il ne rend pas le montant ferme.
-- `price_is_firm` dit la PROVENANCE (issue d'un devis signé), ce champ dit la
-- RÉGULARISATION. Les confondre afficherait au client, comme un engagement, un prix
-- « à partir de » recopié du catalogue.
--
-- Nullable sans valeur par défaut : les options existantes n'ont pas d'avenant signé,
-- et NULL est la vérité — pas une date inventée.
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits
-- sur ce dépôt (incident du 19/08/2026). Application : `pnpm db:migrate:deploy`.

ALTER TABLE "mission_options"
  ADD COLUMN "avenant_signed_on" TIMESTAMP(3);
