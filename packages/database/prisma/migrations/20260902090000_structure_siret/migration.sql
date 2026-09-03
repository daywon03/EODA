-- SIRET de la structure, sur le PROSPECT et sur la FICHE CLIENT.
--
-- Demande explicite de Sandrine (call du 01/09) : « je t'avais dit que les
-- associations SAD n'avaient pas de SIRET. Apparemment, si. Rajouter le numéro de
-- SIRET pour TOUS les formats de structure. » Le champ ne dépend donc d'aucun statut
-- juridique — il n'y a pas de colonne conditionnelle ni de valeur par défaut.
--
-- SIRET ≠ FINESS, et l'un ne remplace jamais l'autre : le FINESS identifie l'ESSMS
-- auprès des autorités sanitaires et sociales (c'est lui qui désigne la structure
-- évaluée par la HAS), le SIRET l'identifie au registre des entreprises et doit
-- figurer sur un devis, un contrat et une facture.
--
-- ⚠️ PAS de contrainte UNIQUE, y compris sur `establishments`, contrairement à
-- `finess_number`. Le FINESS est déjà la clé qui interdit deux fiches pour la même
-- structure, et il a fallu un service dédié pour que sa violation ne soit pas avalée
-- par le `catch` général de la conversion et annoncée à l'envers. Une seconde
-- contrainte unique ouvrirait un second chemin d'échec à la signature pour un gain
-- nul : l'unicité est déjà obtenue.
--
-- Colonnes NULLables : les fiches et prospects existants n'ont pas ce numéro, et
-- aucune valeur par défaut ne serait vraie.
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits
-- sur ce dépôt (incident du 19/08/2026). Application : `pnpm db:migrate:deploy`.

ALTER TABLE "prospects"      ADD COLUMN "siret_number" TEXT;
ALTER TABLE "establishments" ADD COLUMN "siret_number" TEXT;
