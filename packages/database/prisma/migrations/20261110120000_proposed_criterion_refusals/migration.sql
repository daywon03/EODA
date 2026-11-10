-- REFUS D'UN CRITÈRE PROPOSÉ (10/11/2026). « Charger toute la proposition » rajoutait
-- un critère proposé que l'administration avait retiré d'un type de document : aucun
-- refus n'était mémorisé. Un couple (type, critère) refusé est désormais gardé ici,
-- posé au retrait et effacé dès que le couple est rattaché de nouveau.
--
-- Additive : une table neuve, aucune réécriture. Supprimer une ligne de « Documents »
-- (jamais utilisée) supprime ses refus (ON DELETE CASCADE) ; un critère du référentiel
-- ne se supprime pas (RESTRICT, comme document_type_criteria). Migration écrite à la
-- main ; application : `pnpm db:migrate:deploy` uniquement.

CREATE TABLE "proposed_criterion_refusals" (
    "document_type_id" TEXT NOT NULL,
    "criterion_id" TEXT NOT NULL,
    "refused_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposed_criterion_refusals_pkey" PRIMARY KEY ("document_type_id","criterion_id")
);

CREATE INDEX "proposed_criterion_refusals_criterion_id_idx" ON "proposed_criterion_refusals"("criterion_id");

ALTER TABLE "proposed_criterion_refusals" ADD CONSTRAINT "proposed_criterion_refusals_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "proposed_criterion_refusals" ADD CONSTRAINT "proposed_criterion_refusals_criterion_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "criteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
