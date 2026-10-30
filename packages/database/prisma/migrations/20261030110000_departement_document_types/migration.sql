-- PIÈCES DE LA STRUCTURE POUR LE DÉPARTEMENT — 2 types de document, 30/10/2026.
--
-- Demande de Damon (30/10/2026) : le formulaire du Département (désignation du SAD)
-- part avec un CONTRAT RÉCAPITULATIF de quatre pages, et porte le TAMPON de la
-- structure dans la case « SAD ». Les deux sont des documents de la structure, à son
-- nom : jamais dans le code. La tablette les retrouve par leur code, une fois leur
-- validation à jour (même règle que le DIPEC et les fiches de sensibilisation).
--
-- DONNÉE DE CONFIGURATION, ajout CIBLÉ et IDEMPOTENT (mêmes règles que
-- 20261029100000_awareness_sheet_types) :
--   - `ON CONFLICT ("code") DO NOTHING` : un type déjà présent n'est jamais modifié ;
--   - `requested_from_client = false` : déposés par EODA, jamais réclamés ;
--   - catégorie FONCTIONNEMENT, jamais LOI_2002_2 ;
--   - identifiants stables `doctype-…`, dérivés du code.
-- Aucun rattachement aux critères ici : la matrice ne s'écrit que par l'écran.
-- Même liste que `DEPARTEMENT_DOCUMENT_TYPES` (`packages/database/src/document-types.ts`),
-- concordance tenue par `apps/web/src/lib/db/seed-data.test.ts`.
--
-- Additive : aucune table, aucune colonne, aucune suppression.

INSERT INTO "document_types" ("id", "code", "category", "label", "is_conditional", "expected_frequency", "requested_from_client")
VALUES
  ('doctype-departement-tampon', 'DEPARTEMENT_TAMPON', 'FONCTIONNEMENT'::"DocumentCategory", 'Tampon de la structure — posé sur le formulaire du Département', false, NULL, false),
  ('doctype-departement-contrat-recapitulatif', 'DEPARTEMENT_CONTRAT_RECAPITULATIF', 'FONCTIONNEMENT'::"DocumentCategory", 'Contrat récapitulatif — envoyé au Département avec le formulaire', false, NULL, false)
ON CONFLICT ("code") DO NOTHING;
