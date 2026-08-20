-- Filtrage des items de checklist de mission par offre commerciale.
-- Référence : .claude/context/07-outil-pilotage-missions.md §12.4 (call du 16/08/2026)
-- et .claude/context/08-offre-commerciale-v10.md §04 (plaquette v10, source de vérité
-- tarifaire et de périmètre depuis le 18/08/2026).
--
-- La colonne porte l'offre MINIMALE qui couvre l'item. Elle est ajoutée avec une
-- valeur par défaut ('ESSENTIEL' = couvert par toutes les formules) pour ne jamais
-- créer de colonne NOT NULL sans défaut sur une table déjà peuplée.

ALTER TABLE "mission_checklist_items"
  ADD COLUMN "min_formule" "CommercialTier" NOT NULL DEFAULT 'ESSENTIEL';

-- Backfill des lignes existantes ------------------------------------------------

-- Diagnostic. §12.4 énumère ce que Sandrine attend en Essentiel : réunion de cadrage
-- (DIAG_01), recueil documentaire (DIAG_02), visite sur site (DIAG_05), audit des 16
-- critères impératifs (DIAG_06), vérification loi 2002-2 (DIAG_09), rapport de
-- diagnostic (DIAG_10), création du PAC (DIAG_11) et sa restitution (DIAG_12).
--
-- DIAG_08 « Cotation des critères » RESTE en ESSENTIEL : l'offre Essentiel EST la
-- cotation des 16 critères impératifs (plaquette v10 §04 — livrable « Grille Synaé
-- critères impératifs », « Diagnostic focalisé sur les critères impératifs (16) »).
-- L'exclure laisserait l'offre sans aucune cotation. Ce n'est pas l'item qui est
-- réservé, c'est son PÉRIMÈTRE de critères — porté par
-- offer-scope-service.criteriaScope (IMPERATIFS_ONLY en Essentiel, ALL au-delà),
-- jamais par ce filtre-ci.
--
-- Restent donc hors Essentiel les trois items du protocole de visite longue
-- (2 jours d'évaluation simulée, §12.1) que la ½ journée Essentiel ne comporte pas :
-- validation du planning de visite, réunion d'ouverture, réunion de bilan de visite.
UPDATE "mission_checklist_items"
   SET "min_formule" = 'PERFORMANCE'
 WHERE "code" IN ('DIAG_03', 'DIAG_04', 'DIAG_07');

-- Phases 3 et 4 : réservées Excellence (ou bêta-test gratuit) — §7.3. Cette règle
-- vivait jusqu'ici en dur dans isScopeApplicable() ; elle est désormais portée par
-- le référentiel, comme le reste du filtrage par offre.
UPDATE "mission_checklist_items"
   SET "min_formule" = 'EXCELLENCE'
 WHERE "scope" IN ('CONSOLIDATION', 'PREPARATION_FINALE');
