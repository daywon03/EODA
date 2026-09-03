-- INDEX SUR LES CLÉS ÉTRANGÈRES.
--
-- PostgreSQL n'indexe PAS automatiquement une colonne de clé étrangère — contrairement
-- à MySQL, et contrairement à ce qu'on suppose en lisant un schéma Prisma. Trente-quatre
-- des nôtres n'en avaient aucun : chaque jointure et chaque filtre dessus faisait un
-- parcours séquentiel de la table entière.
--
-- Invisible aujourd'hui — quatre fiches, douze documents, tout tient en une page de
-- table. Décisif au volume visé : 120 SAD de Seine-Saint-Denis programmées entre 2026
-- et 2030, 137 critères cotés par établissement et par session, une trentaine de
-- documents versionnés chacun. `element_ratings` et `document_versions` sont les deux
-- tables qui grossissent le plus vite, et ce sont précisément celles qu'on lit à chaque
-- ouverture d'une grille ou d'une checklist.
--
-- Ce qui N'EST PAS indexé, délibérément : les colonnes « qui a fait quoi »
-- (uploaded_by_user_id, author_user_id, validated_by_user_id, performed_by_user_id,
-- requested_by_user_id, analysis_reviewed_by_user_id). On ne cherche jamais « tous les
-- documents déposés par X », et un index qu'aucune lecture n'emprunte se paie à chaque
-- écriture. Le journal d'audit, lui, a déjà les siens.
--
-- Écrite à la main, comme toutes les migrations de ce dépôt (incident du 19/08/2026).
-- Application : `pnpm db:migrate:deploy`.

CREATE INDEX "chapters_referential_version_id_idx" ON "chapters" ("referential_version_id");
CREATE INDEX "criteria_objective_id_idx" ON "criteria" ("objective_id");
CREATE INDEX "document_type_criteria_criterion_id_idx" ON "document_type_criteria" ("criterion_id");
CREATE INDEX "devis_tenant_id_idx" ON "devis" ("tenant_id");
CREATE INDEX "devis_prospect_id_idx" ON "devis" ("prospect_id");
CREATE INDEX "devis_catalogue_formule_id_idx" ON "devis" ("catalogue_formule_id");
CREATE INDEX "devis_options_catalogue_option_id_idx" ON "devis_options" ("catalogue_option_id");
CREATE INDEX "client_option_requests_catalogue_option_id_idx" ON "client_option_requests" ("catalogue_option_id");
CREATE INDEX "document_versions_document_id_idx" ON "document_versions" ("document_id");
CREATE INDEX "documents_document_type_id_idx" ON "documents" ("document_type_id");
CREATE INDEX "element_ratings_evaluation_element_id_idx" ON "element_ratings" ("evaluation_element_id");
CREATE INDEX "establishment_users_establishment_id_idx" ON "establishment_users" ("establishment_id");
CREATE INDEX "establishments_tenant_id_idx" ON "establishments" ("tenant_id");
CREATE INDEX "evaluation_elements_criterion_id_idx" ON "evaluation_elements" ("criterion_id");
CREATE INDEX "evaluation_sessions_chapter_id_idx" ON "evaluation_sessions" ("chapter_id");
CREATE INDEX "evaluation_sessions_establishment_id_idx" ON "evaluation_sessions" ("establishment_id");
CREATE INDEX "mission_checklist_item_statuses_item_id_idx" ON "mission_checklist_item_statuses" ("item_id");
CREATE INDEX "mission_options_catalogue_option_id_idx" ON "mission_options" ("catalogue_option_id");
CREATE INDEX "missions_tenant_id_idx" ON "missions" ("tenant_id");
CREATE INDEX "mission_messages_tenant_id_idx" ON "mission_messages" ("tenant_id");
CREATE INDEX "prospect_timeline_entries_tenant_id_idx" ON "prospect_timeline_entries" ("tenant_id");
CREATE INDEX "prospects_tenant_id_idx" ON "prospects" ("tenant_id");
CREATE INDEX "users_tenant_id_idx" ON "users" ("tenant_id");
