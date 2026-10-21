// ─────────────────────────────────────────────────────────────────────────────
// COPIE EMBARQUÉE — ne pas modifier à la main.
//
// Source unique : `.claude/specs/data/20261008_proposition-document-type-criterion.csv`
// (390 rattachements type de document → critère HAS : 207 proposés le 08/10/2026 à
// partir du tableau de suivi de la mission pilote, 183 ajoutés le 14/10/2026 pour les
// 19 types de document du référentiel documentaire du pilote — SANS aucune donnée du
// client, specs/04). Embarquée en module pour être lue côté serveur sans accès disque
// à l'exécution (Vercel) et sans dépendance `xlsx`. `criterion-matrix-service.test.ts`
// échoue si cette copie diverge de la source (fins de ligne normalisées en LF) :
// modifier la source, puis régénérer ce fichier.
//
// C'est une PROPOSITION : rien n'en est écrit en base sans validation par
// CABINET_ADMIN depuis l'écran « Critères & preuves » (jamais par un seed).
// ─────────────────────────────────────────────────────────────────────────────
export const PROPOSED_MATRIX_CSV = `document_type_code,document_type_label,criterion_code,source_libelle_xlsx,confiance,remarque
FONCT_CONSENTEMENT_ENTRETIEN,Lettre de consentement à l'entretien d'auto-évaluation — modèle vierge personnalisé,1.7.1,Lettre de consentement — entretien auto-évaluation (standard et FALC),MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
FONCT_CONSENTEMENT_ENTRETIEN,Lettre de consentement à l'entretien d'auto-évaluation — modèle vierge personnalisé,1.7.2,Lettre de consentement — entretien auto-évaluation (standard et FALC),MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
FONCT_CONSENTEMENT_ENTRETIEN,Lettre de consentement à l'entretien d'auto-évaluation — modèle vierge personnalisé,1.7.3,Lettre de consentement — entretien auto-évaluation (standard et FALC),MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
FONCT_CONSENTEMENT_ENTRETIEN,Lettre de consentement à l'entretien d'auto-évaluation — modèle vierge personnalisé,1.7.4,Lettre de consentement — entretien auto-évaluation (standard et FALC),MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
FONCT_DIRECTIVES_ANTICIPEES,Support d'information sur les directives anticipées (si concerné),2.1.2,FICHE-FALC DirectivesAnticipees,HAUTE,
FONCT_DIRECTIVES_ANTICIPEES,Support d'information sur les directives anticipées (si concerné),2.7.1,FICHE-FALC DirectivesAnticipees,HAUTE,code du critère présent dans le nom du fichier ; hors périmètre SAD aide selon le manuel (Médico-social | Toutes structures | PA/PHA/PDS) — applicable SAD mixte
FONCT_FICHE_TACHES_GABARIT,Fiche des tâches à domicile — modèle vierge personnalisé,1.10.1,FICHE DES TACHES (fusionnée au PAP v1.0),MOYENNE,la fiche des tâches est une composante du PAP validé ; objectif cité en bloc — à confirmer critère par critère
FONCT_FICHE_TACHES_GABARIT,Fiche des tâches à domicile — modèle vierge personnalisé,1.10.2,FICHE DES TACHES (fusionnée au PAP v1.0),MOYENNE,la fiche des tâches est une composante du PAP validé ; objectif cité en bloc — à confirmer critère par critère
FONCT_FICHE_TACHES_GABARIT,Fiche des tâches à domicile — modèle vierge personnalisé,1.10.3,FICHE DES TACHES (fusionnée au PAP v1.0),MOYENNE,la fiche des tâches est une composante du PAP validé ; objectif cité en bloc — à confirmer critère par critère
FONCT_FICHE_TACHES_GABARIT,Fiche des tâches à domicile — modèle vierge personnalisé,1.10.4,FICHE DES TACHES (fusionnée au PAP v1.0),MOYENNE,la fiche des tâches est une composante du PAP validé ; objectif cité en bloc — à confirmer critère par critère
FONCT_FICHE_TACHES_GABARIT,Fiche des tâches à domicile — modèle vierge personnalisé,1.10.5,FICHE DES TACHES (fusionnée au PAP v1.0),MOYENNE,la fiche des tâches est une composante du PAP validé ; objectif cité en bloc — à confirmer critère par critère
FONCT_FICHE_TACHES_GABARIT,Fiche des tâches à domicile — modèle vierge personnalisé,1.10.6,FICHE DES TACHES (fusionnée au PAP v1.0),MOYENNE,la fiche des tâches est une composante du PAP validé ; objectif cité en bloc — à confirmer critère par critère
FONCT_FICHE_TACHES_GABARIT,Fiche des tâches à domicile — modèle vierge personnalisé,1.12.1,Fiche de tâches,HAUTE,source : tableau de suivi de la mission pilote
FONCT_FICHE_TACHES_GABARIT,Fiche des tâches à domicile — modèle vierge personnalisé,1.12.2,Fiche de tâches,HAUTE,source : tableau de suivi de la mission pilote
FONCT_FICHE_TACHES_GABARIT,Fiche des tâches à domicile — modèle vierge personnalisé,1.12.3,Fiche de tâches,HAUTE,source : tableau de suivi de la mission pilote
FONCT_FICHE_TACHES_GABARIT,Fiche des tâches à domicile — modèle vierge personnalisé,1.17.2,FICHETACHES MultiCritères,MOYENNE,source : tableau de suivi de la mission pilote
FONCT_FICHE_TACHES_GABARIT,Fiche des tâches à domicile — modèle vierge personnalisé,1.17.3,FICHETACHES MultiCritères,MOYENNE,source : tableau de suivi de la mission pilote
FONCT_FICHE_TACHES_GABARIT,Fiche des tâches à domicile — modèle vierge personnalisé,2.5.3,Fiche de tâches,HAUTE,source : tableau de suivi de la mission pilote
FONCT_FICHE_TACHES_GABARIT,Fiche des tâches à domicile — modèle vierge personnalisé,2.8.1,FICHE DES TACHES « Points de vigilance et suivi de santé »,MOYENNE,"source : tableau de suivi de la mission pilote ; rattachement demandé, pas encore fait"
FONCT_FICHE_TACHES_GABARIT,Fiche des tâches à domicile — modèle vierge personnalisé,2.9.1,FICHETACHES MultiCritères,MOYENNE,source : tableau de suivi de la mission pilote
FONCT_FICHE_TACHES_GABARIT,Fiche des tâches à domicile — modèle vierge personnalisé,2.10.2,FICHETACHES MultiCritères,MOYENNE,source : tableau de suivi de la mission pilote
FONCT_FICHE_TACHES_GABARIT,Fiche des tâches à domicile — modèle vierge personnalisé,3.6.1,FICHE DES TACHES (3.6_3.7),BASSE,source : tableau de suivi de la mission pilote ; surveillance de la prise des médicaments ; hors périmètre SAD aide selon le manuel (Médico-social | Toutes structures | Tous publics) — applicable SAD mixte
FONCT_FICHE_TACHES_GABARIT,Fiche des tâches à domicile — modèle vierge personnalisé,3.6.3,FICHE DES TACHES (3.6_3.7),BASSE,source : tableau de suivi de la mission pilote ; surveillance de la prise des médicaments ; hors périmètre SAD aide selon le manuel (Médico-social | Toutes structures | Tous publics) — applicable SAD mixte
FONCT_FICHE_TACHES_GABARIT,Fiche des tâches à domicile — modèle vierge personnalisé,3.6.4,FICHE DES TACHES (3.6_3.7),BASSE,source : tableau de suivi de la mission pilote ; surveillance de la prise des médicaments
FONCT_FICHE_TACHES_GABARIT,Fiche des tâches à domicile — modèle vierge personnalisé,3.6.5,FICHE DES TACHES (3.6_3.7),BASSE,source : tableau de suivi de la mission pilote ; surveillance de la prise des médicaments ; hors périmètre SAD aide selon le manuel (Médico-social | Toutes structures | Tous publics) — applicable SAD mixte
FONCT_GRILLE_EVAL_BESOINS,Grille d'évaluation des besoins — modèle vierge personnalisé,1.6.1,Grille d'évaluation des besoins,MOYENNE,source : tableau de suivi de la mission pilote
FONCT_GRILLE_EVAL_BESOINS,Grille d'évaluation des besoins — modèle vierge personnalisé,1.6.2,Grille d'évaluation des besoins,MOYENNE,source : tableau de suivi de la mission pilote
FONCT_GRILLE_EVAL_BESOINS,Grille d'évaluation des besoins — modèle vierge personnalisé,1.6.3,Grille d'évaluation des besoins,MOYENNE,source : tableau de suivi de la mission pilote
FONCT_GRILLE_EVAL_BESOINS,Grille d'évaluation des besoins — modèle vierge personnalisé,1.10.1,Grille d'évaluation des besoins,MOYENNE,source : tableau de suivi de la mission pilote
FONCT_GRILLE_EVAL_BESOINS,Grille d'évaluation des besoins — modèle vierge personnalisé,1.10.2,Grille d'évaluation des besoins,MOYENNE,source : tableau de suivi de la mission pilote
FONCT_GRILLE_EVAL_BESOINS,Grille d'évaluation des besoins — modèle vierge personnalisé,1.10.3,EVALBESOINS Fusion v07,HAUTE,code du critère présent dans le nom du fichier
FONCT_GRILLE_EVAL_BESOINS,Grille d'évaluation des besoins — modèle vierge personnalisé,1.10.4,Grille d'évaluation des besoins,MOYENNE,source : tableau de suivi de la mission pilote
FONCT_GRILLE_EVAL_BESOINS,Grille d'évaluation des besoins — modèle vierge personnalisé,1.10.5,Grille d'évaluation des besoins,MOYENNE,source : tableau de suivi de la mission pilote
FONCT_GRILLE_EVAL_BESOINS,Grille d'évaluation des besoins — modèle vierge personnalisé,1.10.6,Grille d'évaluation des besoins,MOYENNE,source : tableau de suivi de la mission pilote
FONCT_GRILLE_EVAL_BESOINS,Grille d'évaluation des besoins — modèle vierge personnalisé,1.12.1,EVALBESOINS Fusion v07,HAUTE,code du critère présent dans le nom du fichier
FONCT_GRILLE_EVAL_BESOINS,Grille d'évaluation des besoins — modèle vierge personnalisé,1.12.2,EVALBESOINS Fusion v07,HAUTE,code du critère présent dans le nom du fichier
FONCT_GRILLE_EVAL_BESOINS,Grille d'évaluation des besoins — modèle vierge personnalisé,1.12.3,EVALBESOINS Fusion v07,HAUTE,code du critère présent dans le nom du fichier
FONCT_GRILLE_EVAL_BESOINS,Grille d'évaluation des besoins — modèle vierge personnalisé,1.14.1,EVALBESOINS Fusion,MOYENNE,objectif cité dans le nom du fichier — à confirmer critère par critère
FONCT_GRILLE_EVAL_BESOINS,Grille d'évaluation des besoins — modèle vierge personnalisé,1.14.2,EVALBESOINS Fusion,MOYENNE,objectif cité dans le nom du fichier — à confirmer critère par critère
FONCT_GRILLE_EVAL_BESOINS,Grille d'évaluation des besoins — modèle vierge personnalisé,1.14.3,EVALBESOINS Fusion,MOYENNE,objectif cité dans le nom du fichier — à confirmer critère par critère
FONCT_GRILLE_EVAL_BESOINS,Grille d'évaluation des besoins — modèle vierge personnalisé,1.15.5,EVALBESOINS Fusion,MOYENNE,objectif cité dans le nom du fichier — à confirmer critère par critère
FONCT_GRILLE_EVAL_BESOINS,Grille d'évaluation des besoins — modèle vierge personnalisé,1.15.6,EVALBESOINS Fusion,MOYENNE,objectif cité dans le nom du fichier — à confirmer critère par critère
FONCT_GRILLE_EVAL_BESOINS,Grille d'évaluation des besoins — modèle vierge personnalisé,2.3.1,EVALBESOINS Fusion v07,HAUTE,code du critère présent dans le nom du fichier
FONCT_GRILLE_EVAL_BESOINS,Grille d'évaluation des besoins — modèle vierge personnalisé,2.3.2,EVALBESOINS Fusion v07,HAUTE,code du critère présent dans le nom du fichier
FONCT_GRILLE_EVAL_BESOINS,Grille d'évaluation des besoins — modèle vierge personnalisé,2.4.2,Grille d'évaluation des besoins,MOYENNE,source : tableau de suivi de la mission pilote ; objectif cité en bloc — à confirmer critère par critère
FONCT_GRILLE_EVAL_BESOINS,Grille d'évaluation des besoins — modèle vierge personnalisé,2.4.3,Grille d'évaluation des besoins,MOYENNE,source : tableau de suivi de la mission pilote ; objectif cité en bloc — à confirmer critère par critère
FONCT_GRILLE_EVAL_BESOINS,Grille d'évaluation des besoins — modèle vierge personnalisé,2.4.4,Grille d'évaluation des besoins,MOYENNE,source : tableau de suivi de la mission pilote ; objectif cité en bloc — à confirmer critère par critère
FONCT_GRILLE_EVAL_BESOINS,Grille d'évaluation des besoins — modèle vierge personnalisé,2.4.5,Grille d'évaluation des besoins,MOYENNE,source : tableau de suivi de la mission pilote ; objectif cité en bloc — à confirmer critère par critère
FONCT_GRILLE_EVAL_BESOINS,Grille d'évaluation des besoins — modèle vierge personnalisé,2.4.6,Grille d'évaluation des besoins,MOYENNE,source : tableau de suivi de la mission pilote ; objectif cité en bloc — à confirmer critère par critère
FONCT_GRILLE_EVAL_BESOINS,Grille d'évaluation des besoins — modèle vierge personnalisé,2.4.7,Grille d'évaluation des besoins,MOYENNE,source : tableau de suivi de la mission pilote ; objectif cité en bloc — à confirmer critère par critère
FONCT_GRILLE_EVAL_BESOINS,Grille d'évaluation des besoins — modèle vierge personnalisé,2.6.1,EVALBESOINS Fusion,MOYENNE,objectif cité dans le nom du fichier — à confirmer critère par critère
FONCT_GRILLE_EVAL_BESOINS,Grille d'évaluation des besoins — modèle vierge personnalisé,2.6.3,EVALBESOINS Fusion,MOYENNE,objectif cité dans le nom du fichier — à confirmer critère par critère
FONCT_GRILLE_EVAL_BESOINS,Grille d'évaluation des besoins — modèle vierge personnalisé,3.5.2,Grille d'évaluation des besoins,BASSE,source : tableau de suivi de la mission pilote ; lien indirect
FONCT_LISTE_PARTENAIRES,Liste des partenaires mobilisables,1.11.2,REPERTOIRE PartenairesSanteTerritoire,HAUTE,code du critère présent dans le nom du fichier
FONCT_LISTE_PARTENAIRES,Liste des partenaires mobilisables,1.15.10,REPERTOIRE PartenairesSanteTerritoire,HAUTE,code du critère présent dans le nom du fichier
FONCT_LISTE_PARTENAIRES,Liste des partenaires mobilisables,1.17.2,LISTE-PARTENAIRES-MOBILISABLES | REPERTOIRE PartenairesSanteTerritoire,HAUTE,code du critère présent dans le nom du fichier
FONCT_LISTE_PARTENAIRES,Liste des partenaires mobilisables,1.17.3,REPERTOIRE PartenairesSanteTerritoire,HAUTE,
FONCT_LISTE_PARTENAIRES,Liste des partenaires mobilisables,1.17.4,REPERTOIRE PartenairesSanteTerritoire,HAUTE,
FONCT_LISTE_PARTENAIRES,Liste des partenaires mobilisables,2.9.1,REPERTOIRE PartenairesSanteTerritoire,HAUTE,
FONCT_LISTE_PARTENAIRES,Liste des partenaires mobilisables,2.9.2,REPERTOIRE PartenairesSanteTerritoire,HAUTE,
FONCT_LISTE_PARTENAIRES,Liste des partenaires mobilisables,3.12.1,LISTE-PARTENAIRES-MOBILISABLES,BASSE,"source : onglet Critères Impératifs uniquement ; liste de partenaires citée pour les plaintes/réclamations : lien peu évident, à confirmer"
FONCT_NOTE_SERVICE,Note de service,2.2.2,NOTE-SERVICE DroitsFondamentaux | Note de service CI,HAUTE,note de service créée pour le critère (onglet Critères Impératifs)
FONCT_NOTE_SERVICE,Note de service,2.2.3,NOTE-SERVICE DroitsFondamentaux | Note de service CI,HAUTE,note de service créée pour le critère (onglet Critères Impératifs)
FONCT_NOTE_SERVICE,Note de service,2.2.4,NOTE-SERVICE DroitsFondamentaux | Note de service CI,HAUTE,note de service créée pour le critère (onglet Critères Impératifs)
FONCT_NOTE_SERVICE,Note de service,2.2.5,NOTE-SERVICE DroitsFondamentaux | Note de service CI,HAUTE,note de service créée pour le critère (onglet Critères Impératifs)
FONCT_NOTE_SERVICE,Note de service,2.2.6,NOTE-SERVICE DroitsFondamentaux (2.2.2 à 2.2.7),MOYENNE,plage de critères écrite dans le nom du fichier
FONCT_NOTE_SERVICE,Note de service,2.2.7,NOTE-SERVICE DroitsFondamentaux (2.2.2 à 2.2.7),MOYENNE,plage de critères écrite dans le nom du fichier
FONCT_NOTE_SERVICE,Note de service,3.1.1,NOTE-SERVICE Affiche A4 Bientraitance,MOYENNE,objectif cité en bloc — à confirmer critère par critère
FONCT_NOTE_SERVICE,Note de service,3.1.2,NOTE-SERVICE Affiche A4 Bientraitance,MOYENNE,objectif cité en bloc — à confirmer critère par critère
FONCT_NOTE_SERVICE,Note de service,3.1.3,NOTE-SERVICE Affiche A4 Bientraitance,MOYENNE,objectif cité en bloc — à confirmer critère par critère
FONCT_NOTE_SERVICE,Note de service,3.1.4,NOTE-SERVICE Affiche A4 Bientraitance,MOYENNE,objectif cité en bloc — à confirmer critère par critère
FONCT_NOTE_SERVICE,Note de service,3.8.1,Classeur des notes de service,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
FONCT_NOTE_SERVICE,Note de service,3.8.2,Classeur des notes de service,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
FONCT_NOTE_SERVICE,Note de service,3.8.3,Classeur des notes de service,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
FONCT_NOTE_SERVICE,Note de service,3.8.4,Classeur des notes de service,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
FONCT_NOTE_SERVICE,Note de service,3.8.5,Classeur des notes de service,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
FONCT_NOTE_SERVICE,Note de service,3.8.6,Classeur des notes de service,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
FONCT_NOTE_SERVICE,Note de service,3.11.1,NOTE-SERVICE Affiche A4 Bientraitance (P3),HAUTE,
FONCT_PAP_GABARIT,Projet d'accompagnement personnalisé (PAP) — modèle vierge personnalisé,1.10.1,PAP (nom de fichier « 1.10 »),MOYENNE,objectif cité en bloc — à confirmer critère par critère
FONCT_PAP_GABARIT,Projet d'accompagnement personnalisé (PAP) — modèle vierge personnalisé,1.10.2,PAP (nom de fichier « 1.10 »),MOYENNE,objectif cité en bloc — à confirmer critère par critère
FONCT_PAP_GABARIT,Projet d'accompagnement personnalisé (PAP) — modèle vierge personnalisé,1.10.3,PAP v1.0 du 07/10 (version avec références de critères) | PAP,HAUTE,critère cité dans le corps du PAP validé ; confirmé par le tableau de suivi
FONCT_PAP_GABARIT,Projet d'accompagnement personnalisé (PAP) — modèle vierge personnalisé,1.10.4,PAP v1.0 du 07/10 (version avec références de critères) | PAP,HAUTE,critère cité dans le corps du PAP validé ; confirmé par le tableau de suivi
FONCT_PAP_GABARIT,Projet d'accompagnement personnalisé (PAP) — modèle vierge personnalisé,1.10.5,PAP v1.0 du 07/10 (version avec références de critères) | PAP,HAUTE,critère cité dans le corps du PAP validé ; confirmé par le tableau de suivi
FONCT_PAP_GABARIT,Projet d'accompagnement personnalisé (PAP) — modèle vierge personnalisé,1.10.6,PAP v1.0 du 07/10 (version avec références de critères) | PAP,HAUTE,critère cité dans le corps du PAP validé ; confirmé par le tableau de suivi
FONCT_PAP_GABARIT,Projet d'accompagnement personnalisé (PAP) — modèle vierge personnalisé,1.11.1,PAP v1.0 du 07/10 (version avec références de critères) | PAP,HAUTE,critère cité dans le corps du PAP validé ; confirmé par le tableau de suivi
FONCT_PAP_GABARIT,Projet d'accompagnement personnalisé (PAP) — modèle vierge personnalisé,2.3.1,PAP v1.0 du 07/10 (version avec références de critères) | PAP,HAUTE,critère cité dans le corps du PAP validé ; confirmé par le tableau de suivi
FONCT_PAP_GABARIT,Projet d'accompagnement personnalisé (PAP) — modèle vierge personnalisé,2.3.2,PAP v1.0 du 07/10 (version avec références de critères) | PAP,HAUTE,critère cité dans le corps du PAP validé ; confirmé par le tableau de suivi
FONCT_PAP_GABARIT,Projet d'accompagnement personnalisé (PAP) — modèle vierge personnalisé,2.4.1,PAP v1.0 du 07/10 (version avec références de critères) §8 Risques,BASSE,le PAP écrit « 2.4.1 à 2.4.8 selon les risques concernés » ; hors périmètre SAD aide selon le manuel (Tous ESSMS | Établissement | Tous publics)
FONCT_PAP_GABARIT,Projet d'accompagnement personnalisé (PAP) — modèle vierge personnalisé,2.4.2,PAP v1.0 du 07/10 (version avec références de critères) §8 Risques,MOYENNE,le PAP écrit « 2.4.1 à 2.4.8 selon les risques concernés » : 2.4.8 n'existe pas dans le manuel
FONCT_PAP_GABARIT,Projet d'accompagnement personnalisé (PAP) — modèle vierge personnalisé,2.4.3,PAP v1.0 du 07/10 (version avec références de critères) §8 Risques,MOYENNE,le PAP écrit « 2.4.1 à 2.4.8 selon les risques concernés » : 2.4.8 n'existe pas dans le manuel
FONCT_PAP_GABARIT,Projet d'accompagnement personnalisé (PAP) — modèle vierge personnalisé,2.4.4,PAP v1.0 du 07/10 (version avec références de critères) §8 Risques,MOYENNE,le PAP écrit « 2.4.1 à 2.4.8 selon les risques concernés » : 2.4.8 n'existe pas dans le manuel
FONCT_PAP_GABARIT,Projet d'accompagnement personnalisé (PAP) — modèle vierge personnalisé,2.4.5,PAP v1.0 du 07/10 (version avec références de critères) §8 Risques,MOYENNE,le PAP écrit « 2.4.1 à 2.4.8 selon les risques concernés » : 2.4.8 n'existe pas dans le manuel
FONCT_PAP_GABARIT,Projet d'accompagnement personnalisé (PAP) — modèle vierge personnalisé,2.4.6,PAP v1.0 du 07/10 (version avec références de critères) §8 Risques,MOYENNE,le PAP écrit « 2.4.1 à 2.4.8 selon les risques concernés » : 2.4.8 n'existe pas dans le manuel
FONCT_PAP_GABARIT,Projet d'accompagnement personnalisé (PAP) — modèle vierge personnalisé,2.4.7,PAP v1.0 du 07/10 (version avec références de critères) §8 Risques,MOYENNE,le PAP écrit « 2.4.1 à 2.4.8 selon les risques concernés » : 2.4.8 n'existe pas dans le manuel
FONCT_PAP_GABARIT,Projet d'accompagnement personnalisé (PAP) — modèle vierge personnalisé,2.6.2,GABARIT VIERGE PAP (nom de fichier « 2.6.2 »),MOYENNE,source : tableau de suivi de la mission pilote ; hors périmètre SAD aide selon le manuel (Médico-social | Toutes structures | Tous publics) — applicable SAD mixte
FONCT_PAP_GABARIT,Projet d'accompagnement personnalisé (PAP) — modèle vierge personnalisé,3.5.2,volet PAP,BASSE,source : tableau de suivi de la mission pilote ; lien indirect
L2002_CHARTE_DROITS,Charte des droits et libertés de la personne accueillie,1.2.1,Charte des droits et libertés,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_CHARTE_DROITS,Charte des droits et libertés de la personne accueillie,1.2.2,Charte des droits et libertés,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_CHARTE_DROITS,Charte des droits et libertés de la personne accueillie,1.2.3,Charte des droits et libertés,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_CHARTE_DROITS,Charte des droits et libertés de la personne accueillie,1.2.4,Charte des droits et libertés,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_CHARTE_DROITS,Charte des droits et libertés de la personne accueillie,1.2.5,Charte des droits et libertés,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_CHARTE_DROITS,Charte des droits et libertés de la personne accueillie,1.2.6,Charte des droits et libertés,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_CHARTE_DROITS,Charte des droits et libertés de la personne accueillie,1.2.7,Charte des droits et libertés,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_CHARTE_DROITS,Charte des droits et libertés de la personne accueillie,2.2.2,Charte des droits et libertés affichée,HAUTE,
L2002_CHARTE_DROITS,Charte des droits et libertés de la personne accueillie,2.2.6,Charte des droits et libertés | GABARIT Charte-Droits-Libertes-Personne-Accueillie FALC | GABARIT Charte-Droits-Libertes-Personne-Accueillie,HAUTE,code du critère présent dans le nom du fichier ; confirmé par les deux onglets
L2002_CR_CVS,Comptes-rendus CVS (ou autre forme de participation des usagers),3.13.2,TRAME-PRESENTATION PCA-CVS | GABARIT CR-Entretien-CVS,MOYENNE,"trame/CR d’entretien CVS, pas un CR de séance CVS ; source : onglet Critères Impératifs uniquement"
L2002_CR_CVS,Comptes-rendus CVS (ou autre forme de participation des usagers),3.14.1,TRAME-PRESENTATION PCA-CVS | GABARIT CR-Entretien-CVS,MOYENNE,"trame/CR d’entretien CVS, pas un CR de séance CVS ; source : onglet Critères Impératifs uniquement"
L2002_CR_CVS,Comptes-rendus CVS (ou autre forme de participation des usagers),3.14.2,Trame et CR d'entretien — instance de participation des usagers | TRAME-PRESENTATION PCA-CVS | GABARIT CR-Entretien-CVS,MOYENNE,"trame/CR d’entretien CVS, pas un CR de séance CVS ; confirmé par les deux onglets"
L2002_DIPC,DIPC / Contrat de séjour,1.2.1,DIPEC,MOYENNE,le xlsx écrit « DIPEC » ; libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_DIPC,DIPC / Contrat de séjour,1.2.2,DIPEC,MOYENNE,le xlsx écrit « DIPEC » ; libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_DIPC,DIPC / Contrat de séjour,1.2.3,DIPEC,MOYENNE,le xlsx écrit « DIPEC » ; libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_DIPC,DIPC / Contrat de séjour,1.2.4,DIPEC,MOYENNE,le xlsx écrit « DIPEC » ; libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_DIPC,DIPC / Contrat de séjour,1.2.5,DIPEC,MOYENNE,le xlsx écrit « DIPEC » ; libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_DIPC,DIPC / Contrat de séjour,1.2.6,DIPEC,MOYENNE,le xlsx écrit « DIPEC » ; libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_DIPC,DIPC / Contrat de séjour,1.2.7,DIPEC,MOYENNE,le xlsx écrit « DIPEC » ; libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_DIPC,DIPC / Contrat de séjour,1.4.1,DIPEC,HAUTE,le xlsx écrit « DIPEC »
L2002_DIPC,DIPC / Contrat de séjour,1.4.2,DIPEC,HAUTE,le xlsx écrit « DIPEC » ; hors périmètre SAD aide selon le manuel (Tous ESSMS | Établissement | Tous publics)
L2002_DIPC,DIPC / Contrat de séjour,1.10.1,DIPEC,MOYENNE,le xlsx écrit « DIPEC » ; libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_DIPC,DIPC / Contrat de séjour,1.10.2,DIPEC,MOYENNE,le xlsx écrit « DIPEC » ; libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_DIPC,DIPC / Contrat de séjour,1.10.3,DIPEC,MOYENNE,le xlsx écrit « DIPEC » ; libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_DIPC,DIPC / Contrat de séjour,1.10.4,DIPEC,MOYENNE,le xlsx écrit « DIPEC » ; libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_DIPC,DIPC / Contrat de séjour,1.10.5,DIPEC,MOYENNE,le xlsx écrit « DIPEC » ; libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_DIPC,DIPC / Contrat de séjour,1.10.6,DIPEC,MOYENNE,le xlsx écrit « DIPEC » ; libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_DIPC,DIPC / Contrat de séjour,1.11.1,DIPEC,HAUTE,le xlsx écrit « DIPEC »
L2002_DIPC,DIPC / Contrat de séjour,1.11.2,DIPEC,HAUTE,le xlsx écrit « DIPEC »
L2002_DIPC,DIPC / Contrat de séjour,1.17.2,DIPEC,HAUTE,le xlsx écrit « DIPEC »
L2002_DIPC,DIPC / Contrat de séjour,1.17.3,DIPEC,HAUTE,le xlsx écrit « DIPEC »
L2002_DIPC,DIPC / Contrat de séjour,1.17.4,DIPEC,HAUTE,le xlsx écrit « DIPEC »
L2002_DIPC,DIPC / Contrat de séjour,2.1.2,DIPEC,HAUTE,le xlsx écrit « DIPEC »
L2002_DIPC,DIPC / Contrat de séjour,2.2.2,DIPEC,HAUTE,le xlsx écrit « DIPEC » ; source : onglet Critères Impératifs uniquement
L2002_DIPC,DIPC / Contrat de séjour,2.2.3,DIPEC,HAUTE,le xlsx écrit « DIPEC » ; source : onglet Critères Impératifs uniquement
L2002_DIPC,DIPC / Contrat de séjour,2.2.5,DIPEC,HAUTE,le xlsx écrit « DIPEC » ; source : onglet Critères Impératifs uniquement
L2002_DIPC,DIPC / Contrat de séjour,2.2.6,DIPEC,HAUTE,le xlsx écrit « DIPEC » ; confirmé par les deux onglets
L2002_DIPC,DIPC / Contrat de séjour,2.4.1,DIPEC,MOYENNE,le xlsx écrit « DIPEC » ; libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère ; hors périmètre SAD aide selon le manuel (Tous ESSMS | Établissement | Tous publics)
L2002_DIPC,DIPC / Contrat de séjour,2.4.2,DIPEC,MOYENNE,le xlsx écrit « DIPEC » ; libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_DIPC,DIPC / Contrat de séjour,2.4.3,DIPEC,MOYENNE,le xlsx écrit « DIPEC » ; libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_DIPC,DIPC / Contrat de séjour,2.4.4,DIPEC,MOYENNE,le xlsx écrit « DIPEC » ; libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_DIPC,DIPC / Contrat de séjour,2.4.5,DIPEC,MOYENNE,le xlsx écrit « DIPEC » ; libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_DIPC,DIPC / Contrat de séjour,2.4.6,DIPEC,MOYENNE,le xlsx écrit « DIPEC » ; libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_DIPC,DIPC / Contrat de séjour,2.4.7,DIPEC,MOYENNE,le xlsx écrit « DIPEC » ; libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_DIPC,DIPC / Contrat de séjour,2.7.1,DIPEC,HAUTE,le xlsx écrit « DIPEC » ; hors périmètre SAD aide selon le manuel (Médico-social | Toutes structures | PA/PHA/PDS) — applicable SAD mixte
L2002_DIPC,DIPC / Contrat de séjour,2.8.2,DIPEC,HAUTE,le xlsx écrit « DIPEC »
L2002_DIPC,DIPC / Contrat de séjour,2.9.1,DIPEC,HAUTE,le xlsx écrit « DIPEC »
L2002_DIPC,DIPC / Contrat de séjour,2.9.2,DIPEC,HAUTE,le xlsx écrit « DIPEC »
L2002_DIPC,DIPC / Contrat de séjour,2.9.3,DIPEC,HAUTE,le xlsx écrit « DIPEC »
L2002_DIPC,DIPC / Contrat de séjour,2.10.1,DIPEC,HAUTE,le xlsx écrit « DIPEC »
L2002_DIPC,DIPC / Contrat de séjour,3.2.1,DIPEC,HAUTE,le xlsx écrit « DIPEC »
L2002_DIPC,DIPC / Contrat de séjour,3.2.2,DIPEC,HAUTE,le xlsx écrit « DIPEC » ; hors périmètre SAD aide selon le manuel (Tous ESSMS | Établissement | Tous publics)
L2002_LIVRET_ACCUEIL,Livret d'accueil,1.1.1,Livret d accueil,HAUTE,
L2002_LIVRET_ACCUEIL,Livret d'accueil,1.2.1,Livret d'accueil PA,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_LIVRET_ACCUEIL,Livret d'accueil,1.2.2,Livret d'accueil PA,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_LIVRET_ACCUEIL,Livret d'accueil,1.2.3,Livret d'accueil PA,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_LIVRET_ACCUEIL,Livret d'accueil,1.2.4,Livret d'accueil PA,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_LIVRET_ACCUEIL,Livret d'accueil,1.2.5,Livret d'accueil PA,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_LIVRET_ACCUEIL,Livret d'accueil,1.2.6,Livret d'accueil PA,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_LIVRET_ACCUEIL,Livret d'accueil,1.2.7,Livret d'accueil PA,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_LIVRET_ACCUEIL,Livret d'accueil,1.17.1,Livret d accueil,HAUTE,
L2002_LIVRET_ACCUEIL,Livret d'accueil,2.2.2,Livret d'accueil PA | Livret d accueil,HAUTE,confirmé par les deux onglets
L2002_LIVRET_ACCUEIL,Livret d'accueil,2.2.3,Livret d'accueil PA | Livret d accueil,HAUTE,confirmé par les deux onglets
L2002_LIVRET_ACCUEIL,Livret d'accueil,2.2.4,Livret d'accueil PA,HAUTE,
L2002_LIVRET_ACCUEIL,Livret d'accueil,2.2.5,Livret d accueil,HAUTE,source : onglet Critères Impératifs uniquement
L2002_LIVRET_ACCUEIL,Livret d'accueil,2.2.6,Livret d'accueil PA | Livret d accueil,HAUTE,confirmé par les deux onglets
L2002_LIVRET_ACCUEIL,Livret d'accueil,2.3.2,Livret d'accueil | Livret d accueil,HAUTE,
L2002_LIVRET_ACCUEIL,Livret d'accueil,2.8.2,Livret d accueil,HAUTE,
L2002_LIVRET_ACCUEIL,Livret d'accueil,3.11.2,Livret d accueil,HAUTE,source : onglet Critères Impératifs uniquement
L2002_PROJET_SERVICE,Projet d'établissement / Projet de service,2.2.7,PROJET DE SERVICE,HAUTE,source : onglet Critères Impératifs uniquement
L2002_PROJET_SERVICE,Projet d'établissement / Projet de service,2.3.1,Projet de service . | PROJET DE SERVICE,HAUTE,
L2002_PROJET_SERVICE,Projet d'établissement / Projet de service,2.3.2,Projet de service | PROJET DE SERVICE,HAUTE,
L2002_PROJET_SERVICE,Projet d'établissement / Projet de service,3.4.1,Projet de service,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_PROJET_SERVICE,Projet d'établissement / Projet de service,3.4.2,Projet de service,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_PROJET_SERVICE,Projet d'établissement / Projet de service,3.4.3,Projet de service,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_PROJET_SERVICE,Projet d'établissement / Projet de service,3.4.4,Projet de service,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_PROJET_SERVICE,Projet d'établissement / Projet de service,3.4.5,Projet de service,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_PROJET_SERVICE,Projet d'établissement / Projet de service,3.11.2,PROJET DE SERVICE,HAUTE,source : onglet Critères Impératifs uniquement
L2002_REGLEMENT_FONCTIONNEMENT,Règlement de fonctionnement,1.2.1,Règlement de fonctionnement,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_REGLEMENT_FONCTIONNEMENT,Règlement de fonctionnement,1.2.2,Règlement de fonctionnement,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_REGLEMENT_FONCTIONNEMENT,Règlement de fonctionnement,1.2.3,Règlement de fonctionnement,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_REGLEMENT_FONCTIONNEMENT,Règlement de fonctionnement,1.2.4,Règlement de fonctionnement,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_REGLEMENT_FONCTIONNEMENT,Règlement de fonctionnement,1.2.5,Règlement de fonctionnement,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_REGLEMENT_FONCTIONNEMENT,Règlement de fonctionnement,1.2.6,Règlement de fonctionnement,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_REGLEMENT_FONCTIONNEMENT,Règlement de fonctionnement,1.2.7,Règlement de fonctionnement,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
L2002_REGLEMENT_FONCTIONNEMENT,Règlement de fonctionnement,1.3.1,Règlement de fonctionnement,HAUTE,
L2002_REGLEMENT_FONCTIONNEMENT,Règlement de fonctionnement,1.3.2,Règlement de fonctionnement,HAUTE,
L2002_REGLEMENT_FONCTIONNEMENT,Règlement de fonctionnement,1.4.1,Règlement de fonctionnement,HAUTE,
L2002_REGLEMENT_FONCTIONNEMENT,Règlement de fonctionnement,1.4.2,Règlement de fonctionnement,HAUTE,hors périmètre SAD aide selon le manuel (Tous ESSMS | Établissement | Tous publics)
L2002_REGLEMENT_FONCTIONNEMENT,Règlement de fonctionnement,1.12.3,REGLEMENT DE FONCTIONNEMENT,HAUTE,
L2002_REGLEMENT_FONCTIONNEMENT,Règlement de fonctionnement,2.2.2,REGLEMENT DE FONCTIONNEMENT,HAUTE,source : onglet Critères Impératifs uniquement
L2002_REGLEMENT_FONCTIONNEMENT,Règlement de fonctionnement,2.2.3,REGLEMENT DE FONCTIONNEMENT,HAUTE,source : onglet Critères Impératifs uniquement
L2002_REGLEMENT_FONCTIONNEMENT,Règlement de fonctionnement,2.2.4,REGLEMENT DE FONCTIONNEMENT,HAUTE,source : onglet Critères Impératifs uniquement
L2002_REGLEMENT_FONCTIONNEMENT,Règlement de fonctionnement,2.2.6,REGLEMENT DE FONCTIONNEMENT,HAUTE,confirmé par les deux onglets
L2002_REGLEMENT_FONCTIONNEMENT,Règlement de fonctionnement,2.3.2,Règlement de fonctionnement / procédure d'admission | REGLEMENT DE FONCTIONNEMENT,HAUTE,
L2002_REGLEMENT_FONCTIONNEMENT,Règlement de fonctionnement,2.8.1,REGLEMENT DE FONCTIONNEMENT,HAUTE,
L2002_REGLEMENT_FONCTIONNEMENT,Règlement de fonctionnement,2.8.2,REGLEMENT DE FONCTIONNEMENT,HAUTE,
L2002_REGLEMENT_FONCTIONNEMENT,Règlement de fonctionnement,2.9.2,REGLEMENT DE FONCTIONNEMENT,HAUTE,
L2002_REGLEMENT_FONCTIONNEMENT,Règlement de fonctionnement,3.2.1,Règlement de fonctionnement,HAUTE,
L2002_REGLEMENT_FONCTIONNEMENT,Règlement de fonctionnement,3.2.2,Règlement de fonctionnement,HAUTE,hors périmètre SAD aide selon le manuel (Tous ESSMS | Établissement | Tous publics)
P11_CARTOGRAPHIE_RISQUES,Cartographie des risques de maltraitance (Obj. 3.11),3.11.1,Fiche de cartographie des risque de maltraitance Co-contruction en séance A imprimer,HAUTE,source : onglet Critères Impératifs uniquement
P11_CR_SENSIBILISATION,CR de sensibilisation des équipes — maltraitance (Obj. 3.11),3.1.4,D10-PREREMPLI SeanceBientraitance,MOYENNE,"feuille d’émargement d’une séance bientraitance, pas un CR ; code du critère présent dans le nom du fichier ; type défini pour l'objectif 3.11, utilisé ici hors objectif"
P11_CR_SENSIBILISATION,CR de sensibilisation des équipes — maltraitance (Obj. 3.11),3.11.3,D10-PREREMPLI SeanceBientraitance,MOYENNE,"feuille d’émargement d’une séance bientraitance, pas un CR"
P11_PLAN_PREVENTION,Plan de prévention maltraitance (Obj. 3.11),3.11.1,Procédure P3 — Prévention de la maltraitance | PROCEDURE PreventionMaltraitance,MOYENNE,la procédure P3 tient lieu de plan de prévention ? à trancher ; confirmé par les deux onglets
P11_PLAN_PREVENTION,Plan de prévention maltraitance (Obj. 3.11),3.11.2,Procédure P3 | PROCEDURE P3 PreventionMaltraitance,MOYENNE,la procédure P3 tient lieu de plan de prévention ? à trancher ; confirmé par les deux onglets
P11_PLAN_PREVENTION,Plan de prévention maltraitance (Obj. 3.11),3.11.3,PROCEDURE PreventionMaltraitance,MOYENNE,la procédure P3 tient lieu de plan de prévention ? à trancher
P11_PROCEDURE,Procédure P3 — Prévention de la maltraitance (Obj. 3.11),3.11.1,Procédure P3 — Prévention de la maltraitance,HAUTE,confirmé par les deux onglets
P11_PROCEDURE,Procédure P3 — Prévention de la maltraitance (Obj. 3.11),3.11.2,Procédure P3 — Prévention de la maltraitance,HAUTE,confirmé par les deux onglets
P11_PROCEDURE,Procédure P3 — Prévention de la maltraitance (Obj. 3.11),3.11.3,PROCEDURE (P3) PreventionMaltraitance,MOYENNE,source : tableau de suivi de la mission pilote
P11_PROCEDURE,Procédure P3 — Prévention de la maltraitance (Obj. 3.11),3.12.1,Procédure P3 (section 8),MOYENNE,source : onglet Critères Impératifs uniquement
P11_SIGNALEMENTS_TRACES,Traçabilité des signalements traités (Obj. 3.11),3.11.1,REGISTRE MaltraitancesPotentielles,HAUTE,source : onglet Critères Impératifs uniquement
P11_SIGNALEMENTS_TRACES,Traçabilité des signalements traités (Obj. 3.11),3.11.2,Registre des maltraitances potentielles,HAUTE,
P12_AR_TYPE,Accusés de réception type — plaintes (Obj. 3.12),3.12.1,Modele AccuseReception P1,HAUTE,source : onglet Critères Impératifs uniquement
P12_AR_TYPE,Accusés de réception type — plaintes (Obj. 3.12),3.12.2,Accusé de réception type | Modele AccuseReception P1,HAUTE,confirmé par les deux onglets
P12_CR_ANALYSE_EQUIPE,CR de réunion d'analyse en équipe — plaintes (Obj. 3.12),2.1.1,Comptes rendus d'analyse d'équipe,BASSE,"« CR d’analyse d’équipe (P1, P2) » cité pour l’éthique : CR plaintes/EI détourné, à confirmer ; libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère ; type défini pour l'objectif 3.12, utilisé ici hors objectif"
P12_CR_ANALYSE_EQUIPE,CR de réunion d'analyse en équipe — plaintes (Obj. 3.12),2.1.2,Comptes rendus d'analyse d'équipe,BASSE,"« CR d’analyse d’équipe (P1, P2) » cité pour l’éthique : CR plaintes/EI détourné, à confirmer ; libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère ; type défini pour l'objectif 3.12, utilisé ici hors objectif"
P12_CR_ANALYSE_EQUIPE,CR de réunion d'analyse en équipe — plaintes (Obj. 3.12),2.1.3,Comptes rendus d'analyse d'équipe,BASSE,"« CR d’analyse d’équipe (P1, P2) » cité pour l’éthique : CR plaintes/EI détourné, à confirmer ; libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère ; type défini pour l'objectif 3.12, utilisé ici hors objectif"
P12_CR_ANALYSE_EQUIPE,CR de réunion d'analyse en équipe — plaintes (Obj. 3.12),2.1.4,Comptes rendus d'analyse d'équipe,BASSE,"« CR d’analyse d’équipe (P1, P2) » cité pour l’éthique : CR plaintes/EI détourné, à confirmer ; libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère ; type défini pour l'objectif 3.12, utilisé ici hors objectif"
P12_CR_ANALYSE_EQUIPE,CR de réunion d'analyse en équipe — plaintes (Obj. 3.12),3.12.1,CR AnalyseEquipe Plaintes P1,HAUTE,source : onglet Critères Impératifs uniquement
P12_CR_ANALYSE_EQUIPE,CR de réunion d'analyse en équipe — plaintes (Obj. 3.12),3.12.2,CR AnalyseEquipe Plaintes P1,HAUTE,source : onglet Critères Impératifs uniquement
P12_CR_ANALYSE_EQUIPE,CR de réunion d'analyse en équipe — plaintes (Obj. 3.12),3.12.3,Compte rendu d'analyse d'équipe | CR AnalyseEquipe Plaintes P1,HAUTE,confirmé par les deux onglets
P12_PROCEDURE,Procédure P1 — Plaintes et réclamations (Obj. 3.12),2.2.6,PROCEDURE (P1) PlaintesReclamations,MOYENNE,source : tableau de suivi de la mission pilote
P12_PROCEDURE,Procédure P1 — Plaintes et réclamations (Obj. 3.12),3.12.1,Procédure P1 — Plaintes et réclamations,HAUTE,confirmé par les deux onglets
P12_PROCEDURE,Procédure P1 — Plaintes et réclamations (Obj. 3.12),3.12.2,Procédure P1 — Plaintes et réclamations,HAUTE,confirmé par les deux onglets
P12_PROCEDURE,Procédure P1 — Plaintes et réclamations (Obj. 3.12),3.12.3,Procédure P1 — Plaintes et réclamations,HAUTE,confirmé par les deux onglets
P12_REGISTRE,Registre des plaintes / réclamations (Obj. 3.12),2.2.6,REGISTRE P1 PlaintesReclamations,MOYENNE,"confirmé par les deux onglets ; type défini pour l'objectif 3.12, utilisé ici hors objectif"
P12_REGISTRE,Registre des plaintes / réclamations (Obj. 3.12),3.12.1,Registre P1 | REGISTRE P1 PlaintesReclamations,HAUTE,confirmé par les deux onglets
P12_REGISTRE,Registre des plaintes / réclamations (Obj. 3.12),3.12.2,REGISTRE P1 PlaintesReclamations,HAUTE,source : onglet Critères Impératifs uniquement
P12_REGISTRE,Registre des plaintes / réclamations (Obj. 3.12),3.12.3,REGISTRE P1 PlaintesReclamations,HAUTE,source : onglet Critères Impératifs uniquement
P12_REPONSE_FINALE,Modèle de réponse finale — plaintes (Obj. 3.12),3.12.1,Modele ReponseFinale P1,HAUTE,source : onglet Critères Impératifs uniquement
P12_REPONSE_FINALE,Modèle de réponse finale — plaintes (Obj. 3.12),3.12.2,Réponse type | Modele ReponseFinale P1,HAUTE,confirmé par les deux onglets
P13_CR_RETEX,CR de RETEX / CREX (Obj. 3.13),3.13.1,CR Analyse Evènements-Indésirables,HAUTE,code du critère présent dans le nom du fichier ; source : onglet Critères Impératifs uniquement
P13_CR_RETEX,CR de RETEX / CREX (Obj. 3.13),3.13.3,Compte rendu d'analyse ALARM | CR Analyse Evènements-Indésirables,HAUTE,confirmé par les deux onglets
P13_FICHE_DECLARATION,Fiche de déclaration EI type (Obj. 3.13),3.13.1,Fiche de déclaration | FICHE-DeclarationEI,HAUTE,confirmé par les deux onglets
P13_FICHE_DECLARATION,Fiche de déclaration EI type (Obj. 3.13),3.13.3,FICHE-DeclarationEI,HAUTE,source : onglet Critères Impératifs uniquement
P13_FICHE_DECLARATION,Fiche de déclaration EI type (Obj. 3.13),3.13.4,FICHE-DeclarationEI,HAUTE,
P13_MODE_OPERATOIRE_FAMO,Mode opératoire de signalement et d'orientation FAMO (Obj. 3.13),1.12.1,Fiche de tâches · Mode opératoire FAMO,MOYENNE,source : tableau de suivi de la mission pilote
P13_MODE_OPERATOIRE_FAMO,Mode opératoire de signalement et d'orientation FAMO (Obj. 3.13),1.12.2,Fiche de tâches · Mode opératoire FAMO,MOYENNE,source : tableau de suivi de la mission pilote
P13_MODE_OPERATOIRE_FAMO,Mode opératoire de signalement et d'orientation FAMO (Obj. 3.13),1.12.3,Fiche de tâches · Mode opératoire FAMO,MOYENNE,source : tableau de suivi de la mission pilote
P13_MODE_OPERATOIRE_FAMO,Mode opératoire de signalement et d'orientation FAMO (Obj. 3.13),1.14.1,Mode opératoire FAMO · Formulaire FAMO DAC Santé,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
P13_MODE_OPERATOIRE_FAMO,Mode opératoire de signalement et d'orientation FAMO (Obj. 3.13),1.14.2,Mode opératoire FAMO · Formulaire FAMO DAC Santé,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
P13_MODE_OPERATOIRE_FAMO,Mode opératoire de signalement et d'orientation FAMO (Obj. 3.13),1.14.3,Mode opératoire FAMO · Formulaire FAMO DAC Santé,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
P13_MODE_OPERATOIRE_FAMO,Mode opératoire de signalement et d'orientation FAMO (Obj. 3.13),1.14.4,Mode opératoire FAMO · Formulaire FAMO DAC Santé,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
P13_MODE_OPERATOIRE_FAMO,Mode opératoire de signalement et d'orientation FAMO (Obj. 3.13),1.14.5,Mode opératoire FAMO · Formulaire FAMO DAC Santé,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
P13_MODE_OPERATOIRE_FAMO,Mode opératoire de signalement et d'orientation FAMO (Obj. 3.13),1.14.6,Mode opératoire FAMO · Formulaire FAMO DAC Santé,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
P13_MODE_OPERATOIRE_FAMO,Mode opératoire de signalement et d'orientation FAMO (Obj. 3.13),2.5.3,Fiche de tâches · Mode opératoire FAMO,MOYENNE,source : tableau de suivi de la mission pilote
P13_MODE_OPERATOIRE_FAMO,Mode opératoire de signalement et d'orientation FAMO (Obj. 3.13),2.9.1,FORMULAIRE-FAMOORIENTATION-DACSANTE,MOYENNE,le formulaire rempli est nominatif : seul le mode opératoire est un type de document
P13_MODE_OPERATOIRE_FAMO,Mode opératoire de signalement et d'orientation FAMO (Obj. 3.13),3.13.1,MODE-OPERATOIRE TransmissionFAMO,HAUTE,source : tableau de suivi de la mission pilote
P13_MODE_OPERATOIRE_FAMO,Mode opératoire de signalement et d'orientation FAMO (Obj. 3.13),3.13.2,MODE-OPERATOIRE TransmissionFAMO,HAUTE,source : tableau de suivi de la mission pilote
P13_MODE_OPERATOIRE_FAMO,Mode opératoire de signalement et d'orientation FAMO (Obj. 3.13),3.13.3,MODE-OPERATOIRE TransmissionFAMO,HAUTE,source : tableau de suivi de la mission pilote
P13_PROCEDURE,Procédure P2 — Événements indésirables (Obj. 3.13),3.11.2,Procédure P2 (section 8),MOYENNE,source : onglet Critères Impératifs uniquement
P13_PROCEDURE,Procédure P2 — Événements indésirables (Obj. 3.13),3.12.1,Procédure P2 (section 8),BASSE,source : onglet Critères Impératifs uniquement
P13_PROCEDURE,Procédure P2 — Événements indésirables (Obj. 3.13),3.13.1,Procédure P2 — Événements indésirables,HAUTE,confirmé par les deux onglets
P13_PROCEDURE,Procédure P2 — Événements indésirables (Obj. 3.13),3.13.2,Procédure P2 — Événements indésirables,HAUTE,confirmé par les deux onglets
P13_PROCEDURE,Procédure P2 — Événements indésirables (Obj. 3.13),3.13.3,Procédure P2 — Événements indésirables,HAUTE,confirmé par les deux onglets
P13_TABLEAU_SUIVI,Tableau de suivi des EI / EIG (Obj. 3.13),3.12.1,TableauBord CahierAppel Consolide PlaintesEI,MOYENNE,"source : onglet Critères Impératifs uniquement ; type défini pour l'objectif 3.13, utilisé ici hors objectif"
P13_TABLEAU_SUIVI,Tableau de suivi des EI / EIG (Obj. 3.13),3.12.2,TableauBord CahierAppel Consolide PlaintesEI,MOYENNE,"source : onglet Critères Impératifs uniquement ; type défini pour l'objectif 3.13, utilisé ici hors objectif"
P13_TABLEAU_SUIVI,Tableau de suivi des EI / EIG (Obj. 3.13),3.12.3,TableauBord CahierAppel Consolide PlaintesEI,MOYENNE,"source : onglet Critères Impératifs uniquement ; type défini pour l'objectif 3.13, utilisé ici hors objectif"
P13_TABLEAU_SUIVI,Tableau de suivi des EI / EIG (Obj. 3.13),3.13.1,Registre EI/EIG | REGISTRE EI-EIG | REGISTRE EvenementsIndesirables,HAUTE,confirmé par les deux onglets
P13_TABLEAU_SUIVI,Tableau de suivi des EI / EIG (Obj. 3.13),3.13.3,REGISTRE EI-EIG | REGISTRE EvenementsIndesirables,HAUTE,source : onglet Critères Impératifs uniquement
P14_ANNUAIRE_CRISE,Annuaire de crise (Obj. 3.14),2.8.1,Procédure P4 (annuaire de crise),MOYENNE,source : tableau de suivi de la mission pilote
P14_ANNUAIRE_CRISE,Annuaire de crise (Obj. 3.14),2.8.2,Procédure P4 (annuaire de crise),MOYENNE,source : tableau de suivi de la mission pilote
P14_ANNUAIRE_CRISE,Annuaire de crise (Obj. 3.14),2.8.3,Procédure P4 (annuaire de crise),MOYENNE,source : tableau de suivi de la mission pilote
P14_ANNUAIRE_CRISE,Annuaire de crise (Obj. 3.14),3.14.1,Annuaire de crise (contacts à compléter),HAUTE,Guide phase 5 : finalisation de l'annuaire de crise
P14_CR_DIFFUSION,CR de diffusion interne / externe — PCA/PGC (Obj. 3.14),3.13.2,TRAME-PRESENTATION PCA-CVS,BASSE,"trame de présentation du PCA au CVS = support de diffusion, pas le CR ; source : onglet Critères Impératifs uniquement ; type défini pour l'objectif 3.14, utilisé ici hors objectif"
P14_CR_DIFFUSION,CR de diffusion interne / externe — PCA/PGC (Obj. 3.14),3.14.1,TRAME-PRESENTATION PCA-CVS,MOYENNE,"trame de présentation du PCA au CVS = support de diffusion, pas le CR ; source : onglet Critères Impératifs uniquement"
P14_CR_DIFFUSION,CR de diffusion interne / externe — PCA/PGC (Obj. 3.14),3.14.2,TRAME-PRESENTATION PCA-CVS,MOYENNE,"trame de présentation du PCA au CVS = support de diffusion, pas le CR ; source : onglet Critères Impératifs uniquement"
P14_PCA_REDIGE,PCA rédigé (Obj. 3.14),2.8.1,Procédure P4,BASSE,"Procédure P4 couvre PCA et gestion de crise ; doublon possible avec P14_PGC_REDIGE ; type défini pour l'objectif 3.14, utilisé ici hors objectif"
P14_PCA_REDIGE,PCA rédigé (Obj. 3.14),2.8.2,Procédure P4,BASSE,"Procédure P4 couvre PCA et gestion de crise ; doublon possible avec P14_PGC_REDIGE ; type défini pour l'objectif 3.14, utilisé ici hors objectif"
P14_PCA_REDIGE,PCA rédigé (Obj. 3.14),2.8.3,Procédure P4,BASSE,"Procédure P4 couvre PCA et gestion de crise ; doublon possible avec P14_PGC_REDIGE ; type défini pour l'objectif 3.14, utilisé ici hors objectif"
P14_PCA_REDIGE,PCA rédigé (Obj. 3.14),3.14.1,Procédure P4 — PCA / Gestion de crise | PCA GestionCrise-ContinuiteActivite | PROCEDURE GestionCrise-ContinuiteActivite,HAUTE,Procédure P4 couvre PCA et gestion de crise ; doublon possible avec P14_PGC_REDIGE ; confirmé par les deux onglets
P14_PCA_REDIGE,PCA rédigé (Obj. 3.14),3.14.2,Procédure P4 | PCA GestionCrise-ContinuiteActivite | PROCEDURE GestionCrise-ContinuiteActivite,HAUTE,Procédure P4 couvre PCA et gestion de crise ; doublon possible avec P14_PGC_REDIGE ; confirmé par les deux onglets
P14_PGC_REDIGE,Plan de gestion de crise (PGC) rédigé (Obj. 3.14),2.8.1,Procédure P4,MOYENNE,"Procédure P4 — PCA / gestion de crise ; type défini pour l'objectif 3.14, utilisé ici hors objectif"
P14_PGC_REDIGE,Plan de gestion de crise (PGC) rédigé (Obj. 3.14),2.8.2,Procédure P4,MOYENNE,"Procédure P4 — PCA / gestion de crise ; type défini pour l'objectif 3.14, utilisé ici hors objectif"
P14_PGC_REDIGE,Plan de gestion de crise (PGC) rédigé (Obj. 3.14),2.8.3,Procédure P4,MOYENNE,"Procédure P4 — PCA / gestion de crise ; type défini pour l'objectif 3.14, utilisé ici hors objectif"
P14_PGC_REDIGE,Plan de gestion de crise (PGC) rédigé (Obj. 3.14),3.14.1,Procédure P4 — PCA / Gestion de crise | PROCEDURE GestionCrise-ContinuiteActivite,HAUTE,Procédure P4 — PCA / gestion de crise ; confirmé par les deux onglets
P14_PGC_REDIGE,Plan de gestion de crise (PGC) rédigé (Obj. 3.14),3.14.2,Procédure P4 | PROCEDURE GestionCrise-ContinuiteActivite,HAUTE,Procédure P4 — PCA / gestion de crise ; confirmé par les deux onglets
P22_AIPD,Analyse d'impact relative à la protection des données — AIPD (Obj. 2.2),2.2.7,Fiche AIPD-SAD,HAUTE,Guide phase 6 : AIPD rédigée
P22_AIPD,Analyse d'impact relative à la protection des données — AIPD (Obj. 2.2),2.10.2,Fiche AIPD-SAD,HAUTE,Guide phase 6 : AIPD rédigée
P22_CHARTE_INFORMATIQUE,Charte informatique (Obj. 2.2),2.2.7,Gabarit D8 | D8 Charte-Informatique-Confidentialite-RGPD,HAUTE,confirmé par les deux onglets
P22_CHARTE_INFORMATIQUE,Charte informatique (Obj. 2.2),2.10.2,D8 Charte-Informatique-Confidentialite-RGPD,MOYENNE,"type défini pour l'objectif 2.2, utilisé ici hors objectif"
P22_DUI_SECURISE,Preuve de sécurisation du DUI (Obj. 2.2),2.2.7,Gabarit D9 | D9 Tableau-Droits-Acces-DUI,HAUTE,gabarit D9 — tableau des droits d’accès au DUI ; confirmé par les deux onglets
P22_DUI_SECURISE,Preuve de sécurisation du DUI (Obj. 2.2),2.10.1,Gabarit D9 — Tableau des droits d'accès au DUI,MOYENNE,"gabarit D9 — tableau des droits d’accès au DUI ; type défini pour l'objectif 2.2, utilisé ici hors objectif"
P22_DUI_SECURISE,Preuve de sécurisation du DUI (Obj. 2.2),2.10.2,D9 Tableau-Droits-Acces-DUI,MOYENNE,"gabarit D9 — tableau des droits d’accès au DUI ; type défini pour l'objectif 2.2, utilisé ici hors objectif"
P22_EMARGEMENT_SENSIBILISATION,Feuilles d'émargement sensibilisation droits (Obj. 2.2),2.2.3,D10 Feuille-Emargement-Sensibilisation-Droits fondamentaux,HAUTE,source : onglet Critères Impératifs uniquement
P22_EMARGEMENT_SENSIBILISATION,Feuilles d'émargement sensibilisation droits (Obj. 2.2),2.2.6,D10 Feuille-Emargement-Sensibilisation-Droits fondamentaux,HAUTE,
P22_EMARGEMENT_SENSIBILISATION,Feuilles d'émargement sensibilisation droits (Obj. 2.2),3.1.4,D10 Feuille-Emargement-Sensibilisation-Droits fondamentaux,MOYENNE,"type défini pour l'objectif 2.2, utilisé ici hors objectif"
P22_EMARGEMENT_SENSIBILISATION,Feuilles d'émargement sensibilisation droits (Obj. 2.2),3.11.3,D10 Feuille-Emargement-Sensibilisation-Droits fondamentaux,MOYENNE,"type défini pour l'objectif 2.2, utilisé ici hors objectif"
P22_EMARGEMENT_SENSIBILISATION,Feuilles d'émargement sensibilisation droits (Obj. 2.2),3.13.4,D10 Feuille-Emargement-Sensibilisation-Droits fondamentaux,MOYENNE,"type défini pour l'objectif 2.2, utilisé ici hors objectif"
P22_FORMATION_RGPD,Preuve de formation / sensibilisation RGPD (Obj. 2.2),2.10.2,AFFICHE SENSIBILISATION ReglesOrNumerique | AFFICHE SENSIBILISATION ReglesOr-Securite SI,BASSE,"affiche / séance de sensibilisation numérique-sécurité SI ; type défini pour l'objectif 2.2, utilisé ici hors objectif"
P22_FORMATION_RGPD,Preuve de formation / sensibilisation RGPD (Obj. 2.2),3.15.3,AFFICHE SENSIBILISATION ReglesOr-Securite SI | D10-PREREMPLI SeanceSensibilisationNumerique | AFFICHE SENSIBILISATION ReglesOrNumerique,MOYENNE,"affiche / séance de sensibilisation numérique-sécurité SI ; code du critère présent dans le nom du fichier ; type défini pour l'objectif 2.2, utilisé ici hors objectif"
P22_FORMULAIRES_CONSENTEMENT,"Formulaires de consentement — droit à l'image, etc. (Obj. 2.2)",2.2.5,Gabarit D5 — Recueil individuel du droit à l'image | modele consentement droit image mixte | D5 Formulaire-Droit-Image | MODELE ConsentementDroitImage,HAUTE,code du critère présent dans le nom du fichier ; confirmé par les deux onglets
P22_PROCEDURE_RGPD,Procédure P5 — Protection des données / RGPD (Obj. 2.2),2.2.7,Procédure P5 — Protection des données,HAUTE,confirmé par les deux onglets
P22_PROCEDURE_RGPD,Procédure P5 — Protection des données / RGPD (Obj. 2.2),2.10.1,procédure P5 (sécurisation des échanges),MOYENNE,source : tableau de suivi de la mission pilote
P22_PROCEDURE_RGPD,Procédure P5 — Protection des données / RGPD (Obj. 2.2),2.10.2,Procédure P5 — Protection des données,HAUTE,confirmé par les deux onglets
P22_REGISTRE_TRAITEMENTS,Registre des traitements de données (Obj. 2.2),2.2.7,REGISTRE DES ACTIVITÉS DE TRAITEMENT TraitementsRGPD,HAUTE,source : onglet Critères Impératifs uniquement
P22_TABLEAU_DROITS_ACCES_DUI,Tableau des droits d'accès au DUI (Obj. 2.2),2.2.7,Gabarit D9 — Tableau des droits d'accès au DUI,HAUTE,Guide phase 6 : tableau des droits d'accès
P22_TABLEAU_DROITS_ACCES_DUI,Tableau des droits d'accès au DUI (Obj. 2.2),2.10.1,Gabarit D9 — Tableau des droits d'accès au DUI,HAUTE,Guide phase 6 : tableau des droits d'accès
P22_TABLEAU_DROITS_ACCES_DUI,Tableau des droits d'accès au DUI (Obj. 2.2),2.10.2,Gabarit D9 — Tableau des droits d'accès au DUI,HAUTE,Guide phase 6 : tableau des droits d'accès
QUALITE_AFFICHE,Affiche A4 d'information / de sensibilisation,2.10.2,AFFICHE SENSIBILISATION ReglesOrNumerique (3.15.3) | ReglesOr-Securite SI,HAUTE,code du critère présent dans le nom du fichier ou dans l'index
QUALITE_AFFICHE,Affiche A4 d'information / de sensibilisation,3.13.1,AFFICHE-A4 Sensibilisation EvenementsIndesirables,MOYENNE,objectif cité en bloc — à confirmer critère par critère
QUALITE_AFFICHE,Affiche A4 d'information / de sensibilisation,3.13.2,AFFICHE-A4 EvenementsIndesirables | Procédure P2 · Affiche,HAUTE,
QUALITE_AFFICHE,Affiche A4 d'information / de sensibilisation,3.13.3,AFFICHE-A4 Sensibilisation EvenementsIndesirables,MOYENNE,objectif cité en bloc — à confirmer critère par critère
QUALITE_AFFICHE,Affiche A4 d'information / de sensibilisation,3.13.4,AFFICHE-A4 EvenementsIndesirables | Procédure P2 · Affiche,HAUTE,
QUALITE_AFFICHE,Affiche A4 d'information / de sensibilisation,3.15.3,AFFICHE SENSIBILISATION ReglesOrNumerique (3.15.3) | ReglesOr-Securite SI,HAUTE,code du critère présent dans le nom du fichier ou dans l'index
QUALITE_AUTOEVAL_ANTERIEURE,Rapport d'évaluation interne / auto-évaluation antérieure,3.5.2,Auto éval chap 2,MOYENNE,"le xlsx cite une auto-évaluation « blanc » / grille d’auto-éval, pas un rapport antérieur"
QUALITE_AUTOEVAL_ANTERIEURE,Rapport d'évaluation interne / auto-évaluation antérieure,3.10.1,Auto-évaluation « blanc,MOYENNE,"le xlsx cite une auto-évaluation « blanc » / grille d’auto-éval, pas un rapport antérieur"
QUALITE_AUTOEVAL_ANTERIEURE,Rapport d'évaluation interne / auto-évaluation antérieure,3.10.2,Auto-évaluation « blanc,MOYENNE,"le xlsx cite une auto-évaluation « blanc » / grille d’auto-éval, pas un rapport antérieur"
QUALITE_EMARGEMENT_SEANCE,Feuille d'émargement — séance de sensibilisation (modèle),1.14.6,D10-PREREMPLI (par thème),MOYENNE,une feuille par séance : rattacher celle du thème
QUALITE_EMARGEMENT_SEANCE,Feuille d'émargement — séance de sensibilisation (modèle),2.1.3,D10-PREREMPLI (par thème),MOYENNE,une feuille par séance : rattacher celle du thème
QUALITE_EMARGEMENT_SEANCE,Feuille d'émargement — séance de sensibilisation (modèle),2.8.3,D10-PREREMPLI (par thème),MOYENNE,une feuille par séance : rattacher celle du thème
QUALITE_EMARGEMENT_SEANCE,Feuille d'émargement — séance de sensibilisation (modèle),3.1.4,Gabarit D10 | EMARGEMENT-314-4,HAUTE,gabarit d'émargement cité pour le critère
QUALITE_EMARGEMENT_SEANCE,Feuille d'émargement — séance de sensibilisation (modèle),3.5.3,D10-PREREMPLI (par thème),MOYENNE,une feuille par séance : rattacher celle du thème
QUALITE_EMARGEMENT_SEANCE,Feuille d'émargement — séance de sensibilisation (modèle),3.7.3,D10-PREREMPLI (par thème),MOYENNE,une feuille par séance : rattacher celle du thème
QUALITE_EMARGEMENT_SEANCE,Feuille d'émargement — séance de sensibilisation (modèle),3.11.3,Gabarit D10 | EMARGEMENT-314-4,HAUTE,gabarit d'émargement cité pour le critère
QUALITE_EMARGEMENT_SEANCE,Feuille d'émargement — séance de sensibilisation (modèle),3.13.4,Gabarit D10 | EMARGEMENT-314-4,HAUTE,gabarit d'émargement cité pour le critère
QUALITE_EMARGEMENT_SEANCE,Feuille d'émargement — séance de sensibilisation (modèle),3.14.4,Gabarit D10 | EMARGEMENT-314-4,HAUTE,gabarit d'émargement cité pour le critère
QUALITE_EMARGEMENT_SEANCE,Feuille d'émargement — séance de sensibilisation (modèle),3.15.3,D10-PREREMPLI (par thème),MOYENNE,une feuille par séance : rattacher celle du thème
QUALITE_ENQUETES_SATISFACTION,Synthèse des 3 dernières enquêtes de satisfaction,1.1.1,ENQUETE-SATISFACTION PersonneAccompagnee-Proches,HAUTE,"le xlsx cite le questionnaire, le type attend la synthèse des résultats"
QUALITE_ENQUETES_SATISFACTION,Synthèse des 3 dernières enquêtes de satisfaction,2.3.1,enquête de satisfaction personnes accompagnées/proches | ENQUETE-SATISFACTION PersonneAccompagnee-Proches | ENQUETE-SATISFACTION-NUMERIQUE PersonneAccompagnee-Proches,HAUTE,"le xlsx cite le questionnaire, le type attend la synthèse des résultats"
QUALITE_ENQUETE_QUESTIONNAIRE,"Autre forme de participation des usagers",1.1.1,Enquête de satisfaction (support structuré de recueil de l'expression),MOYENNE,source : tableau de suivi de la mission pilote
QUALITE_ENQUETE_QUESTIONNAIRE,"Autre forme de participation des usagers",1.6.1,Enquête de satisfaction (support structuré de recueil de l'expression),MOYENNE,source : tableau de suivi de la mission pilote
QUALITE_ENQUETE_QUESTIONNAIRE,"Autre forme de participation des usagers",1.6.2,Enquête de satisfaction (support structuré de recueil de l'expression),MOYENNE,source : tableau de suivi de la mission pilote
QUALITE_ENQUETE_QUESTIONNAIRE,"Autre forme de participation des usagers",1.6.3,Enquête de satisfaction (support structuré de recueil de l'expression),MOYENNE,source : tableau de suivi de la mission pilote
QUALITE_ENQUETE_QUESTIONNAIRE,"Autre forme de participation des usagers",2.3.1,ENQUETE-SATISFACTION PersonneAccompagnee-Proches,HAUTE,source : tableau de suivi de la mission pilote
QUALITE_ENQUETE_QUESTIONNAIRE,"Autre forme de participation des usagers",3.14.2,Enquête de satisfaction V1.6 — questions 9 à 11 (plan de gestion de crise),MOYENNE,le questionnaire vérifie que le plan a été expliqué aux personnes
QUALITE_FICHE_SENSIBILISATION,Fiche de sensibilisation des professionnels (par thème),1.14.6,FICHE-SENSIBILISATION / SUPPORT-SENSIBILISATION (par thème),MOYENNE,"une fiche par thème : rattacher la fiche du thème, pas toutes"
QUALITE_FICHE_SENSIBILISATION,Fiche de sensibilisation des professionnels (par thème),1.17.2,FICHE-SENSIBILISATION / SUPPORT-SENSIBILISATION (par thème),MOYENNE,"une fiche par thème : rattacher la fiche du thème, pas toutes"
QUALITE_FICHE_SENSIBILISATION,Fiche de sensibilisation des professionnels (par thème),2.1.3,FICHE-SENSIBILISATION / SUPPORT-SENSIBILISATION (par thème),MOYENNE,"une fiche par thème : rattacher la fiche du thème, pas toutes"
QUALITE_FICHE_SENSIBILISATION,Fiche de sensibilisation des professionnels (par thème),2.8.2,FICHE-SENSIBILISATION / SUPPORT-SENSIBILISATION (par thème),MOYENNE,"une fiche par thème : rattacher la fiche du thème, pas toutes"
QUALITE_FICHE_SENSIBILISATION,Fiche de sensibilisation des professionnels (par thème),2.8.3,FICHE-SENSIBILISATION / SUPPORT-SENSIBILISATION (par thème),MOYENNE,"une fiche par thème : rattacher la fiche du thème, pas toutes"
QUALITE_FICHE_SENSIBILISATION,Fiche de sensibilisation des professionnels (par thème),2.9.1,FICHE-SENSIBILISATION / SUPPORT-SENSIBILISATION (par thème),MOYENNE,"une fiche par thème : rattacher la fiche du thème, pas toutes"
QUALITE_FICHE_SENSIBILISATION,Fiche de sensibilisation des professionnels (par thème),2.9.2,FICHE-SENSIBILISATION / SUPPORT-SENSIBILISATION (par thème),MOYENNE,"une fiche par thème : rattacher la fiche du thème, pas toutes"
QUALITE_FICHE_SENSIBILISATION,Fiche de sensibilisation des professionnels (par thème),2.9.3,FICHE-SENSIBILISATION / SUPPORT-SENSIBILISATION (par thème),MOYENNE,"une fiche par thème : rattacher la fiche du thème, pas toutes"
QUALITE_FICHE_SENSIBILISATION,Fiche de sensibilisation des professionnels (par thème),2.10.2,FICHE-SENSIBILISATION / SUPPORT-SENSIBILISATION (par thème),MOYENNE,"une fiche par thème : rattacher la fiche du thème, pas toutes"
QUALITE_FICHE_SENSIBILISATION,Fiche de sensibilisation des professionnels (par thème),3.1.3,FICHE-SENSIBILISATION / SUPPORT-SENSIBILISATION (par thème),MOYENNE,"une fiche par thème : rattacher la fiche du thème, pas toutes"
QUALITE_FICHE_SENSIBILISATION,Fiche de sensibilisation des professionnels (par thème),3.5.3,FICHE-SENSIBILISATION / SUPPORT-SENSIBILISATION (par thème),MOYENNE,"une fiche par thème : rattacher la fiche du thème, pas toutes"
QUALITE_FICHE_SENSIBILISATION,Fiche de sensibilisation des professionnels (par thème),3.6.1,SUPPORT-SENSIBILISATION RisqueMedicamenteux,BASSE,source : tableau de suivi de la mission pilote ; hors périmètre SAD aide selon le manuel (Médico-social | Toutes structures | Tous publics) — applicable SAD mixte
QUALITE_FICHE_SENSIBILISATION,Fiche de sensibilisation des professionnels (par thème),3.6.3,SUPPORT-SENSIBILISATION RisqueMedicamenteux,BASSE,source : tableau de suivi de la mission pilote ; hors périmètre SAD aide selon le manuel (Médico-social | Toutes structures | Tous publics) — applicable SAD mixte
QUALITE_FICHE_SENSIBILISATION,Fiche de sensibilisation des professionnels (par thème),3.6.4,SUPPORT-SENSIBILISATION RisqueMedicamenteux,BASSE,source : tableau de suivi de la mission pilote
QUALITE_FICHE_SENSIBILISATION,Fiche de sensibilisation des professionnels (par thème),3.6.5,SUPPORT-SENSIBILISATION RisqueMedicamenteux,BASSE,source : tableau de suivi de la mission pilote ; hors périmètre SAD aide selon le manuel (Médico-social | Toutes structures | Tous publics) — applicable SAD mixte
QUALITE_FICHE_SENSIBILISATION,Fiche de sensibilisation des professionnels (par thème),3.7.3,FICHE-SENSIBILISATION / SUPPORT-SENSIBILISATION (par thème),MOYENNE,"une fiche par thème : rattacher la fiche du thème, pas toutes"
QUALITE_FICHE_SENSIBILISATION,Fiche de sensibilisation des professionnels (par thème),3.13.1,FICHE-SENSIBILISATION / SUPPORT-SENSIBILISATION (par thème),MOYENNE,"une fiche par thème : rattacher la fiche du thème, pas toutes"
QUALITE_FICHE_SENSIBILISATION,Fiche de sensibilisation des professionnels (par thème),3.13.2,Support de sensibilisation EI | SUPPORT-SENSIBILISATION GestionCrise-314-4,HAUTE,code du critère présent dans le nom du fichier ou dans l'index
QUALITE_FICHE_SENSIBILISATION,Fiche de sensibilisation des professionnels (par thème),3.13.3,FICHE-SENSIBILISATION / SUPPORT-SENSIBILISATION (par thème),MOYENNE,"une fiche par thème : rattacher la fiche du thème, pas toutes"
QUALITE_FICHE_SENSIBILISATION,Fiche de sensibilisation des professionnels (par thème),3.14.4,Support de sensibilisation EI | SUPPORT-SENSIBILISATION GestionCrise-314-4,HAUTE,code du critère présent dans le nom du fichier ou dans l'index
QUALITE_FICHE_SENSIBILISATION,Fiche de sensibilisation des professionnels (par thème),3.15.3,FICHE-SENSIBILISATION / SUPPORT-SENSIBILISATION (par thème),MOYENNE,"une fiche par thème : rattacher la fiche du thème, pas toutes"
QUALITE_GABARIT_CR_REUNION,Compte rendu de réunion — gabarit unique,1.17.4,CRMulticritères PILOTAGE-QUALITE,BASSE,source : tableau de suivi de la mission pilote
QUALITE_GABARIT_CR_REUNION,Compte rendu de réunion — gabarit unique,2.1.1,CR de réunion | CR-PILOTAGE-QUALITE,MOYENNE,Guide §3.3 : un gabarit unique pour tous les comptes rendus
QUALITE_GABARIT_CR_REUNION,Compte rendu de réunion — gabarit unique,2.1.2,CR de réunion | CR-PILOTAGE-QUALITE,MOYENNE,Guide §3.3 : un gabarit unique pour tous les comptes rendus
QUALITE_GABARIT_CR_REUNION,Compte rendu de réunion — gabarit unique,2.10.1,CR de réunion | CR-PILOTAGE-QUALITE,MOYENNE,Guide §3.3 : un gabarit unique pour tous les comptes rendus
QUALITE_PCA_PLAN_BLEU,Plan bleu / PCA (continuité d'activité),3.14.1,PCA GestionCrise-ContinuiteActivite | PROCEDURE GestionCrise-ContinuiteActivite,MOYENNE,doublon de type avec P14_PCA_REDIGE (réclamé vs produit) ; source : onglet Critères Impératifs uniquement
QUALITE_PCA_PLAN_BLEU,Plan bleu / PCA (continuité d'activité),3.14.2,PCA GestionCrise-ContinuiteActivite | PROCEDURE GestionCrise-ContinuiteActivite,MOYENNE,doublon de type avec P14_PCA_REDIGE (réclamé vs produit) ; source : onglet Critères Impératifs uniquement
QUALITE_POLITIQUE_INDEX,Politique qualité + index référentiel des procédures,3.10.1,Politique qualité associative,HAUTE,
QUALITE_POLITIQUE_INDEX,Politique qualité + index référentiel des procédures,3.10.2,Politique qualité associative,HAUTE,
QUALITE_PROCEDURE_EI_PLAINTES,Procédure traitement EI / réclamations / signalements maltraitance et violence,2.2.6,PROCEDURE P1 PlaintesReclamations,HAUTE,Procédure P1 (plaintes) — pas de type dédié P12_PROCEDURE ; confirmé par les deux onglets
QUALITE_PROCEDURE_EI_PLAINTES,Procédure traitement EI / réclamations / signalements maltraitance et violence,3.11.1,Procédure P3 — Prévention de la maltraitance | PROCEDURE PreventionMaltraitance,MOYENNE,Procédure P3 (prévention maltraitance) — se recoupe avec P11_PLAN_PREVENTION ; confirmé par les deux onglets
QUALITE_PROCEDURE_EI_PLAINTES,Procédure traitement EI / réclamations / signalements maltraitance et violence,3.11.2,Procédure P3 | PROCEDURE EvenementsIndesirables | PROCEDURE P3 PreventionMaltraitance,HAUTE,Procédure P3 (prévention maltraitance) — se recoupe avec P11_PLAN_PREVENTION ; Procédure P2 (EI/EIG) — pas de type dédié P13_PROCEDURE ; confirmé par les deux onglets
QUALITE_PROCEDURE_EI_PLAINTES,Procédure traitement EI / réclamations / signalements maltraitance et violence,3.11.3,PROCEDURE PreventionMaltraitance,MOYENNE,Procédure P3 (prévention maltraitance) — se recoupe avec P11_PLAN_PREVENTION
QUALITE_PROCEDURE_EI_PLAINTES,Procédure traitement EI / réclamations / signalements maltraitance et violence,3.12.1,Procédure P1 — Plaintes et réclamations | PROCEDURE P1 PlaintesReclamations,HAUTE,Procédure P1 (plaintes) — pas de type dédié P12_PROCEDURE ; confirmé par les deux onglets
QUALITE_PROCEDURE_EI_PLAINTES,Procédure traitement EI / réclamations / signalements maltraitance et violence,3.12.2,Procédure P1 | PROCEDURE P1 PlaintesReclamations,HAUTE,Procédure P1 (plaintes) — pas de type dédié P12_PROCEDURE ; confirmé par les deux onglets
QUALITE_PROCEDURE_EI_PLAINTES,Procédure traitement EI / réclamations / signalements maltraitance et violence,3.12.3,Procédure P1 | PROCEDURE PlaintesReclamations,HAUTE,Procédure P1 (plaintes) — pas de type dédié P12_PROCEDURE ; confirmé par les deux onglets
QUALITE_PROCEDURE_EI_PLAINTES,Procédure traitement EI / réclamations / signalements maltraitance et violence,3.13.1,Procédure P2 — Événements indésirables | PROCEDURE EvenementsIndesirables,HAUTE,Procédure P2 (EI/EIG) — pas de type dédié P13_PROCEDURE ; confirmé par les deux onglets
QUALITE_PROCEDURE_EI_PLAINTES,Procédure traitement EI / réclamations / signalements maltraitance et violence,3.13.2,Procédure P2 | PROCEDURE EvenementsIndesirables,HAUTE,Procédure P2 (EI/EIG) — pas de type dédié P13_PROCEDURE ; confirmé par les deux onglets
QUALITE_PROCEDURE_EI_PLAINTES,Procédure traitement EI / réclamations / signalements maltraitance et violence,3.13.3,Procédure P2 | PROCEDURE EvenementsIndesirables,HAUTE,Procédure P2 (EI/EIG) — pas de type dédié P13_PROCEDURE ; confirmé par les deux onglets
QUALITE_PROCEDURE_EI_PLAINTES,Procédure traitement EI / réclamations / signalements maltraitance et violence,3.13.4,PROCEDURE EvenementsIndesirables,HAUTE,Procédure P2 (EI/EIG) — pas de type dédié P13_PROCEDURE
RH_DUERP,"DUERP — Document Unique d'Évaluation des Risques Professionnels (exigence Code du Travail, hors périmètre HAS)",1.14.6,DUERP,MOYENNE,le type est libellé « hors périmètre HAS » alors que le xlsx l’utilise comme preuve HAS
RH_DUERP,"DUERP — Document Unique d'Évaluation des Risques Professionnels (exigence Code du Travail, hors périmètre HAS)",3.7.1,DUERP,MOYENNE,le type est libellé « hors périmètre HAS » alors que le xlsx l’utilise comme preuve HAS
RH_DUERP,"DUERP — Document Unique d'Évaluation des Risques Professionnels (exigence Code du Travail, hors périmètre HAS)",3.7.2,DUERP,MOYENNE,le type est libellé « hors périmètre HAS » alors que le xlsx l’utilise comme preuve HAS
RH_DUERP,"DUERP — Document Unique d'Évaluation des Risques Professionnels (exigence Code du Travail, hors périmètre HAS)",3.7.3,DUERP,MOYENNE,le type est libellé « hors périmètre HAS » alors que le xlsx l’utilise comme preuve HAS
RH_LIVRET_SALARIE,Livret d'accueil du salarié,2.2.4,LIVRET-ACCUEIL-SALARIES | LIVRET-ACCUEIL-SALARIES A6-Livret,HAUTE,source : onglet Critères Impératifs uniquement
RH_LIVRET_SALARIE,Livret d'accueil du salarié,2.3.1,Livret d'accueil salarié | LIVRETACCUEILSALARIES | LIVRETACCUEILSALARIESavec notes,HAUTE,
RH_LIVRET_SALARIE,Livret d'accueil du salarié,2.3.2,Livret d'accueil salarié | LIVRETACCUEILSALARIESavec notes | LIVRETACCUEILSALARIES,HAUTE,
RH_LIVRET_SALARIE,Livret d'accueil du salarié,2.10.1,"Le DUI centralise les informations, avec un accès différencié selon la fonction .",HAUTE,
RH_LIVRET_SALARIE,Livret d'accueil du salarié,3.1.3,LIVRETACCUEILSALARIESavec notes,HAUTE,
RH_LIVRET_SALARIE,Livret d'accueil du salarié,3.8.1,Livret d'accueil salarié,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
RH_LIVRET_SALARIE,Livret d'accueil du salarié,3.8.2,Livret d'accueil salarié,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
RH_LIVRET_SALARIE,Livret d'accueil du salarié,3.8.3,Livret d'accueil salarié,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
RH_LIVRET_SALARIE,Livret d'accueil du salarié,3.8.4,Livret d'accueil salarié,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
RH_LIVRET_SALARIE,Livret d'accueil du salarié,3.8.5,Livret d'accueil salarié,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
RH_LIVRET_SALARIE,Livret d'accueil du salarié,3.8.6,Livret d'accueil salarié,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
RH_PLAN_FORMATION,Plan de formation / programme de sensibilisation,3.1.4,PLANFORMATION | PROGRAMMESENSIBILISATION,HAUTE,
RH_PLAN_FORMATION,Plan de formation / programme de sensibilisation,3.11.3,PLANFORMATION | PROGRAMMESENSIBILISATION,HAUTE,
RH_REGLEMENT_INTERIEUR,Règlement intérieur (droit du travail — distinct du règlement de fonctionnement),2.2.3,Règlement intérieur,MOYENNE,source : tableau de suivi de la mission pilote
RH_REGLEMENT_INTERIEUR,Règlement intérieur (droit du travail — distinct du règlement de fonctionnement),2.2.4,Règlement intérieur,HAUTE,source : onglet Critères Impératifs (ajout effectué)
RH_REGLEMENT_INTERIEUR,Règlement intérieur (droit du travail — distinct du règlement de fonctionnement),2.2.5,Règlement intérieur,HAUTE,source : onglet Critères Impératifs (ajout effectué)
RH_REGLEMENT_INTERIEUR,Règlement intérieur (droit du travail — distinct du règlement de fonctionnement),2.2.6,Règlement intérieur,MOYENNE,source : tableau de suivi de la mission pilote
RH_REGLEMENT_INTERIEUR,Règlement intérieur (droit du travail — distinct du règlement de fonctionnement),2.8.2,Règlement intérieur,MOYENNE,source : tableau de suivi de la mission pilote
RH_REGLEMENT_INTERIEUR,Règlement intérieur (droit du travail — distinct du règlement de fonctionnement),3.8.1,Règlement intérieur,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
RH_REGLEMENT_INTERIEUR,Règlement intérieur (droit du travail — distinct du règlement de fonctionnement),3.8.2,Règlement intérieur,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
RH_REGLEMENT_INTERIEUR,Règlement intérieur (droit du travail — distinct du règlement de fonctionnement),3.8.3,Règlement intérieur,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
RH_REGLEMENT_INTERIEUR,Règlement intérieur (droit du travail — distinct du règlement de fonctionnement),3.8.4,Règlement intérieur,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
RH_REGLEMENT_INTERIEUR,Règlement intérieur (droit du travail — distinct du règlement de fonctionnement),3.8.5,Règlement intérieur,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
RH_REGLEMENT_INTERIEUR,Règlement intérieur (droit du travail — distinct du règlement de fonctionnement),3.8.6,Règlement intérieur,MOYENNE,libellé recopié à l'identique sur tout l'objectif — à confirmer critère par critère
`;
