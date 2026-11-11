-- ASSISTANT DU MENU LATÉRAL (11/11/2026). Ses conversations ne portent ni structure ni
-- document (toutes les structures du périmètre de la consultante) : les deux colonnes
-- de `assistant_conversations`, obligatoires depuis 20261111120000 (assistant de la fiche
-- document), deviennent facultatives. Une conversation de la fiche continue de les porter.
--
-- Additive : on lève une contrainte, aucune donnée ne change. Migration écrite à la main
-- (la 20261111120000, déjà fusionnée, n'est pas réécrite) ; application :
-- `pnpm db:migrate:deploy` uniquement.

ALTER TABLE "assistant_conversations" ALTER COLUMN "establishment_id" DROP NOT NULL;
ALTER TABLE "assistant_conversations" ALTER COLUMN "document_type_id" DROP NOT NULL;
