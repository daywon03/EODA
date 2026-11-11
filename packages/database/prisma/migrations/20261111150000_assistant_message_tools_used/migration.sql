-- ASSISTANT DU MENU (11/11/2026) : ce que l'assistant a LU pour répondre (noms des
-- outils de lecture appelés), affiché sous la réponse (« A lu vos structures, 2
-- documents · 1 crédit ») au lieu d'être tu. Les noms d'outils seulement : ni
-- argument, ni identifiant, ni texte.
--
-- Additive : une colonne avec valeur par défaut, aucune donnée ne change. Application :
-- `pnpm db:migrate:deploy` uniquement.

ALTER TABLE "assistant_messages" ADD COLUMN "tools_used" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
