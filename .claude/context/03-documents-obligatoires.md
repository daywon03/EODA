# Documents obligatoires — checklist de référence

> Ceci est l'**input métier direct** du Module 1 (Analyse documentaire). C'est la liste
> contre laquelle un document uploadé doit être catégorisé, et contre laquelle l'absence
> d'un document doit être détectée. Source : `20260621_GABARIT_VIERGE_Bordereau-Demande-
> Documentaire_v01_Externe.docx`, croisé avec `EODA_Procédures_ESSMS.pdf` et le manuel HAS.

## Catégorie 1 — Documents loi 2002-2 (obligatoires, tous ESSMS)

> La loi du 2 janvier 2002 impose **7 outils** garantissant les droits individuels des
> personnes accompagnées. C'est la catégorie la plus structurante du module 1.

| # | Document | Code interne | Notes de détection |
|---|---|---|---|
| 1 | Projet d'établissement / Projet de service | `L2002_PROJET_SERVICE` | Doit dater de moins de 5 ans en théorie, vérifier date de révision |
| 2 | Charte des droits et libertés de la personne accueillie | `L2002_CHARTE_DROITS` | Document national type, vérifier juste la présence/affichage |
| 3 | Livret d'accueil | `L2002_LIVRET_ACCUEIL` | Vérifier présence des mentions obligatoires (cf. critère 1.2.x) |
| 4 | Compte-rendu CVS (ou autre forme de participation des usagers) | `L2002_CR_CVS` | Demander les 2-3 derniers CR, pas un seul |
| 5 | DIPC / Contrat de séjour | `L2002_DIPC` | Vérifier présence signature personne + date révision (annuelle attendue, cf. critère 1.10.6) |
| 6 | Règlement de fonctionnement | `L2002_REGLEMENT_FONCTIONNEMENT` | Vérifier cohérence avec le règlement intérieur s'il existe en doublon |
| 7 | Liste des personnes qualifiées (préfet / président CD) | `L2002_PERSONNES_QUALIFIEES` | Souvent absent ou périmé — point de vigilance fréquent |

## Catégorie 2 — Fonctionnement de la structure

| # | Document | Code interne |
|---|---|---|
| 1 | Organigramme | `FONCT_ORGANIGRAMME` |
| 2 | Plaquette / supports d'information sur l'offre de service | `FONCT_PLAQUETTE` |
| 3 | 3 derniers rapports d'activité annuels | `FONCT_RAPPORTS_ACTIVITE` |
| 4 | CPOM (si concerné) | `FONCT_CPOM` |
| 5 | 3 derniers CR de commissions (animation, restauration...) | `FONCT_CR_COMMISSIONS` |
| 6 | Planning d'animation des 3 derniers mois (si concerné) | `FONCT_PLANNING_ANIMATION` |
| 7 | Liste des partenaires mobilisables | `FONCT_LISTE_PARTENAIRES` |
| 8 | Support d'information sur les directives anticipées (si concerné) | `FONCT_DIRECTIVES_ANTICIPEES` |

## Catégorie 3 — Démarche qualité et gestion des risques

> Cette catégorie est directement liée aux **critères impératifs du Chapitre 3** —
> c'est la zone de plus forte valeur ajoutée pour le module d'analyse, car c'est là que
> se concentrent les obligations réglementaires les plus lourdes (formulaire critère
> impératif + plan d'actions si non satisfait).

| # | Document | Code interne | Lien critère(s) impératif(s) |
|---|---|---|---|
| 1 | Rapport d'évaluation interne / auto-évaluation antérieure | `QUALITE_AUTOEVAL_ANTERIEURE` | — |
| 2 | Synthèse des 3 dernières enquêtes de satisfaction | `QUALITE_ENQUETES_SATISFACTION` | 2.2.6 |
| 3 | Plan bleu / PCA (continuité d'activité) | `QUALITE_PCA_PLAN_BLEU` | **3.14.1, 3.14.2** |
| 4 | Politique qualité + index référentiel des procédures | `QUALITE_POLITIQUE_INDEX` | 3.10.1, 3.10.2 |
| 5 | Procédure traitement EI / réclamations / signalements maltraitance | `QUALITE_PROCEDURE_EI_PLAINTES` | **3.11.1, 3.11.2, 3.12.1-3, 3.13.1-3** |

### Sous-checklist détaillée — Plaintes & réclamations (Objectif 3.12, impératif)

| Document | Code interne |
|---|---|
| Registre des plaintes/réclamations | `P12_REGISTRE` |
| Accusés de réception type | `P12_AR_TYPE` |
| Modèle de réponse finale | `P12_REPONSE_FINALE` |
| CR de réunion d'analyse en équipe | `P12_CR_ANALYSE_EQUIPE` |
| Bilan annuel d'activité qualité (volet plaintes) | `P12_BILAN_ANNUEL` |

### Sous-checklist détaillée — EI / EIG (Objectif 3.13, impératif)

| Document | Code interne |
|---|---|
| Fiche de déclaration EI type | `P13_FICHE_DECLARATION` |
| Tableau de suivi des EI/EIG | `P13_TABLEAU_SUIVI` |
| CR de RETEX / CREX | `P13_CR_RETEX` |
| Preuve de signalement ARS si EIG | `P13_SIGNALEMENT_ARS` |

### Sous-checklist détaillée — Maltraitance (Objectif 3.11, impératif)

| Document | Code interne |
|---|---|
| Cartographie des risques de maltraitance | `P11_CARTOGRAPHIE_RISQUES` |
| Plan de prévention maltraitance | `P11_PLAN_PREVENTION` |
| CR de sensibilisation des équipes | `P11_CR_SENSIBILISATION` |
| Traçabilité des signalements traités | `P11_SIGNALEMENTS_TRACES` |

### Sous-checklist détaillée — Continuité / gestion de crise (Objectif 3.14, impératif)

| Document | Code interne |
|---|---|
| Plan de gestion de crise (PGC) rédigé | `P14_PGC_REDIGE` |
| PCA rédigé | `P14_PCA_REDIGE` |
| CR de diffusion interne/externe | `P14_CR_DIFFUSION` |
| Preuve de simulation / exercice | `P14_PREUVE_SIMULATION` |
| Date de dernière révision | `P14_DATE_REVISION` |

### Sous-checklist détaillée — Droits & confidentialité (Objectif 2.2, impératif)

| Document | Code interne |
|---|---|
| Formulaires de consentement (droit à l'image, etc.) | `P22_FORMULAIRES_CONSENTEMENT` |
| Preuve de sécurisation du DUI | `P22_DUI_SECURISE` |
| Preuve de formation/sensibilisation RGPD | `P22_FORMATION_RGPD` |
| Registre des traitements de données | `P22_REGISTRE_TRAITEMENTS` |
| Charte informatique | `P22_CHARTE_INFORMATIQUE` |
| Feuilles d'émargement sensibilisation droits | `P22_EMARGEMENT_SENSIBILISATION` |

## Catégorie 4 — Ressources humaines

| # | Document | Code interne |
|---|---|---|
| 1 | Livret d'accueil du salarié | `RH_LIVRET_SALARIE` |
| 2 | Plan de formation / programme de sensibilisation | `RH_PLAN_FORMATION` |
| 3 | DUERP (Document Unique d'Évaluation des Risques Professionnels) | `RH_DUERP` |

⚠️ Le DUERP est une obligation **Code du Travail**, pas un critère du référentiel qualité
HAS — ne pas le faire apparaître comme "exigence HAS" dans l'UI mais bien comme "exigence
réglementaire RH complémentaire" pour éviter toute confusion avec les critères 2.2.x
(droits des personnes accompagnées, eux bien dans le périmètre HAS).

## Statuts possibles d'un document dans le système (Module 1 + 2)

| Statut | Code | Déclencheur |
|---|---|---|
| Manquant | `MISSING` | Aucun fichier déposé pour ce code de document attendu |
| Déposé | `UPLOADED` | Fichier déposé, pas encore analysé |
| En cours d'analyse | `ANALYZING` | Job d'analyse LLM en cours |
| Incomplet | `INCOMPLETE` | Analysé, des éléments attendus manquent dans le contenu |
| Conforme | `COMPLIANT` | Analysé, contenu jugé conforme aux attendus |
| Périmé | `EXPIRED` | Date de révision dépassée par rapport à la fréquence attendue (ex : CR CVS, enquêtes satisfaction) |
| Non applicable | `NOT_APPLICABLE` | Document marqué "si concerné" et non pertinent pour cet établissement |

## Référentiel documentaire EODA en cours (septembre 2026) — à intégrer une fois validé

> Séances du 20, 22 et 25/09/2026. **Non validé** : ne pas le coder avant la validation.

- Un référentiel de **~39 à 41 documents** destinés aux SAD est en cours de création par
  Sandrine : procédures (« P ») et documents (« D ») — émargements, fiches de
  sensibilisation, comptes rendus. Les procédures sont en validation chez Sonia (côté
  client) ; la liste finale en dépend.
- **Trois paliers de service** évoqués lors de la démo du 22/09 : palier 1 = les 7 documents
  loi 2002-2 + rapport de conformité + plan d'action, la structure se débrouille ;
  palier 2 = accompagnement partiel ; palier 3 = EODA gère les ~41 documents jusqu'à
  l'évaluation. (À rapprocher de la vision SaaS + cabinet, `09-vision-produit.md` §4.)
- Un critère HAS demande **3 à 7 preuves** (document, formation, émargement, quiz,
  procédure, preuve d'application) ; un document couvre **2 à 10 critères**. La relation
  many-to-many ci-dessous doit donc accepter des preuves qui ne sont pas des documents.

### Périodicités à suivre (alertes à programmer, cadence à confirmer)

| Document | Périodicité évoquée | Source |
|---|---|---|
| DIPC | révision annuelle | critère 1.10.6, séances de septembre |
| Projet de service | tous les 5 ans | séances de septembre |
| Documents de suivi signés par la personne | une fois par an | réunion du 25/09 |
| Questions sensibles de l'évaluation des besoins (maltraitance, abus financier…) | à reposer chaque année | séance du 22/09 |
| Quiz de sensibilisation des équipes | retest tous les 6 mois | démo du 22/09 |

La règle « les relances sont un geste, pas un automate » (CLAUDE.md) tient toujours : ces
périodicités alimentent un **échéancier visible** et un rappel annuel doux au client ; elles
ne déclenchent aucun envoi automatique tant que la cadence n'est pas décidée.

### Règles de rédaction retenues avec le client pilote (22/09/2026)

- Documents courts : « 2 lignes, pas 20 » ; ne pas répéter dans le corps ce que porte déjà le
  tableau de référence (référence, version, date).
- Champ « Responsable » : remplacé par une mention générique (« disponible sur demande ») —
  une personne nommée finit par partir. **Seuls le référent qualité et le DPO sont nommés.**
- Lieu de conservation (RGPD) : formulation volontairement large — « accessible à l'accueil /
  au siège social ».
- Annexe transverse **« Qui contacter ? »** (fatigue de l'aidant, conflit familial,
  suspicion de maltraitance, numéro d'astreinte, aides financières), en schéma lisible,
  insérable dans le livret d'accueil, le livret salarié, le DIPC et le règlement.
- Un seul document fait foi : deux versions divergentes d'un même document (poste local /
  partage) sont à fusionner — c'est exactement ce que le versioning de la plateforme évite.

## Principe de mapping document → critère(s) HAS

Chaque document attendu doit être rattaché en base à **un ou plusieurs critères HAS**
(relation many-to-many — voir `specs/02-architecture-technique.md` §schéma BDD, table
`document_type_criterion`). C'est ce qui permet, dans le module 3 (auto-évaluation), de
proposer automatiquement les pièces déjà déposées comme "preuves disponibles" pour un
critère en cours de cotation — pont direct entre Module 1/2 et Module 3, sans dupliquer
la donnée.
