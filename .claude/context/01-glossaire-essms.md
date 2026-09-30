# Glossaire métier ESSMS / HAS / SAD

> Référence terminologique. À consulter dès qu'un terme métier apparaît dans une spec,
> un nom de modèle de données, ou une UI. Ne pas deviner — ce glossaire fait foi.

## Structures et statuts

| Terme | Définition |
|---|---|
| **ESSMS** | Établissement ou Service Social ou Médico-Social. Catégorie générique réglementaire qui regroupe EHPAD, SAD, foyers, ESAT, etc. |
| **SAD** | Service Autonomie à Domicile. Type d'ESSMS cible d'EODA — intervient au domicile des personnes âgées et/ou en situation de handicap. Issu de la fusion SAAD/SSIAD (réforme 2022). |
| **SAD Aide** | SAD qui ne réalise que des prestations d'aide à domicile (pas de soins). 16 critères impératifs. |
| **SAD Mixte** | SAD qui réalise aide **et** soins infirmiers à domicile. 17 critères impératifs (inclut 3.6.2 — sécurisation circuit médicamenteux). |
| **FINESS** | Numéro d'identification national des établissements sanitaires et sociaux. |
| **ARS** | Agence Régionale de Santé. |
| **ATC** | Autorité de Tarification et de Contrôle (Conseil départemental, ARS selon le cas) — destinataire du rapport d'évaluation et des plans d'action obligatoires. |

## Le dispositif d'évaluation HAS

| Terme | Définition |
|---|---|
| **HAS** | Haute Autorité de Santé — pilote le dispositif national d'évaluation de la qualité des ESSMS depuis 2022 (succède à l'ANESM). |
| **Manuel d'évaluation** | Référentiel officiel HAS. Version en vigueur : **juillet 2025**. Structure le dispositif en 3 chapitres, 8 thématiques, ~42 objectifs, **157 critères**. |
| **Synaé** | Plateforme numérique officielle HAS sur laquelle se déroule l'auto-évaluation puis l'évaluation externe. Les "grilles Synaé" sont les questionnaires structurés du manuel, opérationnalisés. |
| **Organisme évaluateur** | Structure accréditée (COFRAC) qui réalise l'évaluation externe. **Doit être indépendante** — ne peut pas avoir été conseil de l'ESSMS sur le même cycle. EODA n'est PAS un organisme évaluateur ; EODA prépare le client en amont. |
| **Cycle d'évaluation** | **Une évaluation tous les 5 ans** (7 ans auparavant), soit 3 évaluations sur 15 ans — [HAS](https://www.has-sante.fr/jcms/c_2838131/fr/comprendre-la-nouvelle-evaluation-des-essms). |
| **Qualiscope** | Site public de la HAS qui publie les résultats d'évaluation (depuis le 16/09/2025, open data depuis le 28/01/2026). Lettre A/B/C/D calculée en aval — jamais une unité de saisie. |
| **E.E.** | Élément(s) d'Évaluation. Unité la plus fine du référentiel — c'est ce qui est concrètement coté (1 à 4, ★, NC, RI). Un critère regroupe plusieurs E.E. |
| **Critère** | Regroupement d'E.E. autour d'une même exigence (ex : 2.2.7). Sa cotation découle de la moyenne de ses E.E. |
| **Objectif** | Regroupement de critères (ex : Objectif 2.2). |
| **Thématique** | Regroupement d'objectifs (ex : "Droits de la personne accompagnée"). 8 thématiques au total. |
| **Chapitre** | Les 3 grandes parties du dispositif : **Chapitre 1** (la personne / accompagné traceur), **Chapitre 2** (les professionnels / traceur ciblé), **Chapitre 3** (l'ESSMS / audit système). |

## Système de cotation (⚠️ section critique — voir aussi `02-referentiel-has.md`)

| Code | Signification | Compte dans le score ? |
|---|---|---|
| **1** | Pas du tout satisfaisant | Oui |
| **2** | Plutôt pas satisfaisant | Oui |
| **3** | Plutôt satisfaisant | Oui |
| **4** | Tout à fait satisfaisant | Oui |
| **★** | Optimisé (au-delà des attendus) | Oui — compté comme **4** |
| **NC** | Non concerné | **Non** — exclu du calcul. **Interdit sur les critères impératifs.** |
| **RI** | Réponse inadaptée (la personne accompagnée ne donne pas de réponse exploitable) | **Non** — exclu du calcul. **Uniquement Chapitre 1.** |

❌ **Le système Qualiscope (A/B/C/D)** est un système d'affichage **public agrégé** des
résultats finaux (note de 0 à 100 + lettre), calculé par la HAS à partir des cotations 1-4.
Ce n'est PAS le système de cotation des critères. Ne jamais utiliser A/B/C/D pour coter un
critère ou un E.E. dans l'outil d'auto-évaluation.

| Terme | Définition |
|---|---|
| **Critère impératif** | Sous-ensemble de 16 à 18 critères (selon type d'ESSMS) considérés comme devant être pleinement maîtrisés (cotation 4 visée). Si non satisfait (cotation < 4), obligation réglementaire de produire un **formulaire critère impératif** + plan d'actions transmis à l'ATC. |
| **Critère standard** | Tous les autres critères (139 sur 157). NC possible si dûment justifié. |
| **Formulaire critère impératif** | Document généré (sur Synaé officiellement) dès qu'un critère impératif est coté 1, 2 ou 3 — justification individualisée obligatoire. |
| **PDCA** | Plan-Do-Check-Act — cycle d'amélioration continue, structure la démarche qualité de l'ESSMS (Objectif 3.10 du référentiel). |
| **Accompagné traceur** | Méthode du Chapitre 1 : suivre le parcours d'une personne accompagnée via entretien direct avec elle/son entourage. |
| **Traceur ciblé** | Méthode du Chapitre 2 : entretiens avec les professionnels sur des thématiques ciblées. |
| **Audit système** | Méthode du Chapitre 3 : entretiens avec la gouvernance/direction sur l'organisation. |
| **Pré-rapport / Rapport d'évaluation** | Livrables de l'organisme évaluateur. L'ESSMS peut formuler des observations sur le pré-rapport avant rapport final. |
| **Plan d'action(s)** | Document obligatoire dès qu'un critère impératif n'est pas à 4 — transmis à l'ATC avec le rapport. |

## Droits, gestion des risques et outils qualité

| Terme | Définition |
|---|---|
| **Loi 2002-2** | Loi du 2 janvier 2002 rénovant l'action sociale et médico-sociale — impose **7 outils obligatoires** garantissant les droits des personnes accompagnées (voir `03-documents-obligatoires.md`). |
| **DIPC** | Document Individuel de Prise en Charge (ou contrat de séjour selon le type de structure) — un des 7 outils loi 2002-2. Écrit aussi **DIPEC** / **DPEC** chez certains clients (même document). Remis au plus tard **15 jours** après le début de l'accompagnement ; élaboré avec la personne **ou son représentant légal**. Une fois signé, c'est une pièce nominative → **donnée de santé** au sens HDS (voir `09-vision-produit.md` §8). |
| **PAP** | Projet d'Accompagnement Personnalisé — synonyme usuel du PP côté domicile. Pièce nominative. |
| **FAMO** | Fiche d'Analyse Multifactorielle — outil départemental de signalement des situations graves (après analyse interne par le SAD, jamais en premier contact). Remplie sur le portail, pas sur papier. |
| **DAC** | Dispositif d'Appui à la Coordination — destinataire des signalements (DAC Nord / DAC Sud en Seine-Saint-Denis). |
| **AIPD** | Analyse d'Impact relative à la Protection des Données — **systématique** pour l'accompagnement social et médico-social (référentiel CNIL). |
| **DPO** | Délégué à la protection des données. Avec le référent qualité, seul rôle nommé nommément dans les documents remis aux personnes (séance du 22/09) ; les autres responsables sont désignés de façon générique. |
| **HDS** | Hébergeur de Données de Santé — certification obligatoire (CSP L1111-8) pour héberger des données de santé issues d'un suivi social ou médico-social. |
| **AVS / ADVF** | Auxiliaire de vie sociale / Assistant·e de vie aux familles — les professionnels de terrain du SAD, public de l'espace équipe (quiz, fiches). |
| **CVS** | Conseil de la Vie Sociale — instance de participation des usagers, un des 7 outils loi 2002-2. |
| **DUI** | Dossier de l'Usager Informatisé — dossier individuel de la personne accompagnée, accès réglementé (RGPD, secret professionnel). |
| **PP** | Projet Personnalisé — projet d'accompagnement individuel coconstruit avec la personne (Chapitre 1, objectif 1.10). |
| **RBPP** | Recommandations de Bonnes Pratiques Professionnelles (publiées par la HAS, ex-ANESM). |
| **EI / EIG** | Événement Indésirable / Événement Indésirable Grave. Tout incident impactant ou pouvant impacter une personne accompagnée. Les EIG doivent être signalés à l'ARS. Objectif 3.13 (critères impératifs). |
| **CREX** | Comité de Retour d'EXpérience — analyse en équipe des événements indésirables. |
| **ALARM** | Méthode/grille d'analyse causale des événements indésirables (grille ALARM). |
| **Plainte / Réclamation** | Objectif 3.12 (critères impératifs) — dispositif de recueil, traitement, communication, analyse en équipe obligatoire. |
| **PCA / Plan bleu** | Plan de Continuité d'Activité / Plan de gestion de crise — Objectif 3.14 (critères impératifs). |
| **DUERP** | Document Unique d'Évaluation des Risques Professionnels — obligation Code du Travail, **distinct** du référentiel qualité HAS (DUERP = risques pour les salariés ; critères 2.2.x HAS = droits des personnes accompagnées). Ne jamais confondre les deux dans la modélisation. |
| **QVCT** | Qualité de Vie et Conditions de Travail. |
| **FALC** | Facile à Lire et à Comprendre — règles européennes « L'information pour tous » (Inclusion Europe / Unapei). **Exigence produit** pour le portail client et l'espace équipe depuis le 30/09/2026 (voir `04-charte-eoda.md` §7). |
| **CAA** | Communication Alternative et Améliorée — pour les personnes ne verbalisant pas. |
| **SERAFIN-PH** | Nomenclature nationale des besoins/prestations pour le secteur du handicap (référence transversale, hors périmètre direct HAS mais peut apparaître dans les diagnostics). |

## EODA — vocabulaire interne

| Terme | Définition |
|---|---|
| **PLAC** | Plan d'Accompagnement à l'auto-évaluation — livrable EODA structurant la mission client en 4 phases (Fondations, Déploiement, Consolidation, Préparation finale). |
| **Bordereau de demande documentaire** | Gabarit EODA listant les pièces attendues par catégorie, avec colonnes demandé/reçu/date — **input direct du module Analyse documentaire**. |
| **Cadrage** | Phase de démarrage de mission (réunion de cadrage, recueil documentaire, planning de visite, lettre aux parties prenantes). |
| **Bêta-test** | Statut du client ASSAD BENOIT — reçoit l'offre Excellence gratuitement en échange de retours produit. |
| **Portail EODA (abonnement)** | Depuis le 30/09/2026, le produit principal : socle SaaS payé par la structure. Paliers proposés « Autonomie » et « Accompagné » — **propositions**, voir `09-vision-produit.md` §4. |
| **Accompagnement** | Les offres Essentiel / Performance / Excellence et les prestations à la carte, vendues **en supplément** du portail. |
| **Espace équipe** | Partie de la plateforme destinée aux AVS / ADVF (quiz par QR code, fiches, signature sur tablette). Lot B / C. |
| **Proposition à vérifier** | Nom donné à l'écran à toute sortie automatique (analyse, rattachement à un critère, cotation suggérée). Jamais « IA ». |
| **Gabarit : V0 vierge / V finale** | Les deux états retenus le 20/09/2026 pour un gabarit EODA côté client (l'état intermédiaire a été jugé redondant). |
