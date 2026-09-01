-- Grille d'entretien découverte : les réponses de la réunion R1, portées par le
-- prospect.
--
-- Une seule colonne Json, et non une colonne par question : la grille est un
-- CONTENU versionné dans le code (apps/web/src/content/decouverte/), pas un schéma.
-- Le gabarit v03 de Sandrine est attendu et remplacera les questions — s'il fallait
-- une migration par révision de grille, la grille ne serait jamais révisée.
--
-- La lecture est défensive (lib/services/discovery-grid-service.ts) : une réponse
-- écrite sous une version antérieure de la grille est ignorée, jamais rendue telle
-- quelle. C'est la même règle que `analysis_result_json`.
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits
-- sur ce dépôt (incident du 19/08/2026 — la base de développement partagée effacée
-- par un --shadow-database-url pointant la vraie base). Application :
-- `pnpm db:migrate:deploy` uniquement.

ALTER TABLE "prospects"
  ADD COLUMN "discovery_answers_json" JSONB,
  ADD COLUMN "discovery_updated_at" TIMESTAMP(3);
