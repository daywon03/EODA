-- Identité de la structure portée par le PROSPECT : FINESS, adresse, type de SAD,
-- échéance d'évaluation HAS.
--
-- Ces informations se connaissent dès le premier contact, et ne se saisissaient
-- jusqu'ici qu'à la signature du devis : on les avait sous les yeux en réunion de
-- découverte sans pouvoir les noter. Elles sont facultatives ici — un prospect dont
-- on ne connaît que le nom et un numéro de téléphone doit pouvoir entrer dans le
-- pipeline — et recopiées sur la fiche à la signature, comme `structure_type`.
--
-- ⚠️ `finess_number` n'est PAS unique sur cette table, contrairement à
-- `establishments.finess_number` : deux prospects peuvent désigner la même structure
-- pendant une prospection (deux interlocuteurs, deux entrées), et c'est la création
-- de la FICHE qui doit trancher. Poser la contrainte ici bloquerait la prospection
-- pour protéger une règle qui n'appartient pas au pipeline.
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits
-- sur ce dépôt (incident du 19/08/2026). Application : `pnpm db:migrate:deploy`.

ALTER TABLE "prospects"
  ADD COLUMN "finess_number" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "establishment_type" "EstablishmentType",
  ADD COLUMN "has_evaluation_target_date" TIMESTAMP(3);
