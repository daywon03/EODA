-- FICHES DE SENSIBILISATION « PERSONNE ACCOMPAGNÉE » — 5 types de document, 29/10/2026.
--
-- Call du 28/10/2026 avec Sandrine : les fiches P1 à P5 (plaintes et réclamations,
-- événements indésirables, prévention de la maltraitance, gestion de crise, données
-- personnelles) se montrent à la personne à l'accueil, sur la tablette, à côté de la
-- ligne « À expliquer » correspondante, et vont dans son dossier. Une ligne par fiche,
-- pour TOUTES les structures : la tablette retrouve la fiche par son code.
--
-- DONNÉE DE CONFIGURATION, ajout CIBLÉ et IDEMPOTENT (même règles que
-- 20261014120000_pilot_document_types) :
--   - `ON CONFLICT ("code") DO NOTHING` : un type déjà présent n'est jamais modifié ;
--   - `requested_from_client = false` : produites par EODA, jamais réclamées ;
--   - catégorie QUALITE_RISQUES, jamais LOI_2002_2 ;
--   - identifiants stables `doctype-…`, dérivés du code.
-- Aucun rattachement aux critères ici : la matrice ne s'écrit que par l'écran.
-- Même liste que `AWARENESS_SHEET_DOCUMENT_TYPES` (`packages/database/src/document-types.ts`),
-- concordance tenue par `apps/web/src/lib/db/seed-data.test.ts`.
--
-- Additive : aucune table, aucune colonne, aucune suppression.

INSERT INTO "document_types" ("id", "code", "category", "label", "is_conditional", "expected_frequency", "requested_from_client")
VALUES
  ('doctype-pa-fiche-p1-plaintes', 'PA_FICHE_P1_PLAINTES', 'QUALITE_RISQUES'::"DocumentCategory", 'Fiche de sensibilisation personne accompagnée — P1 Plaintes et réclamations', false, NULL, false),
  ('doctype-pa-fiche-p2-evenements-indesirables', 'PA_FICHE_P2_EVENEMENTS_INDESIRABLES', 'QUALITE_RISQUES'::"DocumentCategory", 'Fiche de sensibilisation personne accompagnée — P2 Événements indésirables', false, NULL, false),
  ('doctype-pa-fiche-p3-maltraitance', 'PA_FICHE_P3_MALTRAITANCE', 'QUALITE_RISQUES'::"DocumentCategory", 'Fiche de sensibilisation personne accompagnée — P3 Prévention de la maltraitance', false, NULL, false),
  ('doctype-pa-fiche-p4-gestion-crise', 'PA_FICHE_P4_GESTION_CRISE', 'QUALITE_RISQUES'::"DocumentCategory", 'Fiche de sensibilisation personne accompagnée — P4 Gestion de crise', false, NULL, false),
  ('doctype-pa-fiche-p5-donnees', 'PA_FICHE_P5_DONNEES', 'QUALITE_RISQUES'::"DocumentCategory", 'Fiche de sensibilisation personne accompagnée — P5 Mes informations protégées', false, NULL, false)
ON CONFLICT ("code") DO NOTHING;
