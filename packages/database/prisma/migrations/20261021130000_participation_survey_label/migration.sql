-- Décision de Damon du 21/10/2026 : la ligne « Enquête de satisfaction — questionnaire
-- vierge » devient « Autre forme de participation des usagers ». Elle désigne la
-- DÉMARCHE de participation choisie par une structure sans CVS — un livrable distinct
-- du compte-rendu de CVS, jamais fusionné avec lui. La FORME choisie (enquête de
-- satisfaction, groupe de parole, autre) est un fait de la structure, porté par son
-- document (migration suivante) et ajoutée au libellé à l'affichage. Le code ne change pas.
UPDATE "document_types"
SET "label" = 'Autre forme de participation des usagers'
WHERE "code" = 'QUALITE_ENQUETE_QUESTIONNAIRE';
