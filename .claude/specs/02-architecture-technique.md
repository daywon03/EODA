# Architecture technique

## 1. Stack — choix et justification (ADR condensés)

| Couche | Choix | Pourquoi |
|---|---|---|
| Framework full-stack | **Next.js 14+ (App Router)**, TypeScript strict | Un seul déploiement pour front + API en V1, écosystème mature, migration facile vers un backend séparé plus tard si la charge LLM/analyse devient lourde (voir §évolutivité) |
| UI | **Tailwind CSS + shadcn/ui** | Composants accessibles, personnalisables à la charte EODA sans surcharge ; cohérent avec le style déjà produit dans les prototypes HTML |
| ORM / BDD | **Prisma + PostgreSQL** | Migrations versionnées, types générés, relationnel adapté à un référentiel hiérarchique (chapitre→thématique→objectif→critère→E.E.) |
| Auth | **Auth.js (NextAuth)** | Gère nativement multi-rôles (Cabinet / Client), sessions, OAuth si besoin futur (connexion via Google Workspace par ex.) |
| Stockage fichiers | **S3-compatible, hébergé Europe** (Scaleway Object Storage ou OVHcloud Object Storage) | Contrainte RGPD non négociable — jamais de bucket US par défaut |
| File d'attente / jobs asynchrones | **BullMQ + Redis** (ou Inngest si on veut du serverless managé) | L'analyse documentaire (extraction + appel LLM) ne doit pas bloquer la requête HTTP d'upload — job asynchrone obligatoire dès le départ |
| Extraction de texte | `pdf-parse` (PDF), `mammoth` (DOCX) | Légers, suffisants pour du texte natif ; OCR avancé explicitement hors V1 |
| Analyse IA | **Anthropic Claude API**, appelée via une interface `LLMAnalysisPort` (jamais le SDK directement dans le code métier) | Permet de changer de fournisseur sans toucher au métier (Dependency Inversion) |
| Hébergement app | **Prisma Compute** *(écart au plan initial, voir note ADR ci-dessous)* | Déploiement managé, intégré au monorepo (`prisma.compute.ts`), CI/CD automatique sur push |
| Hébergement BDD | **Prisma Postgres, région `eu-west-3`** *(écart au plan initial : Postgres managé plutôt que self-hosted Scaleway/OVHcloud)* | Contrainte Europe respectée (région confirmée) ; migrations Prisma inchangées |
| Stockage fichiers (réel) | **Scaleway ou OVHcloud (France)** — code prêt (`S3StorageAdapter`), pas encore connecté en prod (voir `specs/03-roadmap-developpement.md` Jalon 2) | Contrainte Europe + données de santé/social |
| Monorepo | `pnpm` workspace, structure simple (`apps/web`, `packages/database`, `packages/has-referential`) | Pas de sur-ingénierie ; juste assez de séparation pour isoler le référentiel HAS comme package réutilisable |

### Note ADR — écart d'hébergement par rapport au plan initial (2026-07-07)

Le plan initial prévoyait un hébergement self-managed Scaleway/OVHcloud pour l'app **et**
la BDD dès le Jalon 0. En pratique, le build a été fait avec **Prisma Postgres** (BDD
managée) et **Prisma Compute** (hébergement app, actuellement en beta publique gratuite) —
plus rapide à mettre en place pour valider le socle technique tôt. Le stockage fichiers
(S3-compatible) reste prévu sur Scaleway/OVHcloud conformément au plan initial, mais n'est
pas encore branché en prod (LocalFs en fallback).

✅ **Point de vigilance résolu (2026-07-07)** : la région de calcul Prisma Compute était
initialement hors Europe par défaut (région US) pour l'app de production — corrigé en
redéployant explicitement l'app avec `--region eu-west-3` (Paris). Vérifié fonctionnel
(connexion testée en conditions réelles après migration). Prisma Compute propose les
régions Europe `eu-west-3` (Paris) et `eu-central-1` (Frankfurt) via le flag `--region` du
CLI (`prisma-cli app deploy --region eu-west-3`) — à repréciser explicitement à chaque
nouvelle app créée sur ce projet, car **une app existante garde sa région, impossible à
changer sans redéployer une nouvelle instance**.

- Production (`main`) : app + BDD (`Primary database`) confirmées `eu-west-3`.
- Preview (`develop`) : app + nouvelle BDD dédiée `eoda-staging` confirmées `eu-west-3`.
- ⚠️ Reste en base une ancienne BDD `develop` orpheline en région `us-east-1`
  (`db_cmrafju13018xyuez4mwbtljl`, créée automatiquement à la création de la branche, jamais
  câblée à aucune variable d'environnement) — non supprimée par prudence (action
  destructive), à nettoyer manuellement via le dashboard Prisma ou
  `prisma-cli database remove` après confirmation qu'elle est bien inutilisée.

### Pourquoi pas une stack "no-code" ou un simple SaaS Airtable-like ?

Les données traitées (informations sur des personnes accompagnées potentiellement
vulnérables, documents RGPD-sensibles) et le besoin d'un moteur de règles HAS évolutif
(critères impératifs qui varient selon le profil ESSMS, pondérations à venir) demandent
un contrôle fin du modèle de données et de la logique métier que les outils no-code ne
permettent pas de garantir avec la rigueur RGPD attendue. Le choix Next.js + Postgres est
le point d'équilibre entre vitesse de développement et contrôle.

## 2. Schéma de base de données (V1)

```
Établissement (cœur du système)
─────────────────────────────────
Tenant (Cabinet)
  id, name, created_at
  └── ex : "EODA Conseil" — table prévue dès V1 mais avec 1 seule ligne en pratique ;
      permet une éventuelle V2 multi-cabinet sans migration de schéma cassante

Establishment (Établissement / SAD client)
  id
  tenant_id            FK → Tenant
  name                  -- ex: "ASSAD BENOIT"
  finess_number         -- ex: "930034459"
  type                  -- enum: 'SAD_AIDE' | 'SAD_MIXTE'
  address
  commercial_tier        -- enum: 'BETA' | 'ESSENTIEL' | 'PERFORMANCE' | 'EXCELLENCE'
  has_evaluation_target_date  -- date cible évaluation HAS officielle
  created_at, updated_at

User
  id
  tenant_id             FK → Tenant, nullable (null pour un user côté client pur)
  email, name
  role                  -- enum: 'CABINET_ADMIN' | 'CABINET_EVALUATOR' | 'CLIENT_USER'
  created_at

EstablishmentUser (table de jointure many-to-many)
  user_id               FK → User
  establishment_id      FK → Establishment
  role_in_establishment -- enum: 'DIRECTEUR' | 'COORDINATEUR' | 'ASSISTANT_QUALITE' | 'AUTRE'

─────────────────────────────────
Référentiel HAS (chargé en seed, jamais modifié à la main en prod)
─────────────────────────────────
HasReferentialVersion
  id, label             -- ex: "Manuel HAS juillet 2025"
  effective_date
  -- permet de versionner le référentiel dans le temps (Open/Closed sur évolution HAS)

Chapter
  id, referential_version_id  FK
  number                -- 1, 2 ou 3
  name                  -- "La personne" / "Les professionnels" / "L'ESSMS"
  method                -- "Accompagné traceur" / "Traceur ciblé" / "Audit système"

Theme (Thématique)
  id, chapter_id        FK
  name                  -- ex: "Bientraitance et éthique"

Objective (Objectif)
  id, theme_id          FK
  code                  -- ex: "2.2"
  weight_percent         -- nullable, pour pondération future (ex: Objectif 3.10 = 10%)

Criterion (Critère)
  id, objective_id      FK
  code                  -- ex: "2.2.7"
  label
  requirement_level     -- enum: 'IMPERATIF' | 'STANDARD'
  applicable_to          -- enum: 'SAD_AIDE' | 'SAD_MIXTE' | 'BOTH'
  -- applicable_to permet de calculer dynamiquement la liste des 16 vs 17 critères
  -- impératifs selon le profil de l'établissement, jamais un nombre hardcodé

EvaluationElement (E.E.)
  id, criterion_id      FK
  original_text         -- intitulé officiel HAS
  reformulated_text     -- reformulation langage clair pour l'entretien (Module 3)
  allows_ri             -- boolean, true uniquement si chapter.number == 1

─────────────────────────────────
Module 1 & 2 — Documents
─────────────────────────────────
DocumentType (catalogue de référence, seed depuis context/03-documents-obligatoires.md)
  id
  code                  -- ex: "L2002_DIPC", "P13_FICHE_DECLARATION"
  category              -- enum: 'LOI_2002_2' | 'FONCTIONNEMENT' | 'QUALITE_RISQUES' | 'RH'
  label
  is_conditional         -- boolean, true pour les documents "si concerné"
  expected_frequency     -- nullable, ex: "ANNUAL" pour les CR CVS / DIPC révisé

DocumentTypeCriterion (table de jointure many-to-many)
  document_type_id      FK → DocumentType
  criterion_id          FK → Criterion
  -- pont central entre Module 1/2 et Module 3

Document (instance réelle déposée par un établissement)
  id
  establishment_id      FK → Establishment
  document_type_id      FK → DocumentType, nullable tant que non catégorisé
  current_version_id    FK → DocumentVersion, nullable
  status                -- enum: 'MISSING' | 'UPLOADED' | 'ANALYZING' | 'INCOMPLETE'
                          --       | 'COMPLIANT' | 'EXPIRED' | 'NOT_APPLICABLE'
  status_overridden_by_user  -- boolean, true si Sandrine a forcé manuellement le statut
  created_at, updated_at

DocumentVersion
  id
  document_id           FK → Document
  version_number
  file_storage_key       -- clé S3
  original_filename
  uploaded_by_user_id    FK → User
  uploaded_at
  extracted_text         -- texte extrait, nullable jusqu'à traitement
  analysis_result_json    -- résultat structuré du LLM (manques, suggestions)
  regenerated_from_version_id  -- nullable, FK vers la version dont celle-ci corrige les manques

─────────────────────────────────
Module 3 — Auto-évaluation
─────────────────────────────────
EvaluationSession
  id
  establishment_id      FK → Establishment
  chapter_id             FK → Chapter
  started_at, finished_at
  duration_seconds        -- alimenté par le minuteur
  performed_by_user_id    FK → User

ElementRating (cotation d'un E.E. dans une session donnée)
  id
  evaluation_session_id FK → EvaluationSession
  evaluation_element_id FK → EvaluationElement
  rating                -- enum: '1' | '2' | '3' | '4' | 'STAR' | 'NC' | 'RI'
  comment                -- texte libre, preuve consultée
  suggested_by_system     -- boolean, true si pré-coté automatiquement (Module 1 → 3)
  confirmed_by_user        -- boolean, false tant que l'utilisateur n'a pas validé une suggestion
  rated_at
```

### Notes de conception importantes

- **`Criterion.applicable_to`** est la mécanique qui évite de hardcoder "16 critères
  impératifs" ou "17" n'importe où dans le code — toujours dériver la liste par requête
  filtrée sur `requirement_level = IMPERATIF AND applicable_to IN (BOTH, establishment.type)`.
- **`DocumentTypeCriterion`** est la table qui rend le pont Module1↔Module3 possible sans
  dupliquer la donnée — un même document (ex: registre des plaintes) peut couvrir
  plusieurs critères impératifs (3.12.1, 3.12.2, 3.12.3).
- **`status_overridden_by_user`** trace explicitement qu'un statut a été forcé par un
  humain plutôt que calculé par le système — important pour la confiance dans l'outil et
  pour un futur audit de fiabilité du module d'analyse.
- **`HasReferentialVersion`** existe dès la V1 même s'il n'y a qu'une seule version
  "juillet 2025" en base, pour ne jamais avoir à migrer le schéma quand la HAS publiera
  une mise à jour du manuel.

## 3. Services métier (séparation des responsabilités — SRP)

```
DocumentAnalysisService
  - extractText(documentVersion): string
  - analyzeAgainstRequirements(text, documentType, linkedCriteria): AnalysisResult
  - ne fait QUE l'analyse de contenu — ne décide pas du statut final ni de la catégorisation

DocumentCategorizationService
  - suggestDocumentType(filename, extractedTextSample): DocumentType
  - séparé du service d'analyse : catégoriser ≠ analyser le contenu en profondeur

DocumentStatusService
  - computeStatus(document, analysisResult): DocumentStatus
  - centralise la logique de statut (MISSING/UPLOADED/INCOMPLETE/COMPLIANT/EXPIRED) —
    un seul endroit pour cette règle, jamais recalculée en plusieurs points de l'UI

DocumentRegenerationService
  - regenerateCorrectedVersion(documentVersion, analysisResult): DocumentVersion
  - dépend de DocumentAnalysisService mais pas l'inverse (sens de dépendance clair)

ScoringService (Module 3)
  - computeElementScore / computeCriterionScore / computeObjectiveScore /
    computeChapterScore / computeGlobalScore
  - implémente les règles : ★=4, NC/RI exclus, pondération optionnelle par objectif
  - aucune connaissance de l'UI ni de la BDD directement — pur calcul, testable
    unitairement avec des fixtures simples

PreRatingSuggestionService (Module 3, pont avec Module 1)
  - suggestRatingFromDocuments(criterion, establishmentDocuments): RatingSuggestion | null
  - isolé du ScoringService — une suggestion n'est jamais appliquée automatiquement,
    toujours retournée à l'UI pour confirmation humaine

LLMAnalysisPort (interface, Dependency Inversion)
  - analyze(prompt: StructuredPrompt): LLMAnalysisResult
  - implémentation concrète : AnthropicLLMAdapter
  - le métier appelle l'interface, jamais le SDK Anthropic directement
```

## 4. Sécurité & RGPD (contraintes transverses)

- **Cloisonnement strict par établissement** : toute requête côté Module 1/2/3 doit être
  scopée par `establishment_id`, vérifié côté serveur (jamais une confiance au filtrage
  côté client). Prévoir un middleware ou un helper Prisma (`withEstablishmentScope`) plutôt
  que de répéter le filtre dans chaque requête à la main — risque d'oubli sinon.
- **Chiffrement at-rest** sur le bucket de stockage de fichiers (capacité native
  Scaleway/OVHcloud à activer).
- **Anonymisation avant appel LLM externe** : tout texte extrait d'un document contenant
  potentiellement des données personnelles d'une personne accompagnée doit passer par une
  étape de détection/masquage de motifs nominatifs basique avant l'appel au
  `LLMAnalysisPort`, a minima en V1 (regex sur motifs nom/prénom déclarés dans un en-tête
  de document, ou métadonnée explicite côté utilisateur "ce document contient des données
  personnelles, les masquer avant analyse").
- **Logs d'accès** aux documents (qui a consulté/téléchargé quoi, quand) — table d'audit
  minimale dès V1, même basique, car le secteur médico-social est sensible aux contrôles.

## 5. Préparation explicite de l'évolutivité (sans la construire maintenant)

| Besoin futur | Ce qu'on fait maintenant pour ne pas se bloquer |
|---|---|
| Gestion EI/EIG, plaintes/réclamations comme modules dédiés | `DocumentTypeCriterion` couvre déjà le lien preuve↔critère ; le futur module ajoutera des tables `IncidentReport` / `Complaint` sans toucher au noyau existant |
| Export Synaé natif | Le schéma `ElementRating` est déjà structuré 1:1 avec l'unité de cotation Synaé (E.E.) — un export job dédié pourra sérialiser sans remodeler la donnée |
| Reporting KPI / Power BI | Toutes les tables transactionnelles (`Document`, `ElementRating`, `EvaluationSession`) ont des timestamps exploitables ; prévoir un schéma de lecture séparé (vue SQL ou réplique) plutôt que de faire taper le reporting directement sur les tables transactionnelles |
| Multi-cabinet | `Tenant` existe dès V1 même avec une seule ligne |
| Pondération du score (objectif 3.10 à 10%) | `Objective.weight_percent` existe dès le schéma V1, `ScoringService` doit lire cette colonne plutôt que faire une moyenne arithmétique fixe en dur |
