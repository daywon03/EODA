// ─────────────────────────────────────────────────────────────────────────────
// RÉFÉRENTIEL DocumentType — données pures, sans Prisma (importables par les tests)
//
// Source des 47 premiers types : context/03-documents-obligatoires.md. Déplacés de
// `prisma/seed.ts` le 14/10/2026 pour qu'un test puisse vérifier que TOUT type a un
// groupe d'affichage (`apps/web/src/content/documents/groupes.ts`) et que les types
// portés par une migration de données sont les mêmes que ceux du seed.
// Liste unique — ne pas la dupliquer ailleurs ; le seed (`prisma/seed.ts`) l'upserte.
//
// `category` reprend l'enum Prisma `DocumentCategory` (`LOI_2002_2` / `FONCTIONNEMENT`
// / `QUALITE_RISQUES` / `RH`) : il ne s'invente pas (CLAUDE.md §7).
// ─────────────────────────────────────────────────────────────────────────────

export type DocumentCategorySeed = "LOI_2002_2" | "FONCTIONNEMENT" | "QUALITE_RISQUES" | "RH";
export type ExpectedFrequencySeed = "ANNUAL" | "BIANNUAL" | "TRIENNIAL" | "ON_DEMAND";

export type DocTypeSeed = {
  code: string;
  category: DocumentCategorySeed;
  label: string;
  isConditional?: boolean;
  expectedFrequency?: ExpectedFrequencySeed;
};

export const BASE_DOCUMENT_TYPES: readonly DocTypeSeed[] = [
  // ── Catégorie 1 — Loi 2002-2 (obligatoires, tous ESSMS) ──────────────────
  {
    code: "L2002_PROJET_SERVICE",
    category: "LOI_2002_2",
    label: "Projet d'établissement / Projet de service",
  },
  {
    code: "L2002_CHARTE_DROITS",
    category: "LOI_2002_2",
    label: "Charte des droits et libertés de la personne accueillie",
  },
  {
    code: "L2002_LIVRET_ACCUEIL",
    category: "LOI_2002_2",
    label: "Livret d'accueil",
  },
  {
    code: "L2002_CR_CVS",
    category: "LOI_2002_2",
    label: "Comptes-rendus CVS",
    expectedFrequency: "ANNUAL",
  },
  {
    code: "L2002_DIPC",
    category: "LOI_2002_2",
    label: "DIPEC / Contrat de séjour",
    expectedFrequency: "ANNUAL",
  },
  {
    code: "L2002_REGLEMENT_FONCTIONNEMENT",
    category: "LOI_2002_2",
    label: "Règlement de fonctionnement",
  },
  {
    code: "L2002_PERSONNES_QUALIFIEES",
    category: "LOI_2002_2",
    label: "Liste des personnes qualifiées (préfet / président Conseil Départemental)",
  },

  // ── Catégorie 2 — Fonctionnement de la structure ─────────────────────────
  {
    code: "FONCT_ORGANIGRAMME",
    category: "FONCTIONNEMENT",
    label: "Organigramme",
  },
  {
    code: "FONCT_PLAQUETTE",
    category: "FONCTIONNEMENT",
    label: "Plaquette / supports d'information sur l'offre de service",
  },
  {
    code: "FONCT_RAPPORTS_ACTIVITE",
    category: "FONCTIONNEMENT",
    label: "3 derniers rapports d'activité annuels",
    expectedFrequency: "ANNUAL",
  },
  {
    code: "FONCT_CPOM",
    category: "FONCTIONNEMENT",
    label: "CPOM (si concerné)",
    isConditional: true,
  },
  {
    code: "FONCT_CR_COMMISSIONS",
    category: "FONCTIONNEMENT",
    label: "3 derniers comptes-rendus de commissions (animation, restauration…)",
  },
  {
    code: "FONCT_PLANNING_ANIMATION",
    category: "FONCTIONNEMENT",
    label: "Planning d'animation des 3 derniers mois (si concerné)",
    isConditional: true,
  },
  {
    code: "FONCT_LISTE_PARTENAIRES",
    category: "FONCTIONNEMENT",
    label: "Liste des partenaires mobilisables",
  },
  {
    code: "FONCT_DIRECTIVES_ANTICIPEES",
    category: "FONCTIONNEMENT",
    label: "Support d'information sur les directives anticipées (si concerné)",
    isConditional: true,
  },

  // ── Catégorie 3 — Démarche qualité et gestion des risques ────────────────
  {
    code: "QUALITE_AUTOEVAL_ANTERIEURE",
    category: "QUALITE_RISQUES",
    label: "Rapport d'évaluation interne / auto-évaluation antérieure",
  },
  {
    code: "QUALITE_ENQUETES_SATISFACTION",
    category: "QUALITE_RISQUES",
    label: "Synthèse des 3 dernières enquêtes de satisfaction",
  },
  // ── Le plan d'action, dit PLAC ──────────────────────────────────────────
  // [GUIDE] §6.2 « PLAC (Plan d'Amélioration Continue) …, avec jalons et responsables »,
  // phases 4 (« Co-construction du PLAC ») et 6 (« PLAC archivé ») · [REF] context/02
  // (« une entrée prioritaire dans le plan d'action (PLAC) ») · context/04, code de TYPE
  // `PLAC` de la convention de nommage des exports. Trois sources, règle d'entrée tenue.
  //
  // PRODUIT par EODA (`requestedFromClient` false) et, comme tous les types de base,
  // présent en catalogue depuis l'init : il ne se voyait pas parce qu'aucune ligne ne le
  // nommait. Le libellé est le seul endroit où le sigle apparaît — les codes internes de
  // la plateforme (`ActionItem.source = "PAC"`, `pac-proposal-service`) sont des
  // identifiants STOCKÉS, jamais affichés : un sigle se corrige dans les sorties, pas par
  // une migration destructive d'enum.
  //
  // Aucune proposition dans la matrice (`matrice-proposition.ts`) : la feuille de suivi du
  // pilote ne porte pas de ligne « PLAC », et une proposition sans source se fabrique.
  // Le rattachement se décide à la main, par l'écran `/dashboard/cabinet/criteres`.
  {
    code: "QUALITE_PLAC",
    category: "QUALITE_RISQUES",
    label: "Plan d'amélioration continue — PLAC",
  },
  {
    code: "QUALITE_PCA_PLAN_BLEU",
    category: "QUALITE_RISQUES",
    label: "Plan bleu / PCA (continuité d'activité)",
  },
  {
    code: "QUALITE_POLITIQUE_INDEX",
    category: "QUALITE_RISQUES",
    label: "Politique qualité + index référentiel des procédures",
  },
  {
    code: "QUALITE_PROCEDURE_EI_PLAINTES",
    category: "QUALITE_RISQUES",
    // « … et/ou violence » : le mode opératoire de Sandrine nomme les deux
    // (`context/11` §2.1, « signalements de faits de maltraitance et/ou violence »).
    // Le libellé, lui, s'arrêtait à la maltraitance.
    label: "Procédure traitement EI / réclamations / signalements maltraitance et violence",
  },

  // Objectif 3.12 — Plaintes & réclamations (critère impératif)
  {
    code: "P12_REGISTRE",
    category: "QUALITE_RISQUES",
    label: "Registre des plaintes / réclamations (Obj. 3.12)",
  },
  {
    code: "P12_AR_TYPE",
    category: "QUALITE_RISQUES",
    label: "Accusés de réception type — plaintes (Obj. 3.12)",
  },
  {
    code: "P12_REPONSE_FINALE",
    category: "QUALITE_RISQUES",
    label: "Modèle de réponse finale — plaintes (Obj. 3.12)",
  },
  {
    code: "P12_CR_ANALYSE_EQUIPE",
    category: "QUALITE_RISQUES",
    label: "CR de réunion d'analyse en équipe — plaintes (Obj. 3.12)",
  },
  {
    code: "P12_BILAN_ANNUEL",
    category: "QUALITE_RISQUES",
    label: "Bilan annuel d'activité qualité — volet plaintes (Obj. 3.12)",
    expectedFrequency: "ANNUAL",
  },

  // Objectif 3.13 — EI / EIG (critère impératif)
  {
    code: "P13_FICHE_DECLARATION",
    category: "QUALITE_RISQUES",
    label: "Fiche de déclaration EI type (Obj. 3.13)",
  },
  {
    code: "P13_TABLEAU_SUIVI",
    category: "QUALITE_RISQUES",
    label: "Tableau de suivi des EI / EIG (Obj. 3.13)",
  },
  {
    code: "P13_CR_RETEX",
    category: "QUALITE_RISQUES",
    label: "CR de RETEX / CREX (Obj. 3.13)",
  },
  {
    code: "P13_SIGNALEMENT_ARS",
    category: "QUALITE_RISQUES",
    label: "Preuve de signalement ARS si EIG (Obj. 3.13)",
    isConditional: true,
  },

  // Objectif 3.11 — Maltraitance (critère impératif)
  {
    code: "P11_CARTOGRAPHIE_RISQUES",
    category: "QUALITE_RISQUES",
    label: "Cartographie des risques de maltraitance (Obj. 3.11)",
  },
  {
    code: "P11_PLAN_PREVENTION",
    category: "QUALITE_RISQUES",
    label: "Plan de prévention maltraitance (Obj. 3.11)",
  },
  {
    code: "P11_CR_SENSIBILISATION",
    category: "QUALITE_RISQUES",
    label: "CR de sensibilisation des équipes — maltraitance (Obj. 3.11)",
  },
  {
    code: "P11_SIGNALEMENTS_TRACES",
    category: "QUALITE_RISQUES",
    label: "Traçabilité des signalements traités (Obj. 3.11)",
  },

  // Objectif 3.14 — Continuité / gestion de crise (critère impératif)
  {
    code: "P14_PGC_REDIGE",
    category: "QUALITE_RISQUES",
    label: "Plan de gestion de crise (PGC) rédigé (Obj. 3.14)",
  },
  {
    code: "P14_PCA_REDIGE",
    category: "QUALITE_RISQUES",
    label: "PCA rédigé (Obj. 3.14)",
  },
  {
    code: "P14_CR_DIFFUSION",
    category: "QUALITE_RISQUES",
    label: "CR de diffusion interne / externe — PCA/PGC (Obj. 3.14)",
  },
  {
    code: "P14_PREUVE_SIMULATION",
    category: "QUALITE_RISQUES",
    label: "Preuve de simulation / exercice — PCA/PGC (Obj. 3.14)",
  },
  {
    code: "P14_DATE_REVISION",
    category: "QUALITE_RISQUES",
    label: "Date de dernière révision du PCA/PGC (Obj. 3.14)",
  },

  // Objectif 2.2 — Droits & confidentialité (critère impératif)
  {
    code: "P22_FORMULAIRES_CONSENTEMENT",
    category: "QUALITE_RISQUES",
    label: "Formulaires de consentement — droit à l'image, etc. (Obj. 2.2)",
  },
  {
    code: "P22_DUI_SECURISE",
    category: "QUALITE_RISQUES",
    label: "Preuve de sécurisation du DUI (Obj. 2.2)",
  },
  {
    code: "P22_FORMATION_RGPD",
    category: "QUALITE_RISQUES",
    label: "Preuve de formation / sensibilisation RGPD (Obj. 2.2)",
  },
  {
    code: "P22_REGISTRE_TRAITEMENTS",
    category: "QUALITE_RISQUES",
    label: "Registre des traitements de données (Obj. 2.2)",
  },
  {
    code: "P22_CHARTE_INFORMATIQUE",
    category: "QUALITE_RISQUES",
    label: "Charte informatique (Obj. 2.2)",
  },
  {
    code: "P22_EMARGEMENT_SENSIBILISATION",
    category: "QUALITE_RISQUES",
    label: "Feuilles d'émargement sensibilisation droits (Obj. 2.2)",
  },

  // ── Catégorie 4 — Ressources humaines ────────────────────────────────────
  {
    code: "RH_LIVRET_SALARIE",
    category: "RH",
    label: "Livret d'accueil du salarié",
  },
  {
    code: "RH_PLAN_FORMATION",
    category: "RH",
    label: "Plan de formation / programme de sensibilisation",
  },
  {
    // ⚠ Obligation Code du Travail — PAS une exigence HAS. Libellé volontairement distinct.
    code: "RH_DUERP",
    category: "RH",
    label: "DUERP — Document Unique d'Évaluation des Risques Professionnels (exigence Code du Travail, hors périmètre HAS)",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// RÉFÉRENTIEL DOCUMENTAIRE DU PILOTE — 19 types ajoutés le 14/10/2026
//
// Demande de Damon (14/10/2026) : aligner la plateforme sur les documents que la
// structure pilote utilise et qu'EODA produit pour elle. Règle d'entrée : un type n'est
// ajouté que si son existence est attestée par AU MOINS DEUX sources ; les candidats à
// une seule source restent dans `specs/04` (« à valider par Sandrine »), jamais en base.
//
// Sources citées (abréviations) :
//   [SUIVI]  tableau de suivi de la mission pilote (colonnes documents / preuves),
//            converti sans donnée client en `specs/data/20261008_candidats-types-de-document.csv` ;
//   [GUIDE]  « Guide EODA Mode Opératoire » v02, transcrit dans `context/11` (partie B) ;
//   [SEANCES] règles dites en séance, `context/10` ;
//   [FINAUX] documents finaux validés du pilote (PAP et fiche des tâches v1.0 du 07/10,
//            enquête de satisfaction V1.6, grille de dépouillement v02) — hors dépôt ;
//   [MO]     `context/06` (mode opératoire, séances de septembre) ;
//   [OFFRE]  offre v10 et catalogue (`context/07`, `context/08`) ;
//   [REF]    référentiel documentaire en cours, `context/03`.
//
// Tous PRODUITS par EODA : `requestedFromClient = false` (jamais dans
// REQUESTED_FROM_CLIENT_DOCUMENT_CODES). Aucun en LOI_2002_2 : cette catégorie compte
// les sept documents de la loi et rien d'autre (structures-overview, missing-answer).
// HDS : un type qui pourrait contenir une pièce nominative désigne le MODÈLE VIERGE, et
// le libellé le dit (« modèle vierge ») ; le PAP rempli, la fiche des tâches remplie, la
// grille d'évaluation remplie ne sont pas des types de document (CLAUDE.md §6).
// Aucune périodicité posée : celles qui sont connues (PAP annuel, évaluation des besoins
// reposée chaque année) portent sur le document INDIVIDUEL, nominatif, pas sur le modèle.
//
// Porté AUSSI par la migration 20261014120000_pilot_document_types (INSERT … ON
// CONFLICT (code) DO NOTHING) ; la concordance est vérifiée par
// `apps/web/src/lib/db/seed-data.test.ts`.
// ─────────────────────────────────────────────────────────────────────────────
export const PILOT_DOCUMENT_TYPES: readonly DocTypeSeed[] = [
  // [SUIVI] « PAP » (5 critères) · [FINAUX] PAP v1.0 du 07/10 · [SEANCES] §3 et §6 « PAP »
  { code: "FONCT_PAP_GABARIT", category: "FONCTIONNEMENT", label: "Projet d'accompagnement personnalisé (PAP) — modèle vierge personnalisé" },
  // [SUIVI] « Fiche de tâches » (19 critères) · [FINAUX] fiche intégrée au PAP v1.0 du 07/10
  { code: "FONCT_FICHE_TACHES_GABARIT", category: "FONCTIONNEMENT", label: "Fiche des tâches à domicile — modèle vierge personnalisé" },
  // [SUIVI] « Grille d'évaluation des besoins » (29 critères) · [SEANCES] §6 DIPEC (questions
  // sensibles de l'évaluation des besoins) · [MO] séance du 22/09 · [REF] périodicités
  { code: "FONCT_GRILLE_EVAL_BESOINS", category: "FONCTIONNEMENT", label: "Grille d'évaluation des besoins — modèle vierge personnalisé" },
  // [SUIVI] « Note de service » (15 critères) · [SEANCES] §2 (propagation), §4 (logos), §6 (PAC)
  { code: "FONCT_NOTE_SERVICE", category: "FONCTIONNEMENT", label: "Note de service" },
  // [SUIVI] « Lettre de consentement — entretien auto-évaluation » · [GUIDE] phase 1
  // (« feuilles de consentement ») et §8.2 (consentement tracé)
  { code: "FONCT_CONSENTEMENT_ENTRETIEN", category: "FONCTIONNEMENT", label: "Lettre de consentement à l'entretien d'auto-évaluation — modèle vierge personnalisé" },
  // [SUIVI] « Support / fiche de sensibilisation » (20 critères) · [SEANCES] §3 · [MO] fiches
  // (douleur, éthique, risque infectieux…) · [REF] « fiches de sensibilisation »
  { code: "QUALITE_FICHE_SENSIBILISATION", category: "QUALITE_RISQUES", label: "Fiche de sensibilisation des professionnels (par thème)" },
  // [SUIVI] « Affiche » (EI, règles d'or) · [SEANCES] §3 · [OFFRE] option « affiche A4 »
  { code: "QUALITE_AFFICHE", category: "QUALITE_RISQUES", label: "Affiche A4 d'information / de sensibilisation" },
  // [SUIVI] gabarit D10 (9 critères) · [SEANCES] §3 · [OFFRE] « modèles CR avec émargement »
  // · [REF] « émargements ». Les droits fondamentaux gardent P22_EMARGEMENT_SENSIBILISATION.
  { code: "QUALITE_EMARGEMENT_SEANCE", category: "QUALITE_RISQUES", label: "Feuille d'émargement — séance de sensibilisation (modèle)" },
  // [SUIVI] « CR de réunion » · [GUIDE] §3.3 (« un gabarit unique ») et phase 4 · [SEANCES] §3
  // · [OFFRE] « trames CR » · [REF] « comptes rendus »
  { code: "QUALITE_GABARIT_CR_REUNION", category: "QUALITE_RISQUES", label: "Compte rendu de réunion — gabarit unique" },
  // [SUIVI] enquêtes de satisfaction · [FINAUX] enquête V1.6 · [SEANCES] §6 « Participation »
  // · [MO] enquête en ligne et papier. La SYNTHÈSE reste QUALITE_ENQUETES_SATISFACTION.
  { code: "QUALITE_ENQUETE_QUESTIONNAIRE", category: "QUALITE_RISQUES", label: "Autre forme de participation des usagers" },
  // [SUIVI] « Procédure P1 » · [GUIDE] phases 4 et 5 · [OFFRE] pack P1-P5
  { code: "P12_PROCEDURE", category: "QUALITE_RISQUES", label: "Procédure P1 — Plaintes et réclamations (Obj. 3.12)" },
  // [SUIVI] « Procédure P2 » · [GUIDE] phases 4 et 5 · [OFFRE] pack P1-P5
  { code: "P13_PROCEDURE", category: "QUALITE_RISQUES", label: "Procédure P2 — Événements indésirables (Obj. 3.13)" },
  // [SUIVI] « Procédure P3 » · [GUIDE] phases 4 et 5 · [OFFRE] pack P1-P5
  { code: "P11_PROCEDURE", category: "QUALITE_RISQUES", label: "Procédure P3 — Prévention de la maltraitance (Obj. 3.11)" },
  // [SUIVI] « Mode opératoire FAMO » · [GUIDE] phase 5 (« fiche EI/FAMO ») · [MO] « la FAMO
  // pour les situations graves ». Le formulaire REMPLI est nominatif : seul le mode opératoire.
  { code: "P13_MODE_OPERATOIRE_FAMO", category: "QUALITE_RISQUES", label: "Mode opératoire de signalement et d'orientation FAMO (Obj. 3.13)" },
  // [SUIVI] « Procédure P4 (annuaire de crise) » · [GUIDE] phase 5, demi-journée 6
  { code: "P14_ANNUAIRE_CRISE", category: "QUALITE_RISQUES", label: "Annuaire de crise (Obj. 3.14)" },
  // [SUIVI] « Procédure P5 — Protection des données » · [GUIDE] phase 4 (P5 RGPD) · [OFFRE] pack P1-P5
  { code: "P22_PROCEDURE_RGPD", category: "QUALITE_RISQUES", label: "Procédure P5 — Protection des données / RGPD (Obj. 2.2)" },
  // [SUIVI] « Fiche AIPD-SAD » · [GUIDE] phase 6 (« AIPD rédigée »)
  { code: "P22_AIPD", category: "QUALITE_RISQUES", label: "Analyse d'impact relative à la protection des données — AIPD (Obj. 2.2)" },
  // [SUIVI] gabarit D9 · [GUIDE] phase 6 (« tableau des droits d'accès »)
  { code: "P22_TABLEAU_DROITS_ACCES_DUI", category: "QUALITE_RISQUES", label: "Tableau des droits d'accès au DUI (Obj. 2.2)" },
  // [SUIVI] « Règlement intérieur » (10 critères) · [SEANCES] §6 : « règlement de
  // fonctionnement ≠ règlement intérieur », le second est un document RH (20/09)
  { code: "RH_REGLEMENT_INTERIEUR", category: "RH", label: "Règlement intérieur (droit du travail — distinct du règlement de fonctionnement)" },
];

// FICHES DE SENSIBILISATION « PERSONNE ACCOMPAGNÉE » (call du 28/10/2026) — une par
// procédure P1 à P5 (fiches remises par EODA à la structure pilote le 19/10, nommées
// P1…P5 comme les procédures). Elles se MONTRENT à l'accueil, sur la tablette, à côté
// de la ligne « À expliquer » correspondante, et vont dans le dossier de la personne.
// Produites par EODA, jamais réclamées ; aucun rattachement aux critères ici (la
// matrice ne s'écrit que par l'écran). Insérées en base par
// 20261029100000_awareness_sheet_types (même liste, test de concordance).
export const AWARENESS_SHEET_DOCUMENT_TYPES: readonly DocTypeSeed[] = [
  { code: "PA_FICHE_P1_PLAINTES", category: "QUALITE_RISQUES", label: "Fiche de sensibilisation personne accompagnée — P1 Plaintes et réclamations" },
  { code: "PA_FICHE_P2_EVENEMENTS_INDESIRABLES", category: "QUALITE_RISQUES", label: "Fiche de sensibilisation personne accompagnée — P2 Événements indésirables" },
  { code: "PA_FICHE_P3_MALTRAITANCE", category: "QUALITE_RISQUES", label: "Fiche de sensibilisation personne accompagnée — P3 Prévention de la maltraitance" },
  { code: "PA_FICHE_P4_GESTION_CRISE", category: "QUALITE_RISQUES", label: "Fiche de sensibilisation personne accompagnée — P4 Gestion de crise" },
  { code: "PA_FICHE_P5_DONNEES", category: "QUALITE_RISQUES", label: "Fiche de sensibilisation personne accompagnée — P5 Mes informations protégées" },
];

// Les 72 types upsertés par le seed, dans l'ordre d'affichage.
export const DOCUMENT_TYPE_SEEDS: readonly DocTypeSeed[] = [
  ...BASE_DOCUMENT_TYPES,
  ...PILOT_DOCUMENT_TYPES,
  ...AWARENESS_SHEET_DOCUMENT_TYPES,
];
