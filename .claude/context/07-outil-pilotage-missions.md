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

- **Taux d'acompte par défaut** : 30 % à la commande — paramétrable globalement
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

---

*Fichier généré à partir de `20260621_DOC_EODA_Pilotage-Missions-Documentation_v02_Interne.docx`
et de la lecture du code source de `20260621_OUTIL_EODA_Pilotage-Missions_v02_Interne.html`
(v02, 21 juin 2026). À placer dans `context/06-outil-pilotage-missions.md` du projet.*
