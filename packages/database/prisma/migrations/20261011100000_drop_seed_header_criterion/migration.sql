-- Nettoyage d'un défaut du seed du référentiel (bilan du 08/10/2026, §3.2), 11/10/2026.
--
-- `seed-has-referential.ts` lisait les trois grilles Synaé à partir de la ligne 4. Aux
-- chapitres 2 et 3, c'est la première ligne de données ; au chapitre 1, c'est la ligne
-- d'EN-TÊTE (vérifié dans les trois fichiers le 11/10/2026 : colonne O « Critère ID »,
-- colonne N « ID Objectif », colonne M « ID Thématique »). L'en-tête a donc été
-- enregistré comme un critère de code littéral « Critère ID » — d'où le « 137/138 ».
-- Le script est corrigé (recherche de l'en-tête, code N.N.N exigé) ; cette migration
-- retire la ligne déjà écrite.
--
-- DONNÉE DE CONFIGURATION, suppression CIBLÉE et IDEMPOTENTE :
--   - un seul code visé, exactement celui constaté dans les grilles ;
--   - rien n'est supprimé si ce critère porte quoi que ce soit : élément d'évaluation
--     (donc cotation), rattachement à un type de document ou à un modèle, guideline,
--     suggestion. Dans ce cas la migration ne fait RIEN — la ligne reste, et il faut
--     regarder à la main pourquoi un humain s'en est servi ;
--   - rejouée, elle ne trouve plus rien et ne fait rien.
-- La thématique « ID Thématique » et l'objectif « ID Objectif » créés par la même
-- ligne ne sont PAS supprimés ici (périmètre volontairement limité au critère) : ils
-- sont sans critère et signalés dans le bilan.

DELETE FROM "criteria" c
WHERE c."code" = 'Critère ID'
  AND NOT EXISTS (SELECT 1 FROM "evaluation_elements" e WHERE e."criterion_id" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "document_type_criteria" d WHERE d."criterion_id" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "template_document_criteria" t WHERE t."criterion_id" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "criterion_guidelines" g WHERE g."criterion_id" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "document_criterion_suggestions" s WHERE s."criterion_id" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "template_criterion_suggestions" ts WHERE ts."criterion_id" = c."id");
