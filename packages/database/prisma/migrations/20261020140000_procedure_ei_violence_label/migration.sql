-- Procédure EI / réclamations : « et violence », 20/10/2026.
--
-- Le mode opératoire écrit de Sandrine (`context/11-modes-operatoires-sandrine.md` §2.1,
-- « Procédure de traitement des évènements indésirables, réclamations et/ou signalements
-- de faits de maltraitance et/ou violence ») nomme la violence à côté de la maltraitance.
-- Ce document fait foi pour les prompts (CLAUDE.md §7) ; le libellé du catalogue
-- s'arrêtait à la maltraitance, ce qui laissait hors du champ annoncé les faits de
-- violence qui ne sont pas qualifiés de maltraitance.
--
-- Une migration commitée ne se modifie jamais : la correction est une NOUVELLE migration.
--
-- DONNÉE DE RÉFÉRENTIEL, mise à jour CIBLÉE et IDEMPOTENTE :
--   - ciblée par code ;
--   - `label <> …` : rejouée, elle ne touche plus rien ;
--   - base neuve (référentiel absent) : aucune ligne visée, rien ne se passe — le seed
--     (`BASE_DOCUMENT_TYPES`) porte déjà le libellé complet.

UPDATE "document_types"
SET "label" = 'Procédure traitement EI / réclamations / signalements maltraitance et violence'
WHERE "code" = 'QUALITE_PROCEDURE_EI_PLAINTES'
  AND "label" <> 'Procédure traitement EI / réclamations / signalements maltraitance et violence';
