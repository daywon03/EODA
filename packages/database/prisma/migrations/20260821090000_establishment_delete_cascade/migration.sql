-- Suppression d'un établissement : porter les règles de dépendance dans la BASE.
--
-- Défaut constaté en production locale (P2003) : supprimer un établissement converti
-- échouait sur `mission_options_mission_id_fkey`. La transaction de
-- `deleteEstablishment` énumérait à la main les tables filles, et trois relations
-- ajoutées depuis n'y figuraient pas : `mission_options`, `client_option_requests`,
-- et le `prospects.establishment_id` posé par la conversion.
--
-- Corriger la liste aurait remis le même piège en place pour la relation suivante :
-- la règle vivait dans une fonction que le prochain développeur doit penser à
-- relire. Elle vit désormais dans le schéma, là où la base la fait respecter
-- (Règle zéro — une règle qu'aucune machine ne vérifie n'est pas une règle).
--
-- Deux comportements distincts, et c'est volontaire :
--   CASCADE  pour ce qui n'existe que par son parent (mission, ses options, ses
--            statuts de checklist, les demandes d'option d'un établissement) ;
--   SET NULL pour le prospect, qui est de l'HISTORIQUE COMMERCIAL : fermer une fiche
--            client ne doit pas effacer le prospect, ses devis signés, ni le chiffre
--            d'affaires qu'ils portent. Le prospect survit, simplement détaché.

-- ── mission_options → missions ───────────────────────────────────────────────
ALTER TABLE "mission_options" DROP CONSTRAINT "mission_options_mission_id_fkey";
ALTER TABLE "mission_options"
    ADD CONSTRAINT "mission_options_mission_id_fkey"
    FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── mission_checklist_item_statuses → missions ───────────────────────────────
ALTER TABLE "mission_checklist_item_statuses" DROP CONSTRAINT "mission_checklist_item_statuses_mission_id_fkey";
ALTER TABLE "mission_checklist_item_statuses"
    ADD CONSTRAINT "mission_checklist_item_statuses_mission_id_fkey"
    FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── missions → establishments ────────────────────────────────────────────────
ALTER TABLE "missions" DROP CONSTRAINT "missions_establishment_id_fkey";
ALTER TABLE "missions"
    ADD CONSTRAINT "missions_establishment_id_fkey"
    FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── client_option_requests → establishments ──────────────────────────────────
ALTER TABLE "client_option_requests" DROP CONSTRAINT "client_option_requests_establishment_id_fkey";
ALTER TABLE "client_option_requests"
    ADD CONSTRAINT "client_option_requests_establishment_id_fkey"
    FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── prospects → establishments (historique commercial : détaché, jamais effacé) ─
ALTER TABLE "prospects" DROP CONSTRAINT "prospects_establishment_id_fkey";
ALTER TABLE "prospects"
    ADD CONSTRAINT "prospects_establishment_id_fkey"
    FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
