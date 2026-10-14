-- RÉFÉRENTIEL DOCUMENTAIRE DU PILOTE — 19 types de document, 14/10/2026.
--
-- Demande de Damon (14/10/2026) : aligner la plateforme sur les documents que la
-- structure pilote utilise et qu'EODA produit pour elle (procédures P1-P5 et leurs
-- annexes, modèles vierges de PAP / fiche des tâches / grille d'évaluation des besoins,
-- note de service, annuaire de crise, questionnaire d'enquête, règlement intérieur…).
-- Un type n'entre que si son existence est attestée par AU MOINS DEUX sources ; la
-- liste des sources de chaque type est en commentaire de `PILOT_DOCUMENT_TYPES`
-- (`packages/database/src/document-types.ts`), qui porte les mêmes lignes pour une base
-- neuve (le seed tourne APRÈS les migrations) — concordance tenue par
-- `apps/web/src/lib/db/seed-data.test.ts`.
--
-- DONNÉE DE CONFIGURATION, ajout CIBLÉ et IDEMPOTENT :
--   - `ON CONFLICT ("code") DO NOTHING` : un type déjà présent n'est jamais modifié
--     (ni libellé, ni catégorie, ni le drapeau « réclamé », qui appartient à CABINET_ADMIN) ;
--   - `requested_from_client = false` : produits par EODA, jamais réclamés à la structure
--     (CLAUDE.md §7, « ce qu'on réclame n'est pas tout ce qu'on produit ») ;
--   - catégories de l'enum EXISTANT `DocumentCategory`, aucune en LOI_2002_2 (qui compte
--     les sept documents de la loi et rien d'autre) ;
--   - HDS : un type qui pourrait contenir une pièce nominative désigne le MODÈLE VIERGE,
--     et son libellé le dit ;
--   - identifiants stables `doctype-…` (pas de cuid côté SQL), dérivés du code.
-- Aucun rattachement aux critères ici : la matrice ne s'écrit que par l'écran
-- `/dashboard/cabinet/criteres` (spec 04) ; la proposition est dans le CSV versionné.
--
-- Additive : aucune table, aucune colonne, aucune suppression.
-- Migration écrite à la main ; application : `pnpm db:migrate:deploy` uniquement.

INSERT INTO "document_types" ("id", "code", "category", "label", "is_conditional", "expected_frequency", "requested_from_client")
VALUES
  ('doctype-fonct-pap-gabarit', 'FONCT_PAP_GABARIT', 'FONCTIONNEMENT'::"DocumentCategory", 'Projet d''accompagnement personnalisé (PAP) — modèle vierge', false, NULL, false),
  ('doctype-fonct-fiche-taches-gabarit', 'FONCT_FICHE_TACHES_GABARIT', 'FONCTIONNEMENT'::"DocumentCategory", 'Fiche des tâches à domicile — modèle vierge', false, NULL, false),
  ('doctype-fonct-grille-eval-besoins', 'FONCT_GRILLE_EVAL_BESOINS', 'FONCTIONNEMENT'::"DocumentCategory", 'Grille d''évaluation des besoins — modèle vierge', false, NULL, false),
  ('doctype-fonct-note-service', 'FONCT_NOTE_SERVICE', 'FONCTIONNEMENT'::"DocumentCategory", 'Note de service', false, NULL, false),
  ('doctype-fonct-consentement-entretien', 'FONCT_CONSENTEMENT_ENTRETIEN', 'FONCTIONNEMENT'::"DocumentCategory", 'Lettre de consentement à l''entretien d''auto-évaluation — modèle vierge', false, NULL, false),
  ('doctype-qualite-fiche-sensibilisation', 'QUALITE_FICHE_SENSIBILISATION', 'QUALITE_RISQUES'::"DocumentCategory", 'Fiche de sensibilisation des professionnels (par thème)', false, NULL, false),
  ('doctype-qualite-affiche', 'QUALITE_AFFICHE', 'QUALITE_RISQUES'::"DocumentCategory", 'Affiche A4 d''information / de sensibilisation', false, NULL, false),
  ('doctype-qualite-emargement-seance', 'QUALITE_EMARGEMENT_SEANCE', 'QUALITE_RISQUES'::"DocumentCategory", 'Feuille d''émargement — séance de sensibilisation (modèle)', false, NULL, false),
  ('doctype-qualite-gabarit-cr-reunion', 'QUALITE_GABARIT_CR_REUNION', 'QUALITE_RISQUES'::"DocumentCategory", 'Compte rendu de réunion — gabarit unique', false, NULL, false),
  ('doctype-qualite-enquete-questionnaire', 'QUALITE_ENQUETE_QUESTIONNAIRE', 'QUALITE_RISQUES'::"DocumentCategory", 'Enquête de satisfaction — questionnaire vierge (personnes accompagnées, proches)', false, NULL, false),
  ('doctype-p12-procedure', 'P12_PROCEDURE', 'QUALITE_RISQUES'::"DocumentCategory", 'Procédure P1 — Plaintes et réclamations (Obj. 3.12)', false, NULL, false),
  ('doctype-p13-procedure', 'P13_PROCEDURE', 'QUALITE_RISQUES'::"DocumentCategory", 'Procédure P2 — Événements indésirables (Obj. 3.13)', false, NULL, false),
  ('doctype-p11-procedure', 'P11_PROCEDURE', 'QUALITE_RISQUES'::"DocumentCategory", 'Procédure P3 — Prévention de la maltraitance (Obj. 3.11)', false, NULL, false),
  ('doctype-p13-mode-operatoire-famo', 'P13_MODE_OPERATOIRE_FAMO', 'QUALITE_RISQUES'::"DocumentCategory", 'Mode opératoire de signalement et d''orientation FAMO (Obj. 3.13)', false, NULL, false),
  ('doctype-p14-annuaire-crise', 'P14_ANNUAIRE_CRISE', 'QUALITE_RISQUES'::"DocumentCategory", 'Annuaire de crise (Obj. 3.14)', false, NULL, false),
  ('doctype-p22-procedure-rgpd', 'P22_PROCEDURE_RGPD', 'QUALITE_RISQUES'::"DocumentCategory", 'Procédure P5 — Protection des données / RGPD (Obj. 2.2)', false, NULL, false),
  ('doctype-p22-aipd', 'P22_AIPD', 'QUALITE_RISQUES'::"DocumentCategory", 'Analyse d''impact relative à la protection des données — AIPD (Obj. 2.2)', false, NULL, false),
  ('doctype-p22-tableau-droits-acces-dui', 'P22_TABLEAU_DROITS_ACCES_DUI', 'QUALITE_RISQUES'::"DocumentCategory", 'Tableau des droits d''accès au DUI (Obj. 2.2)', false, NULL, false),
  ('doctype-rh-reglement-interieur', 'RH_REGLEMENT_INTERIEUR', 'RH'::"DocumentCategory", 'Règlement intérieur (droit du travail — distinct du règlement de fonctionnement)', false, NULL, false)
ON CONFLICT ("code") DO NOTHING;
