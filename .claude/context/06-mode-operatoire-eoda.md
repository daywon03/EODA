# Mode opératoire EODA Conseil — Contrôle documentaire & Accompagnement ASSAD BENOIT

> Fusion de deux documents internes EODA Conseil :
> 1. `Mode Opératoire Analyse Documentaire.docx` (v01, 19/07/2026)
> 2. `Guide EODA Mode Opératoire.docx` (v02, 19/07/2026)
>
> Ce fichier documente le **mode opératoire humain/process** de la mission ASSAD BENOIT et
> de la méthode EODA. Il est complémentaire aux fichiers `context/*.md` qui documentent,
> eux, les **règles métier produit** (référentiel HAS, glossaire, documents obligatoires,
> charte) destinées à être encodées dans la plateforme SaaS.

---

## Partie 1 — Mode opératoire : vérification documentaire (contrôle croisé)

**Objectif :** systématiser et automatiser, de la manière la plus sûre possible, le
contrôle croisé documentaire.

**Contexte :** accompagnement gratuit ASSAD BENOIT.

### 1. Créer une matrice de contrôle documentaire unique

Tableau maître listant toutes les informations sensibles à vérifier :
numéros d'urgence, coordonnées institutionnelles, références réglementaires, noms de
dispositifs, dates de version, intitulés de procédures, mentions RGPD, noms des référents
internes, mentions obligatoires loi 2002-2.

Chaque ligne : **information à contrôler / source de référence / documents où elle
apparaît / statut / correction / date / responsable / preuve**.

### 2. Définir des « champs critiques » non modifiables librement

Informations à centraliser dans une base de référence interne EODA (au lieu d'être
recopiées à la main dans chaque document) : numéro maltraitance, numéro d'urgence, adresse
ARS / CD / autorité de tarification, mentions légales récurrentes, formulation type sur les
droits des personnes, formulation RGPD, intitulés des procédures.

### 3. Automatiser une première détection des écarts

- Rechercher automatiquement les numéros de téléphone dans tous les documents
- Repérer les dates de version divergentes
- Détecter des intitulés différents pour une même procédure
- Comparer les occurrences d'un même terme sensible
- Signaler les anciennes références conservées dans un document

*Exemple donné : l'outil pourrait repérer que 3977 apparaît dans une procédure mais qu'un
autre numéro apparaît dans un affichage ou une annexe.*

### 4. Garder une validation humaine obligatoire

L'automatisation produit une liste d'alertes ; EODA valide ensuite :
si l'écart est réel, si la source de référence est à jour, quel document corriger, si la
correction doit être répercutée ailleurs.

### 5. Revue documentaire en trois temps

- **Avant mission** : collecte et indexation des documents transmis
- **Pendant diagnostic** : contrôle croisé entre documents, affichages, observations terrain
- **Avant clôture** : revue finale des informations sensibles avant remise des livrables

### 6. Code couleur de suivi

| Couleur | Statut |
|---|---|
| Vert | Cohérent et validé |
| Orange | À vérifier |
| Rouge | Incohérence confirmée |
| Bleu | Correction faite, en attente de validation |
| Gris | Non applicable |

### 7. Tracer systématiquement la preuve de correction

Pour chaque correction : document corrigé, version, date, responsable, source utilisée, et
si possible capture/extrait avant-après.

### 8. Contrôle spécifique des affichages terrain

Mini-checklist dédiée : photo de l'affichage, date de la photo, lieu, information vérifiée,
cohérence avec procédure, action corrective si besoin.

### 9. Cas d'école interne : écart 3133 / 3977

Règle capitalisée : *« Tout numéro, référence ou contact figurant simultanément dans un
affichage, une procédure et un livrable doit faire l'objet d'un contrôle croisé
systématique avant validation finale. »*

---

## Partie 2 — Guide EODA : mode opératoire complet ASSAD BENOIT

*Accompagnement qualité HAS — du premier contact (mars 2026) à l'échéance d'évaluation HAS
(15 janvier 2027).*

### 1. Contexte et objectifs

- Référentiel HAS (manuel juillet 2025) : **157 critères**, dont **18 impératifs** au
  niveau national tous-ESSMS confondus (16 pour un SAD Aide, 17 pour un SAD Mixte — voir
  note de cohérence ci-dessous).
- ASSAD BENOIT (loi 1901, SAD Aide, Le Blanc-Mesnil 93, Directrice Tania Leborgne) : mission
  pilote/bêta-test, gratuite, échéance d'évaluation officielle fixée au **15 janvier 2027**.
- Chronologie reconstituée jusqu'au 13/07/2026 ; phases postérieures (sept.-déc. 2026) =
  projections à ajuster.

### 2. Périmètre de la mission

Formule Excellence : diagnostic complet (3 chapitres), PDCA, procédures P1-P5,
sensibilisation/coaching, tableau de bord KPI, préparation à la visite, suivi jusqu'à
l'échéance.

**Ce qui n'est pas couvert :** pas d'évaluation certifiante (EODA n'est pas organisme
évaluateur habilité HAS), pas de garantie de score, qualification du consultant formulée
précisément (formée à la méthodologie HAS par un organisme accrédité COFRAC — pas
« évaluatrice HAS certifiée »).

**Double périmètre documentaire :** interne EODA (jamais transmis au client) / externe
ASSAD BENOIT (livrables remis ou coproduits).

### 3. Gouvernance

- **EODA :** Sandrine Regina (consultante unique, pilote de bout en bout), Damon BA
  (programmeur, outils internes/externes).
- **ASSAD BENOIT :** Tania Leborgne (Directrice), Julien Chevallier (Coordinateur),
  Sandrine Mcirdi (Assistante), Marie-Hélène *(nom de famille à préciser)* (Assistante),
  AVS, personnes accompagnées (échantillon), CVS.
- **Rythme :** points hebdomadaires (~2h, mardi/mercredi), CR normalisés sous 48h, points
  d'étape majeurs (cadrage 31/03, visite 08/04, diagnostic mai, synthèse mi-parcours juin,
  semaine d'atelier 22-30/09, bilan 30/09, consolidation décembre).

### 4. Déroulé en 8 phases

| Phase | Objet | Période |
|---|---|---|
| 0 | Avant-vente & qualification | Avant le 31/03/2026 |
| 1 | Cadrage de la mission | 31/03/2026 |
| 2 | Diagnostic initial (auto-évaluation blanc) | 08/04/2026 |
| 3 | Analyse à froid & rapport de diagnostic | Avril–27 mai 2026 |
| 4 | Suivi rapproché : ateliers & outillage | 21 avril–24 juin 2026 |
| 5 | Semaine intensive présentielle | 22–30 septembre 2026 |
| 6 | Phase de travail à distance | Octobre–novembre 2026 |
| 7 | Consolidation & préparation finale | Décembre 2026 |

*(Le détail action par action de chaque phase, les livrables, le planning-temps humain
[≈184,5h / 26,4 jours-homme / valorisation théorique ≈19 800 € HT] et les points de
vigilance méthodologiques/calendaires/juridiques figurent en intégralité dans le document
source — non reproduits ici en détail pour rester une synthèse de contexte.)*

### 5. Vigilance documentaire (lien direct avec la Partie 1)

Méthode en 4 temps rappelée en §8.1 du guide :
1. Recenser les informations sensibles à contrôler (numéros d'urgence, coordonnées,
   références réglementaires, dates de version, noms de dispositifs)
2. Comparer entre supports affichés, procédures internes, documents loi 2002-2 et livrables
3. Confirmer toute information incertaine auprès de la source de référence compétente
4. Tracer chaque correction (date, document, responsable, preuve si nécessaire)

Le guide confirme explicitement que **l'écart entre le numéro affiché sur site pour le
signalement de maltraitance et le numéro de référence interne EODA a été corrigé**, et est
conservé comme cas d'école (référence croisée directe avec la Partie 1, point 9).

### 6. Vigilances juridiques et déontologiques

- Contrat avant prestation — exception encadrée pour ASSAD BENOIT (structure pilote,
  accompagnement gratuit), formalisée par écrit simple (convention/lettre d'accord/mails).
- Accord écrit préalable requis pour toute mention nominative externe d'ASSAD BENOIT.
- Formulation exacte de la qualification de la consultante à rappeler systématiquement.

### 7. Recommandations finales

- Sécuriser la préparation de la semaine de septembre (validation échantillon + disponibilité pros)
- Fixer un calendrier ferme pour l'entretien CVS
- Préparer la bascule vers la phase à distance (tableau de suivi dès demi-journée 7)
- Formaliser ce mode opératoire comme trame réutilisable pour la formule Excellence
- Valoriser le temps réellement investi (≈19 800 € HT) dans le pitch / étude de cas
- **Systématiser et sécuriser le contrôle croisé documentaire** pour chaque mission (reprise
  synthétique de toute la Partie 1 de ce fichier)
- Maintenir la discipline de double périmètre interne/externe

---

## Analyse de cohérence avec les fichiers de contexte du projet

J'ai comparé ces deux documents avec les 5 fichiers `context/*.md` déjà présents dans le
projet (`01-glossaire-essms.md`, `02-referentiel-has.md`, `03-documents-obligatoires.md`,
`04-charte-eoda.md`, `05-prototype-existant.md`) ainsi que `CLAUDE.md`. Voici ce qui
**concorde** et ce qui **mérite votre attention** (incohérences ou zones grises).

### ✅ Ce qui est cohérent

| Point | Guide/Mode opératoire | Fichiers context/ | Statut |
|---|---|---|---|
| Client pilote | ASSAD BENOIT, loi 1901, Le Blanc-Mesnil (93), mission gratuite/bêta-test | `CLAUDE.md` : identique, + FINESS 930034459 | ✅ Cohérent (le Guide n'a juste pas le FINESS) |
| Échéance évaluation | 15 janvier 2027 | `CLAUDE.md` : "janvier 2027" | ✅ Cohérent |
| Positionnement conseil ≠ évaluateur | Rappelé §2.2 et §8.3 du Guide | `02-referentiel-has.md` §6, `CLAUDE.md` §1 | ✅ Cohérent, même vocabulaire ("auto-évaluation préparatoire") |
| Cotation HAS | Aucune mention de cotation 1/2/3/4/★/NC/RI dans les 2 docx (hors mention de la grille Synaé) | `01-glossaire-essms.md`, `02-referentiel-has.md` | ✅ Pas de contradiction, sujet simplement non traité dans ces docx orientés process |
| Double périmètre interne/externe | Rappelé explicitement (Guide §2.3 et §9.2) | `CLAUDE.md` §7 ("ne jamais committer de vraies données clients") | ✅ Cohérent et renforcé |
| Contrôle croisé documentaire | Détaillé en Partie 1 + repris en §8.1 et §9.2 du Guide | Absent des fichiers context/ actuels (voir ci-dessous) | ⚠️ Nouveau, voir remarque |
| Procédures P1-P5 | Plaintes/réclamations, EI, maltraitance, PCA, RGPD | `03-documents-obligatoires.md` : sous-checklists P11/P12/P13/P14/P22 correspondent exactement | ✅ Correspondance directe et cohérente (mêmes objectifs impératifs : 3.11, 3.12, 3.13, 3.14, 2.2) |
| Documents loi 2002-2 | Livret d'accueil, DIPEC, règlement de fonctionnement, charte des droits, projet de service, CVS, personne qualifiée | `03-documents-obligatoires.md` Catégorie 1 : les mêmes 7 documents (DIPC vs "DIPEC" — voir incohérence ci-dessous) | ⚠️ Voir divergence de sigle |

### ⚠️ Points de vigilance / incohérences à signaler

1. **Nombre de critères impératifs — chiffre "18" utilisé sans nuance**
   Le Guide indique en §1.1 : *"157 critères, dont 18 critères impératifs"*, et reprend ce
   chiffre en Phase 3 (*"Cotation des 18 critères impératifs (16 applicables aux SAD
   Aide)"*). `02-referentiel-has.md` est pourtant explicite : le "18" est un chiffre
   **tous-ESSMS confondus** utilisé en communication générique, et la **vérité opérationnelle
   pour un SAD Aide comme ASSAD BENOIT est 16** (17 pour un SAD Mixte). Le Guide fait bien
   la nuance la deuxième fois qu'il cite le chiffre (*"18 (16 applicables)"*), donc ce n'est
   pas une erreur factuelle, mais la première occurrence (§1.1) pourrait induire en erreur
   si elle est lue isolément — à harmoniser pour toujours écrire "16 (SAD Aide)" en
   contexte ASSAD BENOIT plutôt que "18" en tête de phrase.

2. **Sigle DIPEC vs DIPC**
   Le Guide et le Mode opératoire écrivent systématiquement **"DIPEC"** (ex. : *"Annexe 5 du
   DIPEC"*, *"vérification de conformité... DIPEC"*). Le glossaire (`01-glossaire-essms.md`)
   et la checklist documentaire (`03-documents-obligatoires.md`) utilisent **"DIPC"**
   (Document Individuel de Prise en Charge / contrat de séjour), qui est la terminologie
   officielle du secteur. Il s'agit très probablement d'une coquille répétée dans les deux
   docx Word plutôt que d'un sigle alternatif volontaire — à vérifier avec Sandrine et à
   corriger dans les docx si c'est bien une faute de frappe, pour éviter qu'elle ne se
   propage dans un livrable client.

3. **Contrôle croisé documentaire : pas encore présent dans `03-documents-obligatoires.md`**
   La Partie 1 (matrice de contrôle, champs critiques, détection automatique des écarts,
   code couleur, cas d'école 3133/3977) décrit un mécanisme produit assez précis
   (statuts, colonnes de suivi, workflow de validation humaine) qui recoupe fonctionnellement
   le **Module 1 (Analyse documentaire)** décrit dans `CLAUDE.md` comme priorité n°1, mais
   qui n'a pas encore de contrepartie dans `03-documents-obligatoires.md` (qui décrit le
   *quoi* : la liste des documents attendus, mais pas le *comment* : le contrôle croisé des
   informations sensibles à l'intérieur de ces documents). Si cette matrice de contrôle
   documentaire doit devenir une fonctionnalité produit (et pas seulement une méthode
   manuelle EODA), il serait cohérent de l'ajouter comme section dédiée dans les specs
   techniques (`specs/01-mvp-v1.md`, non fourni ici) plutôt que de la laisser uniquement
   dans ce mode opératoire process.

4. **Écart "3133 / 3977" — numéro de signalement maltraitance**
   Les deux documents évoquent un écart réel, déjà corrigé, entre un numéro affiché sur site
   et un numéro de référence interne, conservé comme cas d'école. Aucun fichier `context/`
   ne mentionne de numéro de téléphone spécifique (le glossaire ne liste pas de numéros
   d'urgence), donc pas de contradiction factuelle possible à vérifier ici — simple
   remarque : si ce numéro doit un jour apparaître dans une donnée de référence produit
   (ex. "champ critique" centralisé, cf. Partie 1 point 2), il faudra le documenter dans un
   fichier context dédié plutôt que seulement dans ce mode opératoire, pour respecter le
   principe "ne jamais recopier à la main" que la méthode prône elle-même.

5. **Rôle de Damon BA**
   Le Guide (§3.1) mentionne *"Damon BA : programmeur, concepteur des outils en ligne
   interne et externe"* comme second interlocuteur côté EODA. Aucun fichier context/ ni
   `CLAUDE.md` ne mentionne cette personne (CLAUDE.md ne cite que Sandrine Regina comme
   fondatrice/consultante). Ce n'est pas une incohérence à proprement parler, mais une
   information absente des fichiers de contexte produit — à intégrer dans `CLAUDE.md` si
   Damon BA a un rôle actif de développement sur la plateforme (ce qui semble être le cas
   d'après la note de bas de page [^c1] : *"je me fie à l'automatisation que Damon et moi
   travaillons ensemble"*).

6. **Notes de bas de page non résolues (commentaires internes du Guide)**
   Le Guide contient 4 commentaires de Sandrine encore ouverts (nom d'assistante à
   compléter, timing non recalé, formulation à définir sur les validations "express",
   emplacement du tableau de suivi phase 6 à vérifier) — purement informatif, à traiter côté
   rédaction du document plutôt que côté cohérence produit.

### En résumé

Les deux documents sont **globalement cohérents** avec les fichiers de contexte existants,
notamment sur le positionnement déontologique, les procédures P1-P5, et le double périmètre
documentaire. Les points à corriger sont mineurs et se limitent à :
- une clarification de rédaction sur le "18 vs 16" critères impératifs,
- une coquille probable "DIPEC" → "DIPC" à harmoniser,
- l'absence de Damon BA dans `CLAUDE.md`,
- et une réflexion à avoir sur l'endroit où documenter la mécanique de contrôle croisé
  documentaire (Partie 1) dans les specs produit, si elle doit devenir une fonctionnalité
  et pas seulement une méthode manuelle.
