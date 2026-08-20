# Outil de pilotage des missions — EODA_Pilotage_Missions_Interne

> Documente l'outil HTML autonome de pilotage commercial/mission interne à EODA Conseil
> (distinct de la plateforme SAD/HAS objet du reste du projet). Source :
> `20260621_DOC_EODA_Pilotage-Missions-Documentation_v02_Interne.docx` et
> `20260621_OUTIL_EODA_Pilotage-Missions_v02_Interne.html` (prototype fonctionnel réel,
> lu et retranscrit ici pour en extraire le modèle de données et les règles de calcul).

> **Mise à jour d'implémentation (2026-07-19)** : l'ensemble des modules décrits ci-dessous
> sont désormais portés par la plateforme SaaS. Prospects, Devis, Catalogue et KPI (§3 à §6,
> §8) vivent sous `/dashboard/cabinet/commercial`, réservés au rôle `CABINET_ADMIN` (jamais
> `CABINET_EVALUATOR` ni `CLIENT_USER`). Le suivi de mission (§7 — checklist diagnostic 12
> items + 4 phases d'accompagnement) vit sous
> `/dashboard/cabinet/etablissements/[id]/mission`, accessible à `CABINET_ADMIN` **et**
> `CABINET_EVALUATOR` (suivi opérationnel, pas financier). La formule contractuelle qui
> gouverne le verrouillage Excellence (§7.3) est choisie à la création de la mission parmi
> les offres actives du catalogue (§4), et stockée sur le modèle `Mission` — pas sur
> `Establishment.commercialTier`, qui reste hors périmètre. Le prototype HTML `localStorage`
> décrit plus bas reste la référence fonctionnelle historique mais n'est plus la version
> courante de ces modules.

## 1. Objet et périmètre

Cet outil centralise le **pipeline commercial** (prospects, devis) et le **suivi des
missions clients** (diagnostic initial, 4 phases d'accompagnement, KPI internes) d'EODA
Conseil. C'est un usage **interne exclusif**, jamais transmis à un client.

Il est volontairement **distinct** de la plateforme ESSMS/AutoEval (le sujet principal
de ce projet — cf. `01-glossaire-essms.md` à `05-prototype-existant.md`) :

| Outil | Contenu | Destination |
|---|---|---|
| EODA_Pilotage_Missions_Interne (celui-ci) | Prospects, devis, suivi de mission, KPI commerciaux internes | Interne exclusif — jamais transmis |
| Outils ESSMS / AutoEval (reste du projet) | Grilles HAS, PLAC, checklist affichage, rapport diagnostic | Utilisé avec le client, parfois remis au client |

Cette séparation est structurante : elle évite que des données commerciales internes
(montants, marges, pipeline) ne se retrouvent dans un livrable client, et inversement
que les modules client soient alourdis par du flux commercial. **Elle fait écho à la
règle du double périmètre documentaire** déjà posée dans le mode opératoire ASSAD BENOIT
(interne EODA / externe client) — même logique, appliquée ici à l'outil de pilotage
plutôt qu'à l'arborescence documentaire de mission.

## 2. État actuel : prototype HTML statique (pas une fondation technique)

Comme le prototype d'auto-évaluation HAS (`05-prototype-existant.md`), cet outil est un
**fichier HTML unique, sans backend ni base de données** :

- Toutes les données vivent en mémoire JS (`let state = load()`) et sont persistées
  uniquement via `localStorage` du navigateur (clé `eoda_pilotage_missions_v1`).
- Pas de compte, pas de multi-utilisateur, pas de cloisonnement de données.
- Export/import JSON manuel comme unique mécanisme de sauvegarde — voir §7.
- Le référentiel commercial (formules, options, textes de checklist) est codé en dur
  dans des constantes JS (`DIAG_TEMPLATE`, `PHASE_DEFS`, `defaultState().catalogue`).

**Ce que ça implique pour une éventuelle industrialisation** (à traiter avec la même
logique que le prototype d'auto-évaluation, cf. `05-prototype-existant.md` §Action
concrète) : si ce module devait un jour rejoindre la plateforme SaaS ESSMS/HAS ou devenir
un outil de gestion interne plus robuste, le contenu (catalogue, templates de checklist)
devrait migrer vers une table de configuration en base plutôt que rester codé en dur, et
la logique de calcul (devis, avancement, KPI) devrait être portée en service testable —
même principe que `ScoringService` prévu pour le moteur de cotation HAS. **Ce n'est pas
une demande actée pour la plateforme SaaS** ; à ce stade l'outil reste un prototype
interne local, à faire évoluer tel quel dans un premier temps.

## 3. Modules de l'outil

| Onglet | Fonction |
|---|---|
| Tableau de bord | Vue d'ensemble : prospects en cours, devis en attente, CA signé, missions actives, prochaines échéances |
| Pipeline prospects | Suivi en kanban du premier contact jusqu'à la signature ou la perte du prospect |
| Devis | Génération à partir du catalogue, calcul acompte/échéancier, récapitulatif imprimable |
| Missions | Checklist du diagnostic initial puis suivi des 4 phases d'accompagnement |
| Catalogue | Formules, modules M1-M5, prestations à la carte — modifiable, alimente les devis |
| KPI internes | Taux de conversion, pipeline pondéré, CA signé, répartitions |

## 4. Catalogue commercial

### 4.1 Formules

| Formule | Prix de base | Modules inclus | Contenu |
|---|---|---|---|
| Essentiel | 2 500 € | M1 · M2 | Diagnostic & cadrage + plan d'action |
| Performance | 6 500 € | M1 · M2 · M3 · M4 | Diagnostic, plan d'action, déploiement des outils et accompagnement terrain |
| Excellence | 12 000 € | M1 à M5 | Accompagnement complet jusqu'au pilotage par KPI |

⚠️ Les libellés des modules M2 à M4 sont des **repères provisoires** — seuls M1
(« Diagnostic/Cadrage ») et M5 (« KPI Pilotage ») sont confirmés dans les documents
existants. À ajuster dans l'onglet Catalogue selon l'offre réellement formalisée.

### 4.2 Prestations à la carte (paramétrage de départ, entièrement modifiable)

| Prestation | Prix |
|---|---|
| Journée supplémentaire de visite sur site | 800 € |
| Formation équipe (½ journée) | 600 € |
| Registre plaintes/réclamations EI-EIG personnalisé | 450 € |
| Réunion de restitution PAC supplémentaire | 350 € |
| Tableau de bord KPI Power BI sur mesure | 900 € |

## 5. Pipeline prospects

### 5.1 Statuts (colonnes du kanban, dans l'ordre)

`nouveau` (Nouveau contact) → `rdv` (RDV programmé) → `devis_envoye` (Devis envoyé) →
`negociation` (Négociation) → `signe` (Signé) → `perdu` (Perdu)

### 5.2 Canaux d'acquisition suivis

Bouche-à-oreille · Référencement UNA · Emailing · Référencement Google · LinkedIn · Autre

### 5.3 Champs d'un prospect

Nom de la structure, type (`association` / `prive` / `public`), contact, téléphone,
e-mail, canal, statut, formule envisagée, montant estimé, date de premier contact, notes.

## 6. Devis

### 6.1 Règle de calcul (implémentée dans `recalcDevis()`)

```
montant total     = prix de base de la formule + somme des options cochées
montant acompte    = arrondi(montant total × taux d'acompte / 100)
solde              = montant total − montant acompte
montant par échéance = arrondi(solde / nombre d'échéances)
```

- **Taux d'acompte par défaut** : 40 % à la commande (CGP plaquette v10 §06 ; 30 % dans la v02) — paramétrable globalement
  (Catalogue → Paramètres de facturation) et modifiable par devis.
- **Nombre d'échéances pour le solde** : configurable de 1 à 6.
- **Validité du devis** : 30 jours par défaut à partir de la date de création — la date
  de validité stockée est calculée automatiquement (`date de création + validité en jours`).

### 6.2 Numérotation

`DEVIS-AAAA-NNN`, compteur annuel automatique (ex. `DEVIS-2026-001`). Le compteur
(`parametres.compteurDevis`) s'incrémente uniquement à la création d'un nouveau devis,
jamais à sa modification.

### 6.3 Statuts et effet de bord automatique sur le pipeline

Statuts : `brouillon` · `envoye` · `signe` · `refuse`.

Passer un devis à un statut donné met à jour **automatiquement** le statut du prospect
lié, selon cette règle exacte (implémentée dans `saveDevis()`) :

- Devis → `signe` : le prospect passe à `signe`, quel que soit son statut précédent.
- Devis → `envoye` : le prospect passe à `devis_envoye`, **mais seulement si** son statut
  actuel est `nouveau` ou `rdv` (un prospect déjà en `negociation` ou `signe` n'est pas
  rétrogradé).
- Aucun effet de bord automatique pour `brouillon` ou `refuse`.

### 6.4 Récapitulatif imprimable

Le bouton « Imprimer le récapitulatif » ouvre une fenêtre isolée contenant uniquement le
bloc récapitulatif (client, formule, options, total, acompte, échéancier, mention CGV),
sans le reste de l'interface — pensé pour être imprimé ou converti en PDF tel quel.

## 7. Missions

### 7.1 Diagnostic initial — checklist en 12 étapes

Regroupées en 3 temps (cadrage → visite → analyse à froid), cohérent avec le déroulé
détaillé dans `Guide_EODA_Mode_Opératoire.docx` (phases 1 à 3) :

1. Réunion de cadrage (validation besoins, planning)
2. Recueil documentaire
3. Validation du planning de visite
4. Réunion d'ouverture (revue du planning)
5. Visite du site (affichage, organisation)
6. Entretiens méthode HAS — critères impératifs
7. Réunion de bilan de visite (axes forts / écarts / axes de progrès)
8. Cotation des critères
9. Vérification des documents loi 2002-2
10. Rédaction du rapport diagnostic
11. Création du PAC (plan d'action)
12. Réunion distancielle — restitution du PAC

### 7.2 Quatre phases d'accompagnement post-PAC

Démarrent une fois le diagnostic initial terminé et le PAC validé. Version simplifiée,
pour le retro-planning outil, de la méthode M1-M12 de l'offre commerciale (le diagnostic
initial ci-dessus correspond à M1-M2).

| Phase | Objectif | Actions clés (clé interne) | Réservée à |
|---|---|---|---|
| 1. Fondations | Poser les bases documentaires et le plan d'actions | `f1` PDCA co-construit · `f2` pack documentaire P1-P5 · `f3` registres/tableaux de suivi | Toutes formules |
| 2. Déploiement | Faire vivre les procédures sur le terrain, monter les équipes en compétence | `d1` ateliers de sensibilisation · `d2` formation gouvernance · `d3` mise en œuvre opérationnelle · `d4` traçabilité des actions | Toutes formules |
| 3. Consolidation | Vérifier que les actions tiennent dans le temps | `c1` reporting KPI Power BI · `c2` revue mi-parcours · `c3` ajustement du plan d'actions · `c4` analyse EI/plaintes | **Excellence ou bêta-test gratuit uniquement** |
| 4. Préparation finale | Mettre la structure en condition réelle avant la visite HAS | `p1` simulation de visite · `p2` entraînement aux 3 méthodes d'entretien · `p3` bilan final · `p4` rapport de recommandations | **Excellence ou bêta-test gratuit uniquement** |

Chaque phase porte aussi une date de début et de fin, saisies librement (pas de calcul
automatique de planning).

### 7.3 Règle de verrouillage des phases 3 et 4

```js
isExcellenceScope(m) = (m.formule === 'excellence') || (m.gratuit === true)
```

Dans l'outil, les phases 3 (Consolidation) et 4 (Préparation finale) sont **grisées et
non cochables** pour une mission en formule Essentiel ou Performance — sauf si la mission
porte le statut « bêta-test gratuit », auquel cas elle reçoit le périmètre Excellence
complet quelle que soit la formule affichée.

### 7.4 Calcul de l'avancement global d'une mission (`missionGlobalPct`)

Le pourcentage affiché sur chaque carte mission (et sur le tableau de bord) est calculé
ainsi — à connaître avant toute réutilisation ou modification de cette logique :

1. **Avancement du diagnostic** : proportion de cases cochées sur les 12 items de la
   checklist diagnostic (`DIAG_TEMPLATE`), tous comptant à poids égal.
2. **Avancement des phases** : pour chaque phase *applicable* à la mission (donc en
   excluant les phases 3/4 si la mission n'est pas en périmètre Excellence — voir §7.3),
   on calcule le pourcentage d'actions cochées de cette phase, puis on fait la **moyenne
   simple de ces pourcentages de phase** (pas une moyenne pondérée par le nombre
   d'actions — une phase à 3 actions et une phase à 4 actions comptent chacune pour moitié
   du score « phases », pas au prorata de leur nombre d'actions).
3. **Score global** = moyenne simple entre le pourcentage diagnostic et le pourcentage
   phases (50/50), arrondie à l'entier le plus proche.

⚠️ Conséquence pratique : pour une mission Essentiel ou Performance (2 phases
applicables sur 4), le score global reste un 50/50 entre diagnostic et phases — les
phases non applicables ne sont ni comptées ni pénalisantes, mais le poids du diagnostic
dans le score final ne change pas selon le nombre de phases actives.

### 7.5 Statut commercial « bêta-test gratuit »

Une mission peut être marquée `gratuit: true` : le client reçoit l'intégralité du
périmètre Excellence (y compris phases 3 et 4) sans facturation, en échange du pilotage
et de la validation de l'offre EODA. Suivi comme KPI interne distinct (§8), à ne jamais
confondre avec une mission commerciale standard dans le calcul de CA.

**Mission pré-chargée dans l'état par défaut de l'outil** (`defaultState()`) : ASSAD
BENOIT — association, FINESS 930034459, contact Tania Leborgne (Directrice), formule
Excellence, `gratuit: true`, échéance évaluation HAS au 15/01/2027, diagnostic initial
quasi entièrement coché (seule la restitution du PAC — `froid_restitution` — reste à
faire dans les données de départ), phase Fondations en cours (01/06 au 31/08/2026),
phases suivantes calées sur septembre à décembre 2026. Cohérent avec le calendrier détaillé
du `Guide_EODA_Mode_Opératoire.docx`, mais les dates et cases cochées sont indiquées comme
étant **à vérifier et ajuster dans l'outil** — elles ne sont pas resynchronisées
automatiquement avec le mode opératoire texte.

## 8. KPI internes

| Indicateur | Calcul exact |
|---|---|
| Devis émis (total) | Nombre de devis créés, tous statuts confondus |
| Taux de conversion | `devis signés ÷ total des devis émis`, en % arrondi |
| Pipeline pondéré | `Σ montant des devis "Envoyé" × 0,30` + `Σ montant des devis "Négociation" × 0,60` |
| CA signé cumulé | `Σ montantTotal` des devis au statut `signe` |
| Missions bêta-test gratuites | Nombre de missions `gratuit: true` — **à exclure du calcul de CA** |
| Répartition par type de structure | Nombre de prospects association / privé / public |
| Répartition des missions par formule | Nombre de missions par formule signée |
| Pipeline par statut | Nombre de prospects par colonne du kanban |

Ces KPI pilotent l'activité **commerciale** d'EODA. Ils sont **distincts** des 24 KPI
qualité remis aux clients dans le cadre de l'accompagnement (tableau de bord KPI qualité
du Module 3 / Phase 7, cf. `Guide_EODA_Mode_Opératoire.docx` §6.4 et §7) — ne pas
confondre les deux jeux d'indicateurs dans une documentation ou un livrable.

## 9. Sauvegarde des données (limite structurelle du prototype actuel)

L'outil stocke ses données uniquement dans le `localStorage` du navigateur — **rien
n'est envoyé sur un serveur**. Conséquences opérationnelles :

- Exporter régulièrement (bouton « Exporter » en en-tête) pour obtenir une sauvegarde
  JSON horodatée (nommage : `AAAAMMJJ_SAUVEGARDE_EODA-Pilotage-Missions_Interne.json`).
- Importer restaure une sauvegarde ou permet de changer de machine — **l'import remplace
  l'intégralité des données actuelles**, sans fusion possible.
- Un vidage du cache navigateur sans export préalable entraîne une **perte de données
  irréversible**.

## 10. Évolutions identifiées (non encore développées)

- Gabarit CR de réunion de cadrage
- Gabarit CR de réunion d'ouverture de visite
- Gabarit CR de réunion de bilan de visite
- Grille de conformité documentaire loi 2002-2 (DIPC, livret d'accueil, règlement
  intérieur, règlement de fonctionnement) — à rapprocher du travail déjà engagé dans
  `Mode_Opératoire_Analyse_Documentaire.docx` sur le contrôle croisé documentaire
- Trame de restitution du PAC (support de réunion distancielle)
- Séquences d'emailing de prospection et de relance

## 11. Charte graphique appliquée

L'outil applique déjà intégralement la charte EODA (`04-charte-eoda.md`) : mêmes
variables CSS de couleur (`--brun-ancre`, `--terre`, `--ambre`, etc.), même police
(Trebuchet MS avec fallback système), même logo SVG viseur/croix, même tagline
*« Expliquer · Observer · Démontrer · Accompagner »*. Rien à en retirer ou adapter côté
charte si ce module devait être repris dans une interface future — le rendu visuel est
déjà conforme.

## 12. Refonte des offres — décisions du call du 16 août 2026 ⚠️ PARTIELLEMENT IMPLÉMENTÉ

> Source : call Sandrine × Damon du dimanche 16 août 2026 (4 h 15),
> [transcription Fathom](https://fathom.video/calls/786436116). **Chaque décision ci-dessous
> porte le lien horodaté qui permet de la vérifier sans réécouter le call.** Corrigé le
> 19/08/2026 après relecture intégrale de la transcription : plusieurs points du §12 initial
> étaient des versions rétractées en cours de call (prix Essentiel, ligne de démarcation
> Performance / Excellence, coupure d'accès en fin de mission, interdiction de dépôt).
>
> **Ces décisions remplacent le §4 ci-dessus**, qui reste la référence du prototype v02.
>
> **Source de vérité tarifaire depuis le 18/08/2026 : `.claude/context/08-offre-commerciale-v10.md` §04**
> (plaquette envoyée par Sandrine, postérieure au call). Elle **prévaut sur les prix du §12.1
> ci-dessous** partout où les deux divergent. Les divergences call ↔ v10 encore ouvertes sont
> listées au §12.2.
>
> **Dépendance bloquante levée** : le §12 conditionnait la suite à l'envoi par Sandrine de
> l'offre commerciale mise à jour. La plaquette v10 est dans le dépôt
> (`.claude/context/08-offre-commerciale-v10.md`) — plus rien n'est en attente de sa part sur ce point.
>
> **Implémenté** : §12.1 et §12.2 (catalogue) — prix des formules 2 500 / 6 500 / 15 000 €,
> libellés de modules, les 10 options à la carte de la plaquette v10 avec leur unité de
> tarification (`PricingUnit` : forfait / heure / jour / document / support / mois),
> fourchettes de prix, quantité minimale facturable, acompte par défaut à 40 % (CGP v10 §06),
> et affichage systématique « À partir de … » via
> `apps/web/src/lib/services/price-format-service.ts`.
>
> **Non implémenté** : §12.4 (architecture des portails, filtrage des 12 items du diagnostic
> par offre) et §12.5 (états de fin de mission, page plan d'action, module sensibilisation,
> centre d'aide, relances, export Synaé).
>
> **Non représentable en l'état dans le catalogue** (aucun champ ne les porte, ils restent
> à traiter à la main dans le devis) : la remise « Forfait multi-docs (3+) : -10 % », le pack
> « 10 supports + banque de quiz 3 niveaux à partir de 3 500 € » et la dégressivité de
> l'abonnement portail selon l'offre souscrite (-10 % / -30 %, cf. §12.2).

### 12.1 Les trois offres, redéfinies

| | Essentiel | Performance | Excellence |
|---|---|---|---|
| Périmètre audit | **16 critères impératifs** + 7 documents loi 2002-2 | + les 141 critères standards (= 157) | idem 157 |
| Visite sur site | ½ journée | 2 jours (évaluation simulée) | idem + **2ᵉ session** après mise en conformité |
| Documentaire | aucun traitement | **analyse + mise en conformité seulement** | + **création** (procédures, registres, CR, affiches) |
| Suivi | aucun (mise en œuvre autonome) | 3 journées d'ateliers (suivi de conformité documentaire) | + **réunion hebdo 2 h** de suivi du PAC, pas à pas |
| Reporting | conformité référentielle HAS seule | idem | + **KPI Excel / Power BI** |
| Durée | 2-4 semaines | **3 mois** (M1-M3) | **10 mois** (ni 12 ni 18) |
| Prix | **à partir de 2 500 €** | **à partir de 6 500 €** | **15 000 €** |

Livrables communs aux trois offres : **rapport de diagnostic** (Word) + **plan d'action /
PAC** (Excel). Formule de vente retenue pour l'outillage documentaire :
*« upload, analyse, diagnostic, plan d'action et mise en conformité »*.

**Prix Essentiel — correction.** Le §12 annonçait « à partir de 5 000 € » : c'est une
confusion avec un autre poste. Tous les « 5 000 € » du call désignent la **licence annuelle du
portail** (5 000 € ÷ 12 ≈ la ligne d'abonnement à 400 €/mois) —
[3:26:14](https://fathom.video/calls/786436116?timestamp=12374),
[3:38:10](https://fathom.video/calls/786436116?timestamp=13090). Essentiel a été chiffrée en
séance à « 2 500 minimum » (1 000 € rapport d'écart + 1 000 € plan d'action) —
[1:44:28](https://fathom.video/calls/786436116?timestamp=6268),
[3:16:21](https://fathom.video/calls/786436116?timestamp=11781). La plaquette v10 (18/08,
postérieure au call) retient 2 500 €, et c'est ce qui est aujourd'hui en base.

**Ligne de démarcation Performance / Excellence — ⚠️ DÉCISION OUVERTE, ne pas coder.** La règle
« Performance modifie l'existant, Excellence crée du nouveau » est bien énoncée en milieu de
call ([2:47:34](https://fathom.video/calls/786436116?timestamp=10054)), mais **renversée dans
les quatre dernières minutes** — et c'est ce renversement qui produit le prix de 15 000 € :
*« pour moi, tout ça, c'est compris dans l'offre Excellence »*
([4:39:39](https://fathom.video/calls/786436116?timestamp=16779)), *« Je la mets à 15 000 et
tout ça, tu le comprends dedans »*
([4:39:49](https://fathom.video/calls/786436116?timestamp=16789)). Le critère de tri opérant
n'est donc pas créer / modifier mais : **la ligne est-elle rattachée à une procédure issue d'un
critère impératif ?** Sandrine demande explicitement à Damon de proposer le tri **ligne par
ligne** ([4:36:18](https://fathom.video/calls/786436116?timestamp=16578)) — l'arbitrage final
lui revient.

### 12.2 Options à la carte (jamais incluses dans une formule)

| Option | Prix décidé au call | Plaquette v10 (18/08) |
|---|---|---|
| Création / mise à jour documentaire à l'unité | **200 € HT par document** (~20 documents identifiés) — le tarif horaire est explicitement **rejeté** en séance ([4:14:56](https://fathom.video/calls/786436116?timestamp=15296) → [4:17:00](https://fathom.video/calls/786436116?timestamp=15420)) | « 95 à 120 € / h (mini. 2 h) · forfait multi-docs (3+) : -10 % » — **divergence, à retrancher avec Sandrine** |
| Quiz de sensibilisation (Kahoot) | option, **dans aucune formule** | idem (inclus dans la ligne « outils de sensibilisation ») |
| Documents de sensibilisation (affiche A4, communication interne) | option | à partir de 300 € / support |
| Tableau de bord des 24 KPI qualité | option | idem |
| Abonnement portail EODA + veille réglementaire HAS | **400 €/mois**, **engagement 1 an**, dégressivité chiffrée : **-10 % en Performance, -30 % en Excellence** ([3:44:02](https://fathom.video/calls/786436116?timestamp=13442)) | « à partir de 400 € (dégressif selon l'abonnement) » — le taux n'y figure pas ; **le calcul doit vivre dans l'outil** |

**Trois lignes de la plaquette v10 n'ont jamais été prononcées pendant le call** — ce sont des
ajouts postérieurs de Sandrine, à valider comme tels et non comme des décisions du 16/08 :
procédure clé en main à partir de **250 € / procédure**, pack **10 supports + banque de quiz
3 niveaux à partir de 3 500 €**, audit de conformité flash à partir de **800 € / jour**.

**Visite Essentiel** : le call retient **½ journée** ([3:51:43](https://fathom.video/calls/786436116?timestamp=13903)), la plaquette v10
annonce **1 journée** (§Essentiel, M1). Divergence à trancher — le §12.1 ci-dessus reflète le call.

La **hotline** est retirée de l'offre pour l'instant (idée conservée, non chiffrée).

### 12.3 Deux règles de gouvernance produit

1. **Prix « à partir de » partout, jamais un prix fixe.** C'est **Sandrine** qui coche les
   options pendant la réunion d'évaluation des besoins, ce qui génère le devis — le client ne
   s'auto-configure pas.
2. **Le client n'appuie jamais lui-même sur « générer ».** Il dépose ; Sandrine déclenche,
   vérifie, valide, puis le document devient visible. Décision explicite et assumée : si le
   client voyait la génération comme automatique, la facturation d'un accompagnement humain
   ne se justifierait plus.

### 12.4 Architecture des portails — précision qui contredit l'implémentation actuelle

- **Portail interne (suivi de mission)** = to-do list de Sandrine **+ reflet en compteurs** du
  portail client. Les quatre compteurs, tels que dictés : **documents déposés / documents
  analysés par l'IA / documents modifiés / documents conformes**
  ([00:56:13](https://fathom.video/calls/786436116?timestamp=3373)).
  **Pas de dépôt de document *dans ce portail-là*** — la règle porte sur le portail de suivi,
  pas sur le portail client : *« Oui, mais dans le portail opérationnel, pas dans mon portail
  de suivi à moi »* ([1:02:51](https://fathom.video/calls/786436116?timestamp=3771)). Sandrine **conserve** son droit de dépôt dans le
  portail client opérationnel (cf. point suivant). L'implémentation actuelle permet le dépôt
  depuis la checklist documentaire du suivi de mission — c'est ce dépôt-là qui est à retirer.
- **Portail client externe (mise en conformité)** = seul endroit de dépôt, par le client
  **et** par Sandrine (elle garde un droit d'écriture pour les clients peu à l'aise avec
  l'informatique).
- **Parcours à verrouiller en priorité** : prospection → devis → contrat → création de la
  fiche client **avec sélection de l'offre et des options** → ce choix **génère le profil
  client externe** avec seulement les checklists et tâches propres à l'offre → dépôt client →
  reflet dans le portail interne.
- **Les 12 items du diagnostic doivent être filtrés par offre.** Aujourd'hui
  `isScopeApplicable()` ne filtre que Consolidation et Préparation finale (§7.3) : les 12
  items du diagnostic s'affichent quelle que soit la formule. En Essentiel, Sandrine attend
  seulement : réunion de cadrage, recueil documentaire, visite, diagnostic sur les 16
  impératifs, vérification loi 2002-2, rapport de diagnostic, création du PAC.

### 12.5 Fonctionnalités demandées sur le call, non encore développées

- **Page « plan d'action » dans la plateforme** : chaque ligne d'action porte soit un bouton
  de génération (comprise dans l'offre), soit un paywall / une demande de devis (option).
  C'est le livrable que Sandrine attend de Damon, avec la règle : *« tout ce qui est comme le
  3.13 doit être une option »*.
- **Module sensibilisation** : la plateforme génère le **PDF de questions** ciblé sur les
  critères faibles, renvoie vers **Kahoot** (pas de moteur de quiz maison), et réimporte les
  statistiques comme élément de preuve.
- **Guide / centre d'aide dans l'application**, utilisable comme support de formation le
  22 septembre et pour l'autonomie sur les nouveaux arrivants du client.
- **Relances automatiques** (email / message) des clients qui ne fournissent pas.
- **Fin de mission (RGPD) — ⚠️ la version « on coupe l'accès » est rétractée.** Prononcée à
  [3:20:58](https://fathom.video/calls/786436116?timestamp=12058), rectifiée dans la foulée, puis renversée explicitement à
  [3:35:00](https://fathom.video/calls/786436116?timestamp=12900) : *« à la fin de l'accompagnement, on ne coupe pas leur accès. Ils auront
  accès à la bibliothèque des documents générés, mais nous leur préconisons de s'abonner. »*
  Trois états à modéliser, **sans suppression définitive des données** :
  1. **mission active** — dépôt + génération ouverts ;
  2. **bibliothèque abonnée** — lecture seule, **une seule version** conservée, dépôt bloqué,
     **alerte de mise à jour au 5ᵉ mois** ([3:30:23](https://fathom.video/calls/786436116?timestamp=12623)) ;
  3. **accès révoqué** — rétention côté cabinet, zéro accès client.
- **Export Excel des cotations** compatible Synaé, avec saisie à chaud pendant les entretiens
  (déjà identifié comme gap au Jalon 4).

### 12.6 Décisions du call absentes du §12 initial

- **Génération de contrat + avenant obligatoire** pour toute option souscrite hors contrat
  initial ([00:37:34](https://fathom.video/calls/786436116?timestamp=2254), [1:13:54](https://fathom.video/calls/786436116?timestamp=4434)).
- **Deux parcours d'achat d'option**, sélectionnés selon la **forme juridique** du client :
  paywall direct (paiement en ligne) ou demande → alerte interne → devis → déblocage
  ([3:09:53](https://fathom.video/calls/786436116?timestamp=11393), [3:09:33](https://fathom.video/calls/786436116?timestamp=11373)).
- **Abonnement** = engagement **1 an à reconduction tacite** ([4:09:00](https://fathom.video/calls/786436116?timestamp=14940)).
- **Veille HAS** = automatisation email + newsletter in-app ([3:38:18](https://fathom.video/calls/786436116?timestamp=13098)) ; une mise à
  jour du référentiel HAS déclenche **soit une régénération gratuite, soit une option payante**
  ([3:36:01](https://fathom.video/calls/786436116?timestamp=12961)).
- **PAC** : schéma de colonnes **imposé**, et **seuls les critères cotés < 4 génèrent une
  action** ([2:07:28](https://fathom.video/calls/786436116?timestamp=7648), [2:26:51](https://fathom.video/calls/786436116?timestamp=8811)). Deux modes de génération, dont un mode
  **« table rase »** ([3:14:42](https://fathom.video/calls/786436116?timestamp=11682)).
- **Reporting minimal de conformité pour toutes les offres**, les **24 KPI restant en option**
  ([2:51:33](https://fathom.video/calls/786436116?timestamp=10293), [2:53:13](https://fathom.video/calls/786436116?timestamp=10393)).
- **2ᵉ session d'auto-évaluation** en Excellence, **comparable à la première**
  ([3:54:12](https://fathom.video/calls/786436116?timestamp=14052)).
- **Répartition des 16 impératifs** : **10 au chapitre 3, 6 au chapitre 2, aucun au chapitre 1**
  ([2:08:50](https://fathom.video/calls/786436116?timestamp=7730)).

### 12.7 Points ouverts (aucune décision au 16/08)

- **Règle finale inclus / option du PAC** — non tranchée (cf. §12.1, tri ligne par ligne à
  proposer par Damon).
- **Qui déclenche l'analyse en offre Essentiel** : deux versions contradictoires dans le même
  call — client autonome ([00:15:17](https://fathom.video/calls/786436116?timestamp=917)) vs Sandrine ([1:09:58](https://fathom.video/calls/786436116?timestamp=4198)).
- **Rapport de diagnostic unique ou par chapitre** ([2:12:43](https://fathom.video/calls/786436116?timestamp=7963)).
- **Format d'import Synaé** : jamais spécifié.
- **Délais, cadence et condition d'arrêt des relances** : jamais spécifiés.
- **Co-édition simultanée d'un document** : question posée, restée sans réponse
  ([00:51:00](https://fathom.video/calls/786436116?timestamp=3060)).

### 12.8 Calendrier arrêté

- Formation ASSAD BENOIT : **22 au 30 septembre 2026** (et non août — ils sont en congés).
- Réunion d'avance de phase avec le client : entre le **8 et le 18 septembre**.
- Vidéo de témoignage à tourner **après** la présentation de l'outil, pas en fin de journée.
- Objectif stratégique : que ASSAD parle d'EODA à la fédération **UNA** à sa réunion
  mensuelle → référencement → un gros client dès janvier 2027.

---

*Fichier généré à partir de `20260621_DOC_EODA_Pilotage-Missions-Documentation_v02_Interne.docx`
et de la lecture du code source de `20260621_OUTIL_EODA_Pilotage-Missions_v02_Interne.html`
(v02, 21 juin 2026). À placer dans `context/06-outil-pilotage-missions.md` du projet.*
