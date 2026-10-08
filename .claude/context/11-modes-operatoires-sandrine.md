# Modes opératoires de Sandrine — transcription intégrale

> **Provenance** — transcription fidèle de deux documents Word rédigés par Sandrine Regina
> (EODA Conseil), déposés dans `context2/` :
>
> | Fichier source | Titre interne | Version / date | Métadonnées Word |
> |---|---|---|---|
> | `Mode Opératoire Analyse Documentaire.docx` | « MODE OPERATION VERIFICATION DOCUMENTAIRE » | v01 — 19/07/2026 — Procédure, usage interne EODA | auteur Sandrine REGINA, créé/modifié le 19/07/2026 |
> | `Guide EODA Mode Opératoire.docx` | « MODE OPÉRATOIRE EODA — Accompagnement qualité HAS — ASSAD BENOIT » | Version 02 — 19 juillet 2026 | auteur Sandrine REGINA, 63 révisions, 4 commentaires ouverts |
>
> **Ce fichier fait foi pour les prompts d'analyse et de mise en conformité** : l'IA de la
> plateforme suit ces deux modes opératoires **à la lettre**. En cas de contradiction avec
> `10-regles-mise-en-conformite.md` (règles dites en séance), le mode opératoire écrit
> l'emporte et la contradiction est signalée à Damon (CLAUDE.md §7).
>
> **Données nominatives retirées** : les noms des salariés de la structure cliente ont été
> remplacés par `[nom]` (la fonction est conservée). Aucun des deux documents ne contient de
> donnée relative à une personne accompagnée. Les noms de Sandrine Regina (autrice,
> consultante) et de Damon BA (programmeur EODA) sont conservés car ils décrivent la
> gouvernance EODA, déjà documentée dans CLAUDE.md.
>
> **Conventions de transcription** : le texte est celui de Sandrine, mot pour mot (fautes et
> tournures comprises). Seule la mise en forme passe de Word à Markdown. Les commentaires
> Word de Sandrine sont rendus en `> 💬 Commentaire de Sandrine`. Les notes
> `> ⚠️ à confirmer avec Sandrine : …` sont **ajoutées** par la transcription et signalent un
> passage ambigu ou contradictoire laissé tel quel.

---

# Partie A — Mode opératoire « Vérification documentaire »

*Source : `Mode Opératoire Analyse Documentaire.docx` — en-tête « EODA CONSEIL » ; pied de
page « [Mention de confidentialité à préciser] — Page X / Y ».*

## MODE OPERATION VERIFICATION DOCUMENTAIRE

*(sous-titre ou précision facultative)*

| | |
|---|---|
| **Type de document** | Procédure |
| **Date** | 19/07/2026 |
| **Version** | v01 |
| **Objectif** | Description pour mode opératoire afin de Systématiser et automatiser de la manière la plus sûre possible le contrôle croisé documentaire |
| **Rédigé par** | Sandrine REGINA – EODA Conseil |
| **Diffusion / Destinataire** | Usage interne EODA |
| **Confidentialité** | Interne |

> ⚠️ à confirmer avec Sandrine : le titre porte « MODE OPERATION » (et non « MODE
> OPÉRATOIRE »), et le pied de page « [Mention de confidentialité à préciser] » n'a pas été
> rempli — le gabarit n'est pas finalisé.

### Objet

Systématiser et automatiser de la manière la plus sûre possible le contrôle croisé documentaire

### Contexte

Accompagnement Gratuit ASSAD BENOIT

### Contenu

#### 1. Créer une matrice de contrôle documentaire unique

Mettre en place un tableau maître listant toutes les informations sensibles à vérifier :

- numéros d'urgence ;
- coordonnées institutionnelles ;
- références réglementaires ;
- noms de dispositifs ;
- dates de version ;
- intitulés de procédures ;
- mentions RGPD ;
- noms des référents internes ;
- mentions obligatoires loi 2002-2.

Chaque ligne devrait indiquer : information à contrôler / source de référence / documents où
elle apparaît / statut / correction / date / responsable / preuve

Colonnes de la matrice (reprise en tableau, même ordre) :

| Information à contrôler | Source de référence | Documents où elle apparaît | Statut | Correction | Date | Responsable | Preuve |
|---|---|---|---|---|---|---|---|

#### 2. Définir des "champs critiques" non modifiables librement

Pour éviter les incohérences, certaines informations devraient être centralisées dans une
base de référence interne EODA :

- numéro maltraitance ;
- numéro d'urgence ;
- adresse ARS / CD / autorité de tarification ;
- mentions légales récurrentes ;
- formulation type sur les droits des personnes ;
- formulation RGPD ;
- intitulés des procédures.

L'idée : on ne recopie plus ces informations à la main dans chaque document, on les reprend
depuis une source unique validée

#### 3. Automatiser une première détection des écarts

L'automatisation peut servir à repérer les incohérences simples :

- rechercher automatiquement les numéros de téléphone dans tous les documents ;
- repérer les dates de version divergentes ;
- détecter des intitulés différents pour une même procédure ;
- comparer les occurrences d'un même terme sensible ;
- signaler les anciennes références conservées dans un document.

Par exemple, l'outil pourrait repérer que 3977 apparaît dans une procédure mais qu'un autre
numéro apparaît dans un affichage ou une annexe.

#### 4. Garder une validation humaine obligatoire

L'automatisation ne doit pas décider seule. Elle doit produire une liste d'alertes, puis EODA
valide :

- si l'écart est réel ;
- si la source de référence est bien à jour ;
- quel document doit être corrigé ;
- si la correction doit être répercutée ailleurs.

C'est important parce qu'un écart peut parfois être justifié selon le contexte : affichage
local, ancien support conservé, numéro spécifique à une procédure interne, etc.

> ⚠️ à confirmer avec Sandrine : « EODA valide » — ce mode opératoire ne prévoit pas le cas
> d'une structure en autonomie (palier seul, sans relecture EODA, décidé le 30/09 puis le
> 08/10 — CLAUDE.md §7). Qui valide les alertes dans ce cas : la structure elle-même ?

#### 5. Mettre en place une revue documentaire en trois temps

Je proposerais une méthode standard :

- **Avant mission** : collecte et indexation des documents transmis.
- **Pendant diagnostic** : contrôle croisé entre documents, affichages et observations terrain.
- **Avant clôture** : revue finale des informations sensibles avant remise des livrables.

Cela évite que le contrôle soit fait une seule fois, alors que les documents évoluent pendant
l'accompagnement.

#### 6. Utiliser un code couleur simple

Dans la grille de suivi :

| Couleur | Signification |
|---|---|
| **Vert** | cohérent et validé |
| **Orange** | à vérifier |
| **Rouge** | incohérence confirmée |
| **Bleu** | correction faite, en attente de validation |
| **Gris** | non applicable |

C'est très lisible pour un client et facile à suivre en réunion.

#### 7. Tracer systématiquement la preuve de correction

Pour chaque correction, conserver :

- le document corrigé ;
- la version ;
- la date ;
- le responsable ;
- la source utilisée ;
- si possible, une capture ou un extrait avant/après.

Cela transforme le contrôle documentaire en preuve de maîtrise qualité, pas seulement en
correction ponctuelle.

#### 8. Prévoir un contrôle spécifique des affichages terrain

Les affichages sont souvent les zones les plus à risque, car ils peuvent être modifiés hors
circuit documentaire. Il faudrait donc prévoir une mini-checklist dédiée :

- photo de l'affichage ;
- date de la photo ;
- lieu ;
- information vérifiée ;
- cohérence avec procédure ;
- action corrective si besoin.

> ⚠️ à confirmer avec Sandrine : ce point demande de **vérifier l'information** portée par
> un affichage (numéro, contact) et sa cohérence avec la procédure. Or
> `10-regles-mise-en-conformite.md` §8 (séance du 15/09) dit que la charte et la liste des
> personnes qualifiées, documents affichés, se prouvent par une photo « **pas d'analyse de
> texte** ». Les deux se concilient si « pas d'analyse de texte » veut dire « pas d'analyse
> de conformité au référentiel », mais le contrôle croisé des numéros reste dû — à trancher.

#### 9. Transformer l'écart 3133 / 3977 en cas d'école interne

L'écart réglé peut devenir un exemple dans la méthode EODA :

« Tout numéro, référence ou contact figurant simultanément dans un affichage, une procédure
et un livrable doit faire l'objet d'un contrôle croisé systématique avant validation
finale. »

Cela permet de capitaliser sur l'expérience ASSAD BENOIT sans présenter l'écart comme une
faiblesse.

> ⚠️ à confirmer avec Sandrine : le document ne dit pas lequel des deux numéros (3133 ou
> 3977) était le bon, ni lequel figurait sur l'affichage. Le Guide (Partie B, phase 6) parle
> d'un écart « entre le numéro affiché sur site pour le signalement de maltraitance et le
> numéro de référence utilisé dans les documents internes EODA ». Le 3977 est cité comme
> numéro national dans `10-regles-mise-en-conformite.md` §6 (⚖️ à vérifier) ; ne pas en
> faire un champ critique sans confirmation de la source de référence.

### Actions à retenir / Conclusion

*[Synthétisez les décisions, engagements ou prochaines étapes. Tableau de suivi ci-dessous, à
adapter ou supprimer.]*

| Action | Responsable | Échéance |
|---|---|---|
| [Action à mener] | [Nom] | [JJ/MM/AAAA] |
| [Action à mener] | [Nom] | [JJ/MM/AAAA] |

> ⚠️ à confirmer avec Sandrine : la conclusion et le tableau d'actions sont restés au stade
> du gabarit (texte d'aide non remplacé). Aucune action, aucun responsable, aucune échéance
> n'est fixé.

**Mode d'emploi de ce gabarit (à supprimer avant diffusion)** — *(bloc présent dans le
document source ; il décrit le gabarit EODA « note interne / procédure / courrier /
compte-rendu » utilisé pour rédiger ce mode opératoire)*

- Note interne / Procédure : conservez la structure Objet / Contexte / Contenu / Actions
  telle quelle.
- Courrier : remplacez le bloc « Objet » par une formule d'appel (ex. « Madame, Monsieur, »)
  et ajoutez une formule de politesse avant la signature. Le bloc « Diffusion / Destinataire »
  ci-dessus sert alors d'adresse du destinataire.
- Compte-rendu : renommez « Contenu » en « Points abordés » et utilisez le tableau d'actions
  pour le suivi des décisions.

---

# Partie B — Guide « Mode opératoire EODA » (accompagnement ASSAD BENOIT)

*Source : `Guide EODA Mode Opératoire.docx` — en-tête « EODA conseil · Mode opératoire ·
ASSAD BENOIT » ; pied de page « Document interne EODA Conseil — © 2026 — Page X / Y ».*

## MODE OPÉRATOIRE EODA

**Accompagnement qualité HAS — ASSAD BENOIT**

Du premier contact (mars 2026) à l'échéance d'évaluation HAS (15 janvier 2027) : déroulé
chronologique, actions conduites et à conduire, livrables associés et estimation du temps
consultant.

Document interne — base de cadrage et support de présentation client

Version 02 — 19 juillet 2026

Rédigé par Sandrine Regina — EODA Conseil

*Document confidentiel — usage interne EODA Conseil, non destiné à une diffusion externe sans
revue préalable*

> ⚠️ à confirmer avec Sandrine : la page de garde dit à la fois « Document interne » et
> « support de présentation client », alors que §8.1 et §9.2 interdisent de faire apparaître
> des données commerciales internes (tarifs, TJM, valorisation — présents au §7) dans un
> support remis au client. Une version client devrait retirer le §7.

### Sommaire

1. Contexte et objectifs de l'accompagnement
2. Périmètre de la mission EODA
3. Gouvernance et interlocuteurs
4. Déroulé opérationnel par phase
5. Détail des actions à mener
6. Livrables attendus
7. Planning et timing estimatif humain
8. Points de vigilance
9. Recommandations finales

## 1. Contexte et objectifs de l'accompagnement

### 1.1 Contexte réglementaire et sectoriel

Les Services Autonomie à Domicile (SAD) sont soumis, comme l'ensemble des ESSMS, au
référentiel national d'évaluation de la qualité de la Haute Autorité de Santé (manuel juillet
2025 pour les critères applicables aux SAD). Ce référentiel comprend 157 critères, dont 18
critères impératifs ne tolérant aucune cotation inférieure à 4 étoiles : un seul écart sur un
critère impératif déclenche un plan d'actions transmis à l'autorité de tarification et de
contrôle (ATC).

> ⚠️ à confirmer avec Sandrine : (1) « 18 critères impératifs » est le chiffre tous ESSMS ;
> pour un SAD Aide comme l'ASSAD BENOIT, c'est **16** (le Guide le dit lui-même en phase 3 et
> au §2.1) — cf. `02-referentiel-has.md`. (2) « aucune cotation inférieure à 4 **étoiles** » :
> la cotation HAS est 1/2/3/4/★/NC/RI, où ★ est une mention au-dessus de 4 ; il faut
> probablement lire « inférieure à 4 ». Ne pas reprendre « 4 étoiles » dans une sortie.

Le cycle d'évaluation s'inscrit dans une logique d'amélioration continue (PDCA) sur 5 ans,
avec 3 évaluations prévues sur 15 ans. Les résultats (score A/B/C/D) sont rendus publics via
le portail Qualiscope, et le suivi des critères se fait via la plateforme Synaé. Les SAD,
ayant intégré plus tardivement cette démarche que les autres ESSMS, font face à une pression
particulière pour se mettre en conformité, souvent avec des ressources qualité limitées en
interne.

> Rappel produit (CLAUDE.md §7) : la lettre A/B/C/D est l'affichage public Qualiscope, jamais
> une unité de cotation ; la plateforme cote en 1/2/3/4/★/NC/RI.

### 1.2 La mission ASSAD BENOIT : structure pilote et cas de référence

L'ASSAD BENOIT (association loi 1901, SAD Aide, Le Blanc-Mesnil, 93 — Directrice : [nom]) a
sollicité EODA Conseil pour préparer son évaluation HAS, initialement envisagée en mai 2026.
À l'issue du diagnostic initial, la structure a choisi de reporter cette échéance à la date
fixée par son autorité de tutelle, afin de disposer du temps nécessaire à une préparation
sérieuse. L'échéance d'évaluation retenue est le 15 janvier 2027.

Cette mission a un statut particulier : ASSAD BENOIT joue le rôle de structure pilote
(« bêta-testeuse ») pour EODA Conseil. L'accompagnement, de périmètre équivalent à la formule
Excellence, est fourni à titre gratuit en contrepartie du pilotage et de la validation de
l'offre, de la méthode et des outils d'EODA Conseil. Ce document utilise donc la mission
ASSAD BENOIT comme modèle opérationnel réel, reconstitué à partir de la chronologie
effectivement suivie depuis le 31 mars 2026, et non comme un exercice théorique.

*Hypothèse / précision méthodologique — la présente version reconstitue la chronologie à
partir des comptes rendus, rapports et plans d'action déjà produits jusqu'au 13 juillet 2026.
Les phases postérieures à cette date (semaine du 22 au 30 septembre 2026, phase à distance
d'octobre-novembre, consolidation de décembre) reprennent les plans déjà validés avec la
structure ; elles restent donc, par nature, des projections à ajuster au fil de l'avancement
réel.*

### 1.3 Objectifs de l'accompagnement

- **Comprendre les attendus HAS** — traduire le référentiel (critères impératifs et
  standards, éléments de preuve attendus) en langage opérationnel pour la gouvernance et les
  équipes de terrain.
- **Réaliser l'auto-évaluation** — conduire une auto-évaluation « blanc » fidèle à la méthode
  HAS (audit système, traceur ciblé, accompagné traceur selon les chapitres), puis accompagner
  l'auto-évaluation officielle sur la plateforme Synaé.
- **Identifier les écarts documentaires** — cartographier les documents attendus par la loi
  2002-2 et le référentiel HAS, distinguer ce qui existe, ce qui est incomplet et ce qui
  manque.
- **Construire un plan d'actions concret** — prioriser les actions correctives selon leur
  caractère impératif ou standard, avec responsables et échéances (PLAC).
- **Outiller durablement la structure** — livrer des procédures, registres et gabarits
  directement utilisables par l'ASSAD BENOIT, au-delà de la seule préparation à la visite.
- **Gagner en méthode et en sérénité** — transmettre une culture qualité pérenne (PDCA), pas
  seulement un résultat ponctuel, afin que la structure aborde l'évaluation officielle du
  15 janvier 2027 en position de maîtrise.

## 2. Périmètre de la mission EODA auprès de l'ASSAD BENOIT

### 2.1 Ce que couvre l'accompagnement

Le périmètre correspond à une formule Excellence : diagnostic complet des critères impératifs
et standards sur les trois chapitres du référentiel (Chapitre 1 — Personne accompagnée ;
Chapitre 2 — Les professionnels ; Chapitre 3 — L'ESSMS), plan d'actions PDCA, outillage
documentaire étendu (procédures P1 à P5), sensibilisation et coaching des équipes, tableau de
bord KPI, préparation à la visite (simulation d'entretiens), et suivi jusqu'à l'échéance
d'évaluation.

| Chapitre HAS | Périmètre couvert par EODA Conseil |
|---|---|
| **Chapitre 1 — Personne accompagnée** | Méthode « accompagné traceur » : recueil de l'expérience de la personne accompagnée (avec consentement), croisé avec l'expression des professionnels ; expression et participation, co-construction du projet, accompagnement à l'autonomie, continuité du parcours. |
| **Chapitre 2 — Les professionnels** | Traceur ciblé : droits fondamentaux, dignité et intimité, secret professionnel, droit à l'image, prévention et gestion des risques professionnels (DUERP). |
| **Chapitre 3 — L'ESSMS** | Audit système : les 16 critères impératifs applicables (maltraitance, plaintes et réclamations, événements indésirables, gestion de crise et continuité d'activité, RGPD…), ainsi que les critères standards (politique qualité, prévention des risques, cadre de vie, sécurité de l'accompagnement). |
| **Documents loi 2002-2** | Vérification de conformité des documents obligatoires : livret d'accueil, DIPEC, règlement de fonctionnement, charte des droits et libertés, projet de service, CVS, personne qualifiée. |
| **Documents sur le fonctionnement de la structure** | Organigramme ; Plaquette et autres supports d'information sur les offres de services ; 3 derniers rapports d'activité annuels ; CPOM (si concerné) ; Les 3 derniers comptes rendus de commissions (animation, restauration, etc.) ; Le planning d'animation sur les 3 derniers mois (si concerné) ; Liste des partenaires mobilisables ; Support d'information sur les directives anticipées (si concerné) |
| **Documents sur la démarche qualité et la gestion des risques** | Rapport d'évaluation interne ou d'auto-évaluation ; Les résultats et la synthèse des dernières enquêtes de satisfaction ; Plan bleu, plan de continuité de l'activité ; Politique qualité (associative) et index référentiel des procédures ; Procédure de traitement des évènements indésirables, réclamations et/ou signalements de faits de maltraitance et/ou violence |
| **Documents sur la gestion RH** | Livret d'accueil salarié ; Plan de formation/ programme de sensibilisation des professionnels ; DUERP |

> ⚠️ à confirmer avec Sandrine : (1) la ligne « Chapitre 3 » attribue à l'audit système
> « les 16 critères impératifs applicables », alors que plusieurs impératifs relèvent du
> chapitre 2 (2.2.x — droits fondamentaux, droit à l'image…, cf. la liste des ateliers en
> phase 4). (2) « DIPEC » : le glossaire et la checklist du projet écrivent **DIPC** —
> coquille probable, à ne pas reproduire dans un livrable. (3) « planning d'animation » et
> « comptes rendus de commissions (animation, restauration) » sont marqués « si concerné » :
> pour un SAD sans hébergement ils ne s'appliquent pas (`10-regles-mise-en-conformite.md` §2).

### 2.2 Ce que l'accompagnement ne couvre pas

EODA Conseil s'est positionnée, conformément aux conseils reçus lors de sa formation et de
son immersion professionnelle, sur l'accompagnement à l'auto-évaluation — et non sur
l'évaluation externe. Ce garde-fou déontologique structure le périmètre de la mission :

- **Pas d'évaluation certifiante** — EODA Conseil n'est pas un organisme évaluateur habilité
  par la HAS ; elle accompagne la structure dans sa propre auto-évaluation et sa préparation à
  l'évaluation officielle, réalisée par un organisme tiers accrédité.
- **Pas de garantie de score** — la mission vise la mise en conformité, la maîtrise
  méthodologique et l'atteinte des meilleures notes possibles comme cible d'accompagnement ;
  elle ne peut toutefois engager EODA Conseil sur l'obtention d'un score déterminé lors de
  l'évaluation officielle.
- **Formulation de la qualification du consultant** — la consultante est formée à la
  méthodologie d'évaluation HAS par un organisme accrédité COFRAC ; elle ne se présente pas
  comme « évaluatrice HAS certifiée ».

### 2.3 Double périmètre documentaire : interne EODA / externe client

Deux arborescences documentaires distinctes et non confluées sont tenues tout au long de la
mission :

| Périmètre | Contenu |
|---|---|
| **Interne EODA Conseil** | Outil de pilotage des missions, catalogue commercial, devis, KPI internes, méthodologie et guides internes (ex. guide projet de service, documentation de l'outil de pilotage) — jamais transmis au client. |
| **Externe ASSAD BENOIT** | Rapport de diagnostic, PLAC, procédures P1-P5, synthèses par chapitre, gabarits remplis, comptes rendus de réunion, grilles de conformité documentaire — livrables remis ou coproduits avec la structure. |

*Hypothèse / précision méthodologique — l'usage du nom « ASSAD BENOIT » dans des supports de
communication externes à la mission (site, plaquette, étude de cas nommée) nécessite un
accord écrit préalable de la structure, même informel — cf. principe déjà acté avec
Sandrine.*

## 3. Gouvernance et interlocuteurs

### 3.1 Côté EODA Conseil

- **Sandrine Regina** — consultante unique, pilote de la mission de bout en bout (cadrage,
  diagnostic, animation, production des livrables, coordination).
- **Damon BA** : programmeur, concepteur des outils en ligne interne et externe

### 3.2 Côté ASSAD BENOIT

| Interlocuteur | Rôle | Sollicitation type |
|---|---|---|
| [nom] | Directrice | Pilotage stratégique, arbitrages, validation des livrables, entretiens de gouvernance (chapitre 3) |
| [nom] | Coordinateur | Interlocuteur opérationnel régulier, suivi documentaire, relais avec les équipes terrain |
| [nom] | Assistante | Appui administratif et transmission documentaire, à préciser selon l'organisation interne |
| [nom] — nom à préciser | Assistante | Appui administratif et relais documentaire, à confirmer |
| Auxiliaires de vie sociale (AVS) | Professionnels de terrain | Entretiens chapitre 2 et 3 (traceur ciblé, audit système), sensibilisation aux procédures |
| Personnes accompagnées (échantillon) | Bénéficiaires | Entretiens « accompagné traceur » chapitre 1, sous réserve de consentement |
| Conseil de la Vie Sociale (CVS) | Instance de participation des usagers | Entretien requis pour le critère 3.14.1 (continuité d'activité) et vie institutionnelle |

> 💬 Commentaire de Sandrine (19/07/2026, sur le rôle de la 2ᵉ assistante) : « A COMPLETER
> AVEC L'ASSAD BENOIT »

*Hypothèse / précision méthodologique — durant la réunion de cadrage, il est recommandé
d'anticiper le choix des AVS interviewées au chapitre 2 en vue de l'évaluation officielle, et
de veiller à ce qu'un même professionnel ne soit pas mobilisé à la fois au chapitre 2 et au
chapitre 3.*

### 3.3 Rythme de gouvernance

- **Points de pilotage hebdomadaire** — environ deux heures, les mardis et mercredis, entre
  EODA Conseil et le binôme Direction/Coordination, avec compte rendu structuré diffusé sous
  48h.
- **Comptes rendus normalisés** — un gabarit unique (repris des attendus HAS en matière de
  traçabilité des réunions) est utilisé pour tous les CR, afin que l'ASSAD BENOIT puisse se
  l'approprier pour ses propres réunions internes.
- **Points d'étape majeurs** — réunion de cadrage (31/03), journée d'observation et
  d'auto-évaluation sur les critères impératifs et récupération des documents loi 2002-2
  (08/04), restitution du rapport de diagnostic (mai), synthèse mi-parcours (juin), semaine
  d'atelier (du 22/09 au 30/09), bilan de la semaine intensive (30/09), point de consolidation
  avant l'évaluation officielle (décembre).

## 4. Déroulé opérationnel par phase

Le mode opératoire se décompose en huit phases, depuis la qualification commerciale jusqu'à
la préparation finale de l'évaluation officielle du 15 janvier 2027. Le tableau ci-dessous
donne la vue d'ensemble ; le détail des actions par phase est développé en section 5.

| Phase | Objet | Période | Contenu clé |
|---|---|---|---|
| Phase 0 | Avant-vente & qualification | Avant le 31/03/2026 | Qualifier le besoin, envoyer le devis et le contrat |
| Phase 1 | Cadrage de la mission | 31/03/2026 | Réunion de cadrage (kick-off), collecte des données terrain |
| Phase 2 | Diagnostic initial (auto-évaluation blanc) | 08/04/2026 | Visite terrain, entretiens gouvernance et professionnels |
| Phase 3 | Analyse à froid & rapport de diagnostic | Avril–27 mai 2026 | Cotation Synaé, vérification loi 2002-2, rapport de diagnostic |
| Phase 4 | Suivi rapproché : ateliers & outillage | 21 avril–24 juin 2026 | Points bimensuels, Analyse documentaire, PLAC, procédures P1-P5, synthèses par chapitre |
| Phase 5 | Semaine intensive présentielle | 22–30 septembre 2026 | Auto-évaluation chapitre 1, validation des procédures, PCA, CVS |
| Phase 6 | Phase de travail à distance | Octobre–novembre 2026 | Finalisation RGPD, DIPEC, grille 2002-2, synthèses finales |
| Phase 7 | Consolidation & préparation finale | Décembre 2026 | KPI, simulation de visite, bilan et recommandations |

> ⚠️ à confirmer avec Sandrine : le tableau dit « Points **bimensuels** » pour la phase 4,
> mais le détail de la phase 4 et le §3.3 disent « **hebdomadaires** » (mardis/mercredis).

*Hypothèse / précision méthodologique — les dates des phases 5 à 7 correspondent au
calendrier partagé avec la Direction de l'ASSAD BENOIT (plan d'action de la semaine de
septembre, v02) ; elles sont susceptibles d'ajustement, notamment la date de l'entretien CVS
et le calendrier fin de phase 6, conditionnés par la disponibilité des parties prenantes.*

## 5. Détail des actions à mener

### Phase 0 — Avant-vente & qualification

Objectif : transformer un premier contact en mission cadrée, avec devis et contrat signés
avant toute prestation facturée. Dans le cas spécifique de l'ASSAD BENOIT, structure pilote
et bêta-testeuse accompagnée à titre gratuit, l'objectif est de formaliser au minimum un
écrit de cadrage validé par les parties.

| Action | Détail | Qui |
|---|---|---|
| RDV de découverte | 30 à 45 minutes ; qualification du besoin, de la date d'évaluation HAS envisagée, du niveau de maturité qualité et du budget. | EODA |
| Envoi du devis | Sous 48 à 72h après le RDV ; devis personnalisé à la formule adaptée (Essentiel / Performance / Excellence). | EODA |
| Levée des objections | Court RDV de présentation du devis ; identification des freins (budget, décision en CA pour une association). | EODA / client |
| Bon pour accord | Validation par retour du devis signé. | Client |
| Envoi et signature du contrat | Impératif avant toute prestation facturée. Pour l'ASSAD BENOIT, en raison du statut de structure pilote accompagnée à titre gratuit, un écrit de cadrage validé — convention, lettre d'accord ou échange de mails — doit préciser le périmètre, la gratuité, la confidentialité et les responsabilités respectives. | EODA / client |

### Phase 1 — Cadrage de la mission (31 mars 2026)

Réunion de cadrage tenue le 31 mars 2026 à 10h (visioconférence Zoom).

| Action | Détail | Qui |
|---|---|---|
| Collecte des données terrain | Nombre de dirigeants et de salariés ; anticipation des « accompagnés traceurs » (feuilles de consentement) ; identification des personnes mobilisées pour l'évaluation. | EODA / Direction |
| Présentation de la méthodologie | Présentation du cycle PDCA, du calendrier de mission et des rôles (pilotes identifiés : Directrice, Coordinateur). | EODA |
| Point de vigilance posé dès le cadrage | Anticiper le choix des AVS interviewées au chapitre 2 (les mêmes pourront être sollicitées à l'évaluation officielle, avec davantage de questions) ; vérifier qu'un responsable de secteur présent au chapitre 3 ne l'est pas également au chapitre 2. | EODA |
| Validation du planning de visite | Fixation de la date de l'auto-évaluation blanc. | EODA / Direction |

### Phase 2 — Diagnostic initial : auto-évaluation blanc (8 avril 2026)

Visite terrain conduite le 8 avril 2026 à partir de 8h30, selon le déroulé HAS en trois temps
(J-, Jour J, J+).

| Action | Détail | Qui |
|---|---|---|
| Ouverture de l'auto-évaluation | Ouverture sur la plateforme Synaé ; recueil documentaire préalable ; validation du planning de la journée. | Direction |
| Réunion d'ouverture | Revue du planning de la visite avec la gouvernance. | EODA / Direction |
| Visite du site | Observation de l'affichage et de l'organisation (méthode « check-list affichage »). | EODA |
| Entretiens gouvernance | Compréhension de la stratégie et de l'organisation mise en place sur les thématiques évaluées ; capacité de l'ESSMS à atteindre ses objectifs. | EODA / Direction, encadrement |
| Entretiens professionnels | 1h à 1h30 pour l'ensemble des critères du chapitre 3 applicables aux professionnels ; confirmation de la bonne diffusion et compréhension des organisations et actions déployées. | EODA / AVS |
| Réunion de bilan de visite | Axes forts, écarts, axes de progrès, focalisés sur les critères impératifs et la documentation loi 2002-2. | EODA / Direction |

### Phase 3 — Analyse à froid et rapport de diagnostic (avril – 27 mai 2026)

| Action | Détail | Qui |
|---|---|---|
| Rédaction des grilles d'évaluation | Cotation des 18 critères impératifs (16 applicables aux SAD Aide) dans la grille Synaé, à partir des notes prises en visite. | EODA |
| Vérification documentaire loi 2002-2 | Contrôle que les documents obligatoires (livret d'accueil, DIPEC, règlement de fonctionnement, charte des droits, projet de service…) respectent bien les critères applicables. | EODA |
| Analyse à froid de la documentation | Analyse des documents qualité transmis, en complément des observations de la visite. | EODA |
| Rédaction du rapport de diagnostic | Rapport structuré : synthèse globale, points forts, axes prioritaires, analyse détaillée par objectif impératif, plan d'actions PDCA de synthèse, recommandations (remis le 27 mai 2026). | EODA |

### Phase 4 — Suivi rapproché : ateliers et outillage documentaire (21 avril – 24 juin 2026)

Points téléphoniques hebdomadaires d'environ deux heures (mardis/mercredis), organisés en
ateliers thématiques par critère impératif : 2.2.2, 2.2.3, 2.2.4, 2.2.5 (droit à l'image),
2.2.6, 2.2.7, 3.11.1, 3.11.2, 3.12.1, 3.12.2, 3.12.3, 3.13.1.

| Action | Détail | Qui |
|---|---|---|
| Ateliers critères impératifs | Un ou deux critères par point ; analyse des écarts, co-construction des actions, arbitrages avec la Direction. | EODA / Direction, Coordinateur |
| Co-construction du PLAC | Plan d'amélioration continue formalisé, avec jalons et responsables, priorisant les critères impératifs à risque. | EODA / ASSAD BENOIT |
| Rédaction des procédures P1 à P5 | Plaintes & réclamations, événements indésirables, prévention de la maltraitance, PCA/gestion de crise, RGPD — versions de travail V0.1. | EODA |
| Synthèses documentaires par chapitre | Production et mises à jour successives des synthèses Chapitre 2 et Chapitre 3 (versions v01 à v04), consolidant constats, éléments manquants et actions à engager. | EODA |
| Comptes rendus structurés | CR de chaque point diffusé sous le gabarit HAS-compatible, réutilisable par l'ASSAD BENOIT pour ses propres réunions. | EODA |
| Synthèse mi-parcours | Point d'étape formel (24/06/2026) : avancement, documents en attente, préparation de la semaine de travail de septembre. | EODA / Direction |

> Repère : les 12 critères des ateliers sont ceux que Sandrine traite comme impératifs pour
> un SAD Aide ; la liste complète des 16 se lit dans les grilles Synaé
> (`02-referentiel-has.md`), jamais par déduction (`10-regles-mise-en-conformite.md` §2).

### Phase 5 — Semaine intensive présentielle (22–30 septembre 2026)

Semaine organisée en 7 demi-journées (9h–12h30 sauf indication contraire), l'autre
demi-journée restant dédiée aux tâches opérationnelles de l'ASSAD BENOIT. Priorité 1 :
auto-évaluation des critères non encore traités (chapitre 1 et critères standards des
chapitres 2/3). Priorité 2 : validation des travaux déjà engagés sur les critères impératifs.

| Demi-j. | Focus | Actions clés |
|---|---|---|
| 1 — Mar. 22/09 | Cadrage de la semaine & lancement chapitre 1 | Validation du planning en demi-journées ; présentation de la méthode accompagné traceur ; sélection de l'échantillon de personnes accompagnées et vérification du consentement. |
| 2 — Mer. 23/09 | Auto-évaluation chapitre 1 (1/2) | Premiers entretiens accompagné traceur ; entretiens croisés avec les professionnels ; renseignement de la grille Synaé du chapitre 1. |
| 3 | Auto-évaluation chapitre 1 (2/2) & critères standards ch. 2/3 | Suite des entretiens ; revue des grilles Synaé des chapitres 2 et 3 déjà transmises ; complétion des cotations manquantes. |
| 4 | Validation des procédures — maltraitance & plaintes | Validation express (P3 prévention maltraitance, P1 plaintes/réclamations) ; nomination du référent interne maltraitance. |
| 5 | Validation des procédures — EI & PCA | Validation express (P2 événements indésirables, fiche EI/FAMO) ; ouverture des travaux du PCA (P4). |
| 6 — Mar. 29/09 | Finalisation du PCA & entretien CVS | Finalisation de l'annuaire de crise ; tenue ou programmation ferme de l'entretien CVS requis pour le critère 3.14.1 ; mise en cohérence du livret d'accueil et du PCA. |
| 7 — Mer. 30/09 | Bilan contradictoire & calendrier à distance | Bilan global (16 critères impératifs, chapitre 1, critères standards) ; signature des documents validés ; construction du calendrier de la phase à distance. |

> Numérotation des procédures, telle qu'elle ressort du Guide : **P1** plaintes/réclamations,
> **P2** événements indésirables, **P3** prévention de la maltraitance, **P4** PCA / gestion de
> crise, **P5** RGPD.

### Phase 6 — Phase de travail à distance (octobre – novembre 2026)

Reprend, avec échéance et responsable, tout ce qui n'a pu être finalisé pendant le format
resserré des demi-journées de septembre.

| Action | Détail | Qui |
|---|---|---|
| Finalisation du volet RGPD | Charte de traitement des données (D8) datée, AIPD rédigée, tableau des droits d'accès (D9). | EODA / ASSAD BENOIT |
| Annexe 5 du DIPEC | Renseignement intégral, par référencement des procédures désormais validées. | EODA |
| Clôture de la grille de conformité loi 2002-2 | Traitement des dernières lignes « à analyser », y compris des trois documents reçus non encore exploités. | EODA |
| Croisement cahiers d'appels / export XIMI | Confirmation de la catégorisation des demandes 2024-2025 ; note de cohérence. | EODA |
| Synthèses écrites finales | Rédaction des synthèses des critères standards des chapitres 1, 2 et 3 à partir des cotations validées en septembre ; ébauche des plans d'action associés. | EODA |

> Rappel (`10-regles-mise-en-conformite.md` §4) : « D8 », « D9 » sont des codes de fichier
> personnels de Sandrine ; dans une sortie, toujours écrire le **titre** du document
> (« Charte de traitement des données », « Tableau des droits d'accès »).

*Hypothèse / précision méthodologique — l'écart précédemment relevé entre le numéro affiché
sur site pour le signalement de maltraitance et le numéro de référence utilisé dans les
documents internes EODA a été corrigé. Il est conservé comme cas d'école pour illustrer
l'importance du contrôle croisé entre supports affichés, procédures internes, documents loi
2002-2 et livrables client.*

### Phase 7 — Consolidation et préparation finale (décembre 2026)

| Action | Détail | Qui |
|---|---|---|
| Mise à jour du tableau de bord KPI | Indicateurs qualité (conformité HAS, gestion des risques, droits des personnes, RH, PDCA, gestion de crise). | EODA |
| Simulation de visite d'évaluateurs | Entraînement aux entretiens Synaé sur les critères impératifs, avec la gouvernance et un échantillon de professionnels. | EODA / ASSAD BENOIT |
| Bilan final et recommandations | Rapport de recommandations avant l'évaluation officielle du 15 janvier 2027. | EODA |
| Point de passation avant évaluation officielle | Vérification que l'ensemble des livrables (PLAC, procédures, registres, comptes rendus) est archivé, à jour et accessible pour la visite des évaluateurs. | EODA / Direction |

## 6. Livrables attendus

Consolidation de l'ensemble des livrables produits ou à produire par phase, tous formalisés
selon la charte graphique EODA Conseil et remis à l'ASSAD BENOIT (sauf mention contraire).

> ⚠️ à confirmer avec Sandrine : « tous formalisés selon la charte graphique EODA » ne
> correspond pas aux documents finaux ASSAD du 07/10 (PAP, fiche des tâches, enquête de
> satisfaction), qui portent l'en-tête et le logo de la structure seuls, sans charte ni
> mention EODA. `10-regles-mise-en-conformite.md` §4 distingue : procédure = logo EODA **et**
> client ; note de service = logo client seul. Quelle règle pour les formulaires remis aux
> personnes (PAP, enquête) ?

### 6.1 Livrables de cadrage et de diagnostic

- Compte rendu de la réunion de cadrage (31/03/2026)
- Grilles Synaé cotées (18 critères impératifs, puis critères standards des trois chapitres)
- Rapport de diagnostic de conformité HAS ASSAD BENOIT (remis le 27/05/2026)
- Cartographie des écarts et priorisation des risques

### 6.2 Livrables de plan d'action et d'outillage documentaire

- PLAC (Plan d'Amélioration Continue) ASSAD BENOIT, avec jalons et responsables
- Grille de conformité documentaire loi 2002-2
- Procédures P1 à P5 : plaintes & réclamations, événements indésirables, prévention de la
  maltraitance, PCA / gestion de crise, RGPD
- Registres de suivi (plaintes/réclamations, EI/EIG), tableau de bord consolidé
- Livret d'accueil et règlement de fonctionnement mis en cohérence

> ⚠️ à confirmer avec Sandrine : le Guide nomme le plan d'action **PLAC** (Plan
> d'Amélioration Continue) ; `10-regles-mise-en-conformite.md` §6 et le produit
> (CLAUDE.md §2, Lot A) parlent de **PAC**. Un seul sigle doit apparaître dans les sorties.

### 6.3 Livrables de suivi et de gouvernance

- Comptes rendus structurés de chaque point de pilotage (gabarit HAS-compatible)
- Synthèses documentaires par chapitre (Chapitre 2 et Chapitre 3, versions successives)
- Synthèse mi-parcours (24/06/2026)
- Plan d'action détaillé de la semaine intensive de septembre 2026

### 6.4 Livrables de clôture

- Synthèses écrites finales des critères standards (chapitres 1, 2, 3)
- Tableau de bord KPI qualité
- Rapport de bilan final et recommandations avant évaluation officielle

### 6.5 Livrables internes EODA (non transmis au client)

- Fiche de synthèse documents/critères HAS (suivi de cohérence interne, versions successives)
- Outil de pilotage des missions (suivi des 4 phases, KPI internes, facturation le cas
  échéant)

## 7. Planning et timing estimatif humain

> 💬 Commentaire de Sandrine (19/07/2026, sur le titre de la section) : « Je n'ai pas corrigé
> le timing pour coller à ma réalité de débutant. Je me fie à l'automatisation que Damon et
> moi travaillons ensemble afin de coller à ce descriptif »

> 🔒 Section **interne** (tarifs, TJM, valorisation) : ne jamais la reprendre dans une sortie
> destinée à un client (§8.1 ci-dessous, « Distinction périmètre interne / externe »).

Estimation du temps consultant nécessaire si l'ensemble de la mission était réalisé par un
consultant humain, hors ASSAD BENOIT qui bénéficie de cet accompagnement à titre gratuit dans
le cadre de son statut de structure pilote. Le temps est ventilé par nature (préparation,
animation, analyse, production de livrables, coordination), en heures, avec un équivalent en
jours-homme (base 7h/jour).

| Phase | Prépa. | Anim. | Analyse | Production | Coord. | Total | Jours-h. |
|---|---|---|---|---|---|---|---|
| Phase 0 — Avant-vente | 1 h | 1 h | 0,5 h | 1,5 h | 0,5 h | 4,5 h | 0,6 j |
| Phase 1 — Cadrage | 1,5 h | 1,5 h | 0,5 h | 1 h | 0,5 h | 5 h | 0,7 j |
| Phase 2 — Diagnostic initial (visite) | 2 h | 7 h | — | — | 0,5 h | 9,5 h | 1,4 j |
| Phase 3 — Analyse à froid & rapport | 1 h | — | 10 h | 8 h | 1 h | 20 h | 2,9 j |
| Phase 4 — Suivi rapproché (9 points) | 4,5 h | 18 h | 6 h | 20 h | 4 h | 52,5 h | 7,5 j |
| Phase 5 — Semaine intensive | 7 h | 24,5 h | 3,5 h | 7 h | 3,5 h | 45,5 h | 6,5 j |
| Phase 6 — Phase à distance | 1 h | 2 h | 7 h | 14 h | 2 h | 26 h | 3,7 j |
| Phase 7 — Consolidation finale | 2 h | 7 h | 3 h | 7 h | 2 h | 21 h | 3 j |

### 7.1 Totaux et valorisation indicative

- **Temps total estimé** — environ 184,5 heures, soit approximativement 26,4 jours-homme
  (base 7h/jour), répartis sur environ 10 mois (mars 2026 à janvier 2027).
- **Valorisation théorique** — sur la base du TJM de référence EODA Conseil (650 à 850 € HT/
  jour, moyenne retenue 750 € HT), cette mission représenterait environ 19 800 € HT si elle
  avait été facturée — cohérent avec le positionnement tarifaire d'une formule Excellence (à
  partir de 12 000 €, incluant un accompagnement plus long de 12 à 18 mois) compte tenu du
  format resserré et gratuit propre au statut de structure pilote.
- **Répartition par nature de temps** — la production de livrables (60 h, environ 33 % du
  total) et l'animation (61 h, environ 33 %) dominent, ce qui est cohérent avec une mission
  combinant diagnostic documentaire dense et accompagnement présentiel soutenu (semaine de
  septembre).

> ⚠️ à confirmer avec Sandrine : (1) la somme du tableau donne **184 h** (et 26,3 j), pas
> 184,5 h / 26,4 j ; la colonne Production totalise **58,5 h**, pas 60 h (Prépa. 20 h,
> Anim. 61 h, Analyse 30,5 h, Coord. 14 h). (2) « Excellence à partir de 12 000 € » contredit
> la grille v10 retenue par le projet (Excellence 15 000 € — `08-offre-commerciale-v10.md`).
> Ces chiffres ne doivent alimenter aucune sortie.

*Hypothèse / précision méthodologique — ces estimations sont fondées sur le temps réellement
engagé jusqu'ici (déduit des comptes rendus et rapports disponibles) et sur des hypothèses
raisonnables pour les phases encore à venir (5 à 7). Elles gagneront à être recalées après la
semaine du 22 au 30 septembre 2026, qui constitue le point de bascule le plus dense du
calendrier.*

## 8. Points de vigilance

### 8.1 Vigilances méthodologiques

- **Primauté des sources primaires** — toute conclusion sur la présence ou l'absence d'un
  affichage ou d'une preuve documentaire doit s'appuyer sur l'examen direct des documents ou
  photographies disponibles, jamais sur une simple synthèse d'inventaire.
- **Cohérence entre documents** — la vérification repose sur une méthode en quatre temps :
  1. recenser les informations sensibles à contrôler, notamment les numéros d'urgence,
     coordonnées, références réglementaires, dates de version et noms de dispositifs ;
  2. comparer ces informations entre les supports affichés sur site, les procédures internes,
     les documents loi 2002-2 et les livrables remis au client ;
  3. confirmer toute information incertaine auprès de la source de référence compétente avant
     validation ;
  4. tracer chaque correction dans la grille de suivi documentaire, avec la date de mise à
     jour, le document concerné, le responsable de validation et, si nécessaire, la preuve
     associée.
- **Fiabilité des grilles déjà transmises** — avant de considérer un critère comme « déjà
  coté », vérifier que la grille Synaé correspond à sa version la plus récente et couvre tous
  les éléments d'évaluation attendus.
- **Distinction périmètre interne / externe** — veiller à ne jamais faire apparaître de
  données commerciales internes (tarifs, marges, pipeline) dans un livrable transmis au
  client, et inversement.

### 8.2 Vigilances calendaires et organisationnelles

- **Format en demi-journées de septembre** — réduit de moitié le temps disponible par rapport
  à une semaine classique ; tout ce qui n'est pas traité doit être explicitement daté et
  attribué dans la phase à distance, plutôt que simplement reporté sans échéance.
- **Format en journée complète** — un format en journée entière peut être envisagé pour
  d'autres missions, notamment lorsque la structure dispose d'une disponibilité renforcée ou
  souhaite concentrer les travaux sur un temps plus court ; il permet d'approfondir davantage
  les séquences d'auto-évaluation, de validation documentaire et de coaching. Ce format reste
  toutefois une option méthodologique générale et ne correspond pas au scénario validé avec
  l'ASSAD BENOIT, qui repose sur une organisation en demi-journées afin de préserver
  l'activité opérationnelle.
- **Consentement et disponibilité** — la méthode accompagné traceur, mobilisée pour le
  chapitre 1, doit être préparée avant la semaine de septembre afin de ne pas consommer le
  temps de la première demi-journée. La préparation comprend :
  1. identifier un petit échantillon de personnes accompagnées représentatif des situations
     suivies ;
  2. vérifier que chaque personne est en capacité d'être sollicitée dans de bonnes
     conditions, avec l'appui éventuel de son entourage ou de son représentant légal lorsque
     cela est nécessaire ;
  3. recueillir et tracer son consentement libre, éclairé et révocable ;
  4. associer à chaque situation le ou les professionnels qui accompagnent effectivement la
     personne ;
  5. confirmer leur disponibilité sur les créneaux prévus ;
  6. transmettre à EODA, en amont, les éléments strictement nécessaires à la préparation des
     entretiens, dans le respect de la confidentialité et du RGPD.
- **Disponibilité du CVS** — l'entretien requis pour le critère 3.14.1 dépend de la
  disponibilité de ses membres ; à défaut de tenue pendant la semaine intensive, une date de
  report ferme doit être fixée avant la fin de la semaine.
- **Validations « express »** — le format condensé peut conduire à une signature de principe
  sur les procédures plutôt qu'à une validation exhaustive ; la Direction et les
  professionnels doivent comprendre que cette signature engage sur le fond, la finalisation
  de détail se poursuivant à distance sous échéance précise.

  > 💬 Commentaire de Sandrine (13/07/2026, sur ce paragraphe) : « Comment et où formuler
  > cela? »

- **Charge RH concurrente** — les mouvements RH en cours au sein de l'ASSAD BENOIT restent
  prioritaires pour la Direction ; le format en demi-journées vise justement à préserver
  l'autre moitié de chaque journée pour l'activité opérationnelle.

### 8.3 Vigilances juridiques et déontologiques

- **Contrat avant prestation** — en principe, aucune prestation facturée, y compris la
  réunion de cadrage, ne doit être engagée sans contrat ou devis signé. Le cas de l'ASSAD
  BENOIT constitue une exception encadrée liée à son rôle de structure pilote et
  bêta-testeuse : l'accompagnement est réalisé à titre gratuit, en contrepartie de la
  validation de la méthode, des outils et des livrables EODA. Même en l'absence de contrat
  commercial signé, il est recommandé de formaliser cette situation par un écrit simple —
  convention de partenariat, lettre d'accord ou échange de mails validé — précisant le
  périmètre gratuit, la durée, les livrables, les obligations de confidentialité, l'usage
  éventuel du nom ASSAD BENOIT, les responsabilités respectives et l'absence de garantie de
  score.
- **Accord écrit pour toute mention nominative** — l'utilisation du nom ASSAD BENOIT dans un
  support externe à la mission requiert un accord écrit préalable, même informel.
- **Formulation de la qualification** — rappeler systématiquement la formulation exacte de la
  qualification de la consultante (formée à la méthodologie HAS par un organisme accrédité
  COFRAC), sans jamais évoquer une certification personnelle.

## 9. Recommandations finales

### 9.1 Pour la suite immédiate de la mission ASSAD BENOIT

- **Sécuriser la préparation de la semaine de septembre** — obtenir dès à présent la
  validation par la Direction de l'échantillon de personnes accompagnées et la confirmation de
  disponibilité des professionnels concernés.
- **Fixer un calendrier ferme pour l'entretien ou toute autre forme de participation des
  usagers** — solliciter la disponibilité des membres du CVS suffisamment en amont du
  29 septembre 2026 pour éviter un nouveau report.
- **Préparer la bascule vers la phase à distance** — construire, dès la demi-journée 7, un
  tableau de suivi avec échéances et responsables précis pour chaque action reportée à
  octobre-novembre.

  > 💬 Commentaire de Sandrine (19/07/2026, sur ce point) : « Regarder dans les KIT si le
  > tableau existe, sinon en créer un à part qui reprend la structure par demi-journée »

### 9.2 Pour l'industrialisation de la méthode EODA Conseil

- **Formaliser ce mode opératoire comme trame réutilisable** — ce document, une fois éprouvé
  sur l'intégralité du cycle ASSAD BENOIT (jusqu'à l'évaluation officielle de janvier 2027),
  peut devenir le mode opératoire standard proposé aux futurs clients de la formule
  Excellence, avec adaptation du calendrier selon la date d'évaluation.
- **Valoriser le temps réellement investi** — la mission ASSAD BENOIT, réalisée
  gratuitement, représente une valorisation théorique d'environ 19 800 € HT ; cet
  investissement doit être mis en avant dans le pitch et l'étude de cas comme preuve de
  sérieux et de méthode, au-delà du seul aspect commercial.
- **Anticiper la charge en cas de missions parallèles** — le format en demi-journées de
  septembre a permis de concilier accompagnement qualité et activité opérationnelle du
  client ; ce même principe de dosage du temps doit être appliqué si plusieurs missions
  clientes sont menées en parallèle, pour atteindre l'objectif de chiffre d'affaires mensuel
  visé.
- **Systématiser et sécuriser le contrôle croisé documentaire** — mettre en place, pour
  chaque mission, une matrice de contrôle des informations sensibles recensant les numéros,
  coordonnées, références réglementaires, dates de version, intitulés de procédures et
  mentions obligatoires apparaissant dans les supports affichés, les procédures internes, les
  documents loi 2002-2 et les livrables client. Cette matrice doit permettre une première
  détection automatisée des incohérences, mais toute alerte doit faire l'objet d'une
  validation humaine avant correction. Le contrôle s'effectue en trois temps : à la collecte
  documentaire initiale, lors du diagnostic terrain, puis avant la clôture des livrables.
  Chaque correction est tracée avec sa source, sa date, le document concerné, le responsable
  de validation et, lorsque cela est utile, une preuve avant/après.
- **Maintenir la discipline de double périmètre** — conserver, pour chaque nouveau client, la
  séparation stricte entre les documents internes EODA Conseil et les documents externes
  remis au client, condition de la confidentialité commerciale et de la crédibilité
  professionnelle du cabinet.

*Fin du document — Mode opératoire EODA Conseil, accompagnement ASSAD BENOIT, version 02 du
19 juillet 2026.*

---

# Partie C — Ce que l'IA doit en retenir (lecture opérationnelle, sans ajout de règle)

> Cette partie ne crée aucune règle : elle **pointe** les passages ci-dessus qu'un prompt
> d'analyse ou de mise en conformité doit appliquer. En cas de doute, c'est le texte des
> Parties A et B qui fait foi.

| Étape du prompt | Passage qui fait foi |
|---|---|
| Informations à extraire et comparer d'un document à l'autre | A §1 (9 familles d'informations sensibles) ; B §8.1 « Cohérence entre documents » étape 1 |
| Valeurs de référence (numéro maltraitance, adresses ARS/CD, formulations RGPD et droits, intitulés de procédures) | A §2 — reprises depuis une source unique validée, jamais recopiées ni inventées |
| Écarts détectables automatiquement | A §3 (numéros de téléphone, dates de version, intitulés de procédure, termes sensibles, anciennes références) |
| Ce que la sortie est | A §4 — **une liste d'alertes**, pas une décision ; un écart peut être justifié (affichage local, ancien support conservé, numéro propre à une procédure) |
| Statut de chaque ligne | A §6 — Vert / Orange / Rouge / Bleu / Gris, avec leur libellé exact |
| Trace d'une correction | A §7 et B §8.1 étape 4 — document, version, date, responsable, source, avant/après |
| Affichages | A §8 — photo, date, lieu, information vérifiée, cohérence avec la procédure, action corrective |
| Moments du contrôle | A §5 et B §9.2 — avant mission (collecte/indexation), pendant le diagnostic, avant clôture |
| Preuve | B §8.1 « Primauté des sources primaires » — conclure sur le document ou la photo, jamais sur un inventaire |
| Ce qu'une sortie ne dit jamais | B §2.2 (pas d'évaluation certifiante, pas de garantie de score, pas « évaluatrice HAS certifiée ») ; B §8.1 (aucune donnée commerciale interne dans un livrable) |
