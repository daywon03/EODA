# Spécification — peupler la liaison type de document ↔ critère HAS

> Constat du 10/09/2026, en construisant les guidelines du cabinet sur l'analyse IA
> (cf. `context/06-mode-operatoire-eoda.md` et le module Analyse documentaire,
> `specs/01-mvp-v1.md` §Module 1). Travail reporté — ce fichier décrit ce qu'il reste
> à faire, pas ce qui est fait.

## Le constat

`DocumentTypeCriterion` (table `document_type_criteria`) est le pivot qui relie les
47 types de documents attendus (`context/03-documents-obligatoires.md`) aux 138
critères HAS/Synaé (`context/02-referentiel-has.md`). `specs/01-mvp-v1.md` §Module 1
la suppose peuplée depuis le premier jour : le prompt d'analyse est censé transmettre
« les critères HAS rattachés à ce type de document » au LLM.

**Elle est vide — 0 ligne, vérifié le 10/09/2026.** Conséquences concrètes :

- Chaque analyse IA reçoit aujourd'hui « Critères HAS rattachés à ce type de
  document : aucun rattachement connu » (`lib/llm/analysis-prompt.ts`), quel que soit
  le document — l'analyse tourne sans ce contexte depuis le début, silencieusement.
- Les guidelines du cabinet sur l'analyse IA (`CriterionGuideline`, ajoutées le
  10/09/2026) sont ancrées sur le critère plutôt que le type de document, précisément
  parce qu'un critère peut être rattaché à plusieurs types — mais sans cette table,
  rien ne relie automatiquement « le document qu'on vient d'analyser » à « les
  critères concernés, donc les guidelines à rappeler ». Le mécanisme est câblé et
  fonctionnera sans changement de code dès que la table sera peuplée ; en attendant,
  il tourne pour de vrai mais ne rappelle jamais rien.

## Ce qu'il faut faire

Peupler `document_type_criteria` : pour chacun des 47 `DocumentType`, la liste des
`Criterion` (parmi les 138) que ce document permet de vérifier. C'est un travail de
**contenu réglementaire**, pas de code — il demande l'expertise HAS de Sandrine, pas
une déduction depuis le nom des documents ou des critères.

Deux approches possibles, à trancher au moment de le faire :

1. **Manuelle, via un écran d'administration** — une liste à cocher par type de
   document (case par critère), dans l'esprit de `document-type-correction-service`
   avant sa bascule. Le plus sûr : chaque lien est une décision explicite de
   Sandrine, traçable.
2. **Assistée par le LLM, relue par Sandrine** — proposer un rattachement à partir des
   libellés des deux côtés, présenté comme suggestion à valider/corriger avant
   écriture (même principe que `suggestDocumentType` pour la catégorisation à
   l'upload : jamais d'auto-validation silencieuse sur une donnée réglementaire).

Dans les deux cas : écrire par le mécanisme normal d'écriture (action serveur +
Prisma), jamais par un script de seed exécuté une fois sur la base de production —
c'est une donnée de configuration métier amenée à évoluer (nouveaux types de
documents, révision du référentiel HAS), pas une donnée figée au déploiement.

## Ce qui ne dépend PAS de ce travail

Le reste de la plateforme fonctionne déjà sans cette table (dégradation
« enrichissement absent », pas panne) : le dépôt de documents, l'analyse IA
elle-même (juste sans le contexte des critères), les guidelines du cabinet (créables
et listables dès aujourd'hui, cf. `criterion-guideline-service.ts`). Rien ne bloque
tant que cette spec n'est pas traitée — c'est un manque de qualité de l'analyse, pas
un manque de fonctionnement.

## Proposition de contenu (08/10/2026)

La matrice promise par Sandrine **existe** : c'est le tableau de suivi de la mission pilote
(`context/Documents/20260915_SUIVI_ASSAD-BENOIT_Criteres-HAS_v01_Interne.xlsx`, colonne I
de l'onglet « Index référentiel complet », colonne J de « Critères Impératifs »). Elle a
été convertie en proposition générique, **sans aucune donnée du client** :

- `specs/data/20261008_proposition-document-type-criterion.csv` — **207 rattachements**
  (110 HAUTE, 87 MOYENNE, 10 BASSE) ; 36 des 47 `DocumentType` couverts ; les 16 impératifs
  du SAD aide couverts. Les lignes MOYENNE/BASSE (blocs recopiés sur tout un objectif,
  type utilisé hors de son objectif) sont à valider une à une par Sandrine.
- `specs/data/20261008_candidats-types-de-document.csv` — 46 documents cités comme preuves
  sans `DocumentType` (grille d'évaluation des besoins, fiche de tâches, note de service,
  fiche de sensibilisation, règlement intérieur, PAP…).
- `specs/data/20261008_criteres-manuel-has-niveau-champ.csv` — les **157 critères du
  manuel HAS** avec niveau et champ d'application lus dans la mise en forme du PDF
  (option retenue = bleu foncé + gras). Filtre SAD aide = exactement 137 critères (les
  grilles Synaé) ; SAD mixte = 150.

Chargement : par l'écran d'administration prévu ci-dessus (import de cette proposition,
puis validation ligne à ligne), **jamais** par un seed sur la base partagée.
