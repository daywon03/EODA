-- Décision de Damon du 27/10/2026 : le sigle est « DIPEC » (document individuel de
-- prise en charge), comme l'écrit Sandrine dans ses modes opératoires et sa matrice.
-- Seul le LIBELLÉ change : le code `L2002_DIPC` est une clé, il ne bouge pas.
UPDATE "document_types"
SET "label" = 'DIPEC / Contrat de séjour'
WHERE "code" = 'L2002_DIPC';
