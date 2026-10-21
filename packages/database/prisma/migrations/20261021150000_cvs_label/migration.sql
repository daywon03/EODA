-- Décision de Damon du 21/10/2026 : le compte-rendu CVS et l'« Autre forme de
-- participation des usagers » sont deux livrables distincts. Le libellé du CVS ne
-- mentionne donc plus l'autre forme, qui a sa propre ligne (QUALITE_ENQUETE_QUESTIONNAIRE) :
-- une enquête rangée sous « Comptes-rendus CVS (ou autre forme…) » était analysée comme un CVS.
UPDATE "document_types"
SET "label" = 'Comptes-rendus CVS'
WHERE "code" = 'L2002_CR_CVS';
