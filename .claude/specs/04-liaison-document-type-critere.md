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
