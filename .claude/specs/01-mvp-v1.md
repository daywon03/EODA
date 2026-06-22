# Spécification fonctionnelle V1 — les 3 modules

> Ordre de lecture après les fichiers `context/`. Décrit le QUOI et le POURQUOI ; le
> COMMENT technique est dans `specs/02-architecture-technique.md`.

---

## Module 1 — Analyse documentaire automatisée (priorité absolue)

### Objectif business
Faire gagner à Sandrine le temps qu'elle passe aujourd'hui à lire manuellement chaque
document client et à le comparer aux exigences HAS/loi 2002-2.

### Parcours utilisateur

1. **Upload** — Sandrine (ou le client, selon droits — voir Module 2) dépose un ou
   plusieurs fichiers (PDF, DOCX) dans l'espace d'un établissement.
2. **Catégorisation** — pour chaque fichier déposé, le système :
   - propose automatiquement un **type de document** parmi la checklist de référence
     (`context/03-documents-obligatoires.md`), par analyse du nom de fichier + contenu
   - permet à l'utilisateur de corriger cette catégorisation si le système se trompe
     (toujours garder l'humain dans la boucle — ne jamais auto-valider sans confirmation
     pour les catégories ambiguës)
3. **Analyse de contenu** — une fois catégorisé, le document est passé à un pipeline :
   a. extraction du texte (PDF → texte, DOCX → texte)
   b. appel à un LLM avec un **prompt structuré** qui contient :
      - le type de document détecté
      - la liste des **attendus** pour ce type de document (ex : pour le DIPC, vérifier
        présence signature + date de révision annuelle, cf. critère 1.10.6)
      - les **critères HAS rattachés** à ce type de document (relation
        `document_type_criterion`)
      - le texte extrait du document
   c. le LLM retourne une analyse structurée (JSON) : éléments présents / éléments
      manquants / suggestions de correction
4. **Résultat affiché** :
   - statut du document : `COMPLIANT` / `INCOMPLETE` / `EXPIRED` (voir table de statuts,
     `context/03-documents-obligatoires.md`)
   - liste des manques détectés, en langage clair
   - **suggestions de texte** à ajouter ou modifier (le LLM propose des paragraphes-types
     conformes aux attendus HAS, jamais générés à partir de zéro sans base réglementaire —
     toujours ancrés sur les gabarits EODA existants quand ils couvrent le type de document)
   - bouton "Régénérer une version corrigée" → produit un nouveau fichier intégrant les
     corrections suggérées, en conservant le format d'origine (DOCX → DOCX)
5. **Gestion de versions** — chaque régénération crée une nouvelle version du document
   (jamais d'écrasement), avec horodatage et lien vers la version précédente.

### Règles métier spécifiques

- L'analyse automatique est une **aide à la décision**, jamais une validation finale —
  Sandrine doit toujours pouvoir surclasser manuellement un statut (passer un document
  en `COMPLIANT` même si le système l'a détecté `INCOMPLETE`, avec justification libre).
- Les documents contenant des données personnelles de personnes accompagnées (ex : DIPC
  rempli, dossier usager) ne doivent **jamais** être envoyés tels quels à un LLM externe
  sans anonymisation préalable a minima des champs nominatifs — voir contrainte RGPD,
  `specs/02-architecture-technique.md` §sécurité. En V1, prévoir au minimum un avertissement
  explicite à l'upload + une option de masquage des données nominatives avant analyse.
- Le système doit distinguer un document **"si concerné"** (ex : CPOM, directives
  anticipées) d'un document **toujours obligatoire** — un document "si concerné" non
  fourni ne doit pas apparaître comme `MISSING` par défaut, mais comme `NOT_APPLICABLE`
  tant que l'utilisateur n'a pas confirmé que ça s'applique à son établissement.

### Hors périmètre V1 (explicitement repoussé)
- Détection automatique de doublons entre documents
- OCR de documents scannés de mauvaise qualité (V1 suppose des PDF/DOCX texte natif ou
  bien scannés ; l'OCR avancé est une amélioration V2)

---

## Module 2 — Espace client

### Objectif business
Remplacer les échanges email dispersés par un espace structuré où Sandrine et le client
(ASSAD BENOIT puis les suivants) voient la même chose en temps réel.

### Parcours utilisateur

**Côté cabinet (Sandrine) :**
1. Crée un établissement (raison sociale, FINESS, type SAD Aide/Mixte, adresse, contacts)
2. Invite un ou plusieurs interlocuteurs côté client (email + rôle : Directeur,
   Coordinateur, Assistant qualité...)
3. Voit le **tableau de bord** de l'établissement : statut global, % de checklist
   complétée, liste des documents par statut

**Côté client (ex : Tania Leborgne, Directrice ASSAD BENOIT) :**
1. Se connecte à son espace établissement (accès cloisonné — ne voit que son propre
   établissement, jamais les autres clients d'EODA)
2. Voit la **checklist des pièces attendues**, organisée par catégorie (loi 2002-2,
   fonctionnement, qualité/risques, RH — voir `context/03-documents-obligatoires.md`)
3. Dépose les documents directement dans la bonne catégorie
4. Voit en temps réel le statut de chaque document (manquant / déposé / en analyse /
   incomplet / conforme)
5. Peut consulter les suggestions de correction du Module 1 sur ses propres documents

### Tableau de bord (vue Sandrine, multi-client à terme)

Indicateurs simples V1 :
- Nombre d'établissements actifs
- Par établissement : % checklist complète, nombre de critères impératifs à risque
  (alimenté dès que le Module 3 existe — sinon masquer ce bloc), date de dernière activité
- Liste triable par "le plus urgent" (établissements avec le moins de documents conformes,
  ou échéance d'évaluation HAS la plus proche)

### Règles métier spécifiques

- Un compte client est **rattaché à un seul établissement**. Si une association gère
  plusieurs établissements (cas réel possible), prévoir dès le schéma BDD qu'un compte
  utilisateur puisse être lié à plusieurs établissements (relation many-to-many
  utilisateur↔établissement), même si l'UI V1 n'expose qu'un sélecteur simple.
- Le statut `Bêta-test gratuit` (cas ASSAD BENOIT) doit être un attribut de l'établissement,
  pas un hack côté facturation — pas de logique de facturation en V1 de toute façon, mais
  préparer le champ pour la V2 (tier commercial : Essentiel / Performance / Excellence /
  Bêta-test).

---

## Module 3 — Auto-évaluation HAS

### Objectif business
Remplacer la cotation manuelle des critères sur papier/Excel par un outil guidé qui
fiabilise la cotation et accélère le travail, en particulier sur les critères impératifs.

### Parcours utilisateur

1. Sandrine (ou un collaborateur évaluateur) sélectionne un établissement et un chapitre
   (1, 2 ou 3)
2. Pour chaque thématique → objectif → critère, l'outil :
   - affiche l'intitulé du critère et son niveau (impératif/standard)
   - affiche les E.E. **reformulés en langage clair** (objectif explicite de l'utilisateur :
     "poser les questions reformulées" — pas juste afficher l'intitulé brut du manuel HAS,
     mais une formulation orientée entretien/terrain, à produire avec l'aide d'un LLM en
     s'appuyant sur l'intitulé officiel + les "documents & preuves attendus" déjà rédigés
     dans les fiches `Critère_X_Y_Z.docx` du projet quand elles existent)
   - propose la cotation (1/2/3/4/★/NC/RI selon chapitre)
   - **aide à la pré-cotation** : si des documents du Module 1 sont déjà rattachés à ce
     critère (relation `document_type_criterion`) et que leur statut est `COMPLIANT`, le
     système peut suggérer une cotation provisoire (ex: "documents conformes détectés sur
     ce critère → suggestion 4, à confirmer") — **toujours une suggestion modifiable, jamais
     une cotation automatique appliquée sans validation humaine**
   - permet la saisie d'un commentaire / preuve consultée
3. À la fin d'un chapitre : tableau de bord du chapitre (score moyen, distribution,
   critères impératifs à risque mis en évidence)
4. **Export** : génération d'un fichier structuré reprenant les cotations, dans un format
   compatible import Synaé (à défaut d'API officielle Synaé connue à ce stade — prévoir un
   export CSV/Excel structuré par critère/E.E./cotation/commentaire, le format exact
   d'import Synaé étant à vérifier avec Sandrine au moment du build, cf.
   `specs/03-roadmap-developpement.md` §risques)

### Règles métier spécifiques (reprises de `context/02-referentiel-has.md`)

- RI uniquement proposé pour les critères du Chapitre 1
- NC : avertissement (non bloquant) si le critère est impératif
- ★ compte comme 4 dans tous les calculs de moyenne
- Tout critère impératif coté < 4 doit générer automatiquement une **entrée prioritaire**
  visible dans le tableau de bord établissement (pont fonctionnel vers une future gestion
  de plan d'action — pas nécessairement un module PLAC complet en V1, mais au minimum une
  liste consultable "critères impératifs à traiter")
- Le référentiel (critères, E.E., niveau impératif/standard, rattachement chapitre) est
  **chargé depuis la base de données**, jamais codé en dur dans un composant — voir
  `specs/02-architecture-technique.md` §moteur-regles-has pour le mécanisme de seed/versioning

### Hors périmètre V1 (explicitement repoussé, mais préparé en architecture)
- Génération automatique du "formulaire critère impératif" officiel
- Gestion complète du registre plaintes/EI/EIG comme module dédié (le lien document↔critère
  du Module 1 couvre déjà une partie du besoin de preuve sur ces objectifs)
- Reporting Power BI / KPI transverse multi-établissements
- Pondération de l'objectif 3.10 à 10% dans le score global (cf. spécificité Qualiscope) —
  V1 utilise une moyenne simple, mais le `ScoringService` doit être conçu pour accepter une
  table de pondération par objectif sans réécriture (Open/Closed)

---

## Articulation entre les 3 modules (pourquoi l'ordre de build compte)

```
Établissement (entité pivot)
   │
   ├── Module 2 : Documents déposés, catégorisés par type
   │        │
   │        └── (relation document_type ↔ criterion)
   │                  │
   ├── Module 1 : Analyse de ces documents → statuts, suggestions
   │                  │
   └── Module 3 : Cotation des critères, peut s'appuyer sur le statut
            des documents rattachés pour suggérer une pré-cotation
```

Le Module 2 (établissement + documents + checklist) est en réalité un **prérequis
structurel** du Module 1 (on ne peut pas analyser un document sans établissement ni
catégorie). C'est pourquoi l'ordre de développement réel (voir
`specs/03-roadmap-developpement.md`) commence par les fondations communes
(établissement, auth, upload, checklist) avant de brancher l'intelligence d'analyse —
même si la valeur perçue prioritaire pour Sandrine est l'analyse documentaire.
