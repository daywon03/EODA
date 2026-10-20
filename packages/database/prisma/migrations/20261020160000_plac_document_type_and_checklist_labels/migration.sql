-- PLAC — le plan d'action entre au catalogue, et son sigle dans les libellés, 20/10/2026.
--
-- Deux faits, une même cause. Le mode opératoire écrit de Sandrine
-- (`context/11-modes-operatoires-sandrine.md`, qui FAIT FOI pour les prompts et pour les
-- sorties — CLAUDE.md §7) nomme le plan d'action **PLAC** (« Plan d'Amélioration
-- Continue »), §6.2 et phase 4 : « Co-construction du PLAC ». La plateforme, elle,
-- l'appelait « PAC » dans deux libellés visibles (items DIAG_11 et DIAG_12 de la
-- checklist de mission) et ne portait aucun type de document pour le livrable lui-même.
-- Sa note ⚠️ est explicite : « Un seul sigle doit apparaître dans les sorties. »
--
-- Les identifiants INTERNES ne changent pas : `ActionItem.source = 'PAC'` est une donnée
-- stockée, et `pac-proposal-service` / `plan-action` sont des noms de code. Un sigle se
-- corrige dans ce qui se lit, jamais par une migration destructive d'enum pour un mot.
--
-- Deux opérations, toutes deux CIBLÉES et IDEMPOTENTES :
--   1. INSERT du type `QUALITE_PLAC` — `ON CONFLICT ("code") DO NOTHING`, un type déjà
--      présent n'est jamais modifié (le drapeau « réclamé » appartient à CABINET_ADMIN).
--      Produit par EODA (`requested_from_client = false`), catégorie EXISTANTE
--      QUALITE_RISQUES, jamais LOI_2002_2. Identifiant stable dérivé du code.
--      Pas de rattachement aux critères ici : la matrice ne s'écrit que par l'écran
--      `/dashboard/cabinet/criteres` (spec 04), et la feuille de suivi du pilote n'a pas
--      de ligne « PLAC » — une proposition sans source s'inventerait.
--   2. UPDATE des deux libellés de la checklist de mission, ciblés par CODE, avec
--      `label <> …` : rejouée, la migration ne touche plus rien.
--
-- Base NEUVE : les migrations tournent AVANT le seed. L'INSERT ne trouve alors aucun
-- conflit et pose la ligne ; le seed (`BASE_DOCUMENT_TYPES`, `MISSION_CHECKLIST_ITEMS`)
-- porte les mêmes valeurs. La concordance est tenue par
-- `apps/web/src/lib/db/seed-data.test.ts`, qui relit ce fichier.
--
-- Additive : aucune table, aucune colonne, aucune suppression.
-- Migration écrite à la main ; application : `pnpm db:migrate:deploy` uniquement.

INSERT INTO "document_types" ("id", "code", "category", "label", "is_conditional", "expected_frequency", "requested_from_client")
VALUES
  ('doctype-qualite-plac', 'QUALITE_PLAC', 'QUALITE_RISQUES'::"DocumentCategory", 'Plan d''amélioration continue — PLAC', false, NULL, false)
ON CONFLICT ("code") DO NOTHING;

UPDATE "mission_checklist_items"
SET "label" = 'Co-construction du PLAC (plan d''amélioration continue)'
WHERE "code" = 'DIAG_11'
  AND "label" <> 'Co-construction du PLAC (plan d''amélioration continue)';

UPDATE "mission_checklist_items"
SET "label" = 'Réunion distancielle — restitution du PLAC'
WHERE "code" = 'DIAG_12'
  AND "label" <> 'Réunion distancielle — restitution du PLAC';
