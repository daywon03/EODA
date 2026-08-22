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
| Hébergement app | **Vercel, région `cdg1` (Paris)** *(écart au plan initial, voir note ADR ci-dessous)* | Déploiement piloté par `vercel.json` à la racine (commande de build workspace) ; remplace Prisma Compute depuis le 21/08/2026 |
| Hébergement BDD | **Supabase PostgreSQL, région `aws-0-eu-west-1` (Irlande)** *(écart au plan initial : Postgres managé plutôt que self-hosted Scaleway/OVHcloud)* | Contrainte Europe respectée ; remplace Prisma Postgres (`pooled.db.prisma.io`, `eu-west-3`) depuis le 21/08/2026 — les 13 migrations et le seed y sont appliqués, parcours d'onboarding vérifié de bout en bout ; migrations Prisma inchangées |
| Stockage fichiers (réel) | **Supabase Storage (S3-compatible, même projet que la BDD)** — code prêt (`S3StorageAdapter`), pas encore provisionné : aucune variable `S3_*` n'existe (voir `specs/03-roadmap-developpement.md` Jalon 5) | Contrainte Europe + données de santé/social ; base et documents chez un même fournisseur européen |
| Monorepo | `pnpm` workspace, structure simple (`apps/web`, `packages/database`, `packages/has-referential`) | Pas de sur-ingénierie ; juste assez de séparation pour isoler le référentiel HAS comme package réutilisable |

### Note ADR — écart d'hébergement par rapport au plan initial (mis à jour 2026-08-21)

Le plan initial prévoyait un hébergement self-managed Scaleway/OVHcloud pour l'app **et**
la BDD dès le Jalon 0. Le socle a d'abord été construit sur **Prisma Postgres** + **Prisma
Compute** (2026-07-07), plus rapide à mettre en place pour valider l'architecture tôt.
Depuis le **21/08/2026**, décision de Damon : la BDD est **Supabase PostgreSQL**
(`aws-0-eu-west-1`, Irlande) et l'app est déployée sur **Vercel** (`cdg1`, Paris).
`prisma.compute.ts` est désormais du legacy.

`CLAUDE.md` §6 nomme Scaleway ou OVHcloud comme contrainte non négociable. La contrainte qui
compte réellement est l'**hébergement en Europe** : Supabase `eu-west-1` (Irlande) et Vercel
`cdg1` (Paris) la satisfont sur la localisation des données et du calcul. Vercel et Supabase
restent des sociétés américaines ; c'est une décision produit de Damon, pas une conformité
acquise, et elle est à réexaminer avant de traiter de vraies données clients en volume.

**Pourquoi Supabase Storage pour les fichiers** : la base et les documents vivent chez le
même fournisseur, dans le même projet et la même région, ce qui évite un troisième
fournisseur à auditer. Non provisionné à ce jour — aucun bucket, aucune clé d'accès S3, donc
les cinq variables `S3_*` sont absentes et le point bloquant stockage reste ouvert.

**Piège rencontré le 21/08/2026 — à ne pas reproduire** : `apps/web/.env.local` et
`packages/database/.env` décrivaient chacun une base différente de celle du `.env.local`
racine ; l'application tournait silencieusement sur une autre base que celle que la
documentation décrivait. Les deux fichiers sont maintenant des **liens symboliques** vers le
`.env.local` de la racine — une seule source de vérité, jamais de divergence.

**Reliquats Prisma à nettoyer** : les bases Prisma Postgres (`Primary database`,
`eoda-staging` en `eu-west-3`, et l'ancienne base `develop` orpheline en `us-east-1`,
`db_cmrafju13018xyuez4mwbtljl`) ne sont plus câblées à aucune variable d'environnement. À
supprimer manuellement via le dashboard Prisma après confirmation qu'elles sont inutilisées
(action destructive).

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

### État réel des services (2026-08-19)

| Prévu ci-dessus | Fichier réel | État |
|---|---|---|
| `DocumentAnalysisService` | `llm/anthropic-analysis-adapter.ts` (derrière `LLMAnalysisPort`) | ✅ |
| `DocumentCategorizationService` | `services/document-categorization-service.ts` | ✅ heuristique mots-clés, sans LLM |
| `DocumentStatusService` | `services/document-status-service.ts` | ✅ |
| `DocumentRegenerationService` | — | ❌ non construit (gap connu, cf. roadmap Jalon 3) |
| `ScoringService` | `services/scoring-service.ts` | ✅ testé unitairement |
| `PreRatingSuggestionService` | `services/pre-rating-suggestion-service.ts` | ✅ |
| `LLMAnalysisPort` | `llm/llm-analysis-port.ts` | ✅ |
| — (ajouté) | `services/document-ingestion-service.ts` | ✅ orchestration du dépôt (versioning → stockage → analyse), ports injectés |
| — (ajouté) | `services/offer-scope-service.ts` | ✅ périmètre des 3 offres |
| — (ajouté) | `services/mission-progress-service.ts` | ✅ avancement de mission |
| — (ajouté) | `services/audit-log-service.ts` | ✅ journal d'audit |
| — (ajouté) | `security/upload-validation-service.ts` | ✅ signature binaire + clé de stockage |
| — (ajouté) | `security/rate-limiter-port.ts` + `in-memory-rate-limiter.ts` | ✅ port + adaptateur |

**Règle de répartition action / service**, à respecter pour toute nouvelle action serveur :
l'action fait l'autorisation, la lecture du `FormData`, la validation et l'invalidation de
cache ; le service fait la séquence métier et reçoit ses dépendances externes par port. Une
action qui dépasse ~60 lignes fait probablement le travail d'un service.

**Ports (Dependency Inversion) — 4 aujourd'hui** : `FileStoragePort`, `LLMAnalysisPort`,
`EmailPort`, `RateLimiterPort`. Chacun avec un adaptateur réel et un adaptateur de repli dev,
sélectionnés par variables d'environnement, avec échec explicite au démarrage en production
si la configuration réelle manque. Le journal d'audit n'a volontairement **pas** de port :
la persistance se fait dans notre propre base, il n'y a pas de fournisseur externe à pouvoir
remplacer — l'abstraction serait de la cérémonie.

### Tests

`pnpm test` (vitest) — 70 tests sur les services purs uniquement : moteur de cotation HAS
(★=4, NC/RI exclus du dénominateur, RI Chapitre 1, avertissement NC sur impératif),
périmètre des offres, verrouillage des phases 3/4, avancement 50/50, validation des fichiers
déposés (traversée de chemin, signature binaire), parseurs d'entrée. Exécutés en CI entre le
lint et le build. Aucune base de données ni appel réseau : c'est précisément ce que la
séparation services / actions rend possible.

## 4. Sécurité & RGPD (contraintes transverses)

> **État au 2026-08-19** : les points ci-dessous sont implémentés, sauf mention contraire.
> L'audit qui a conduit à cette section a trouvé que la recommandation initiale (« prévoir
> un helper plutôt que répéter le filtre à la main — risque d'oubli sinon ») n'avait pas été
> suivie, et que le risque annoncé s'était matérialisé : plusieurs actions vérifiaient la
> session sans vérifier l'appartenance de l'objet visé. À relire avant d'ajouter une action.

### 4.1 Couche d'autorisation unique — `apps/web/src/lib/auth/guards.ts` ✅

**Règle absolue : aucune action serveur ne réimplémente son contrôle d'accès.** Toute action
touchant un établissement passe par une garde de ce fichier :

| Garde | Autorise | Usage |
|---|---|---|
| `requireCabinetSession()` | Cabinet (ADMIN + EVALUATOR), tenant résolu | Espace cabinet non lié à un établissement précis |
| `requireCabinetAdminSession()` | CABINET_ADMIN uniquement | Pipeline commercial (prospects/devis/catalogue) |
| `requireEstablishmentInTenant(id)` | Cabinet **+** établissement du même tenant | Dès qu'un `establishmentId` vient de la requête |
| `requireEstablishmentAccess(id)` | Client via `EstablishmentUser` **ou** Cabinet via tenant | Actions partagées (dépôt, aperçu, checklist) |
| `tryEstablishmentAccess(id)` | Idem, mais renvoie `null` au lieu de rediriger | Actions appelées depuis un composant client |
| `requireClientEstablishment()` | CLIENT_USER, établissement résolu depuis la session | Espace client |

Trois invariants portés par ces gardes :

1. **Fail-closed.** Un compte Cabinet sans `tenantId` n'accède à rien. Le motif
   `if (user.tenantId) where.tenantId = user.tenantId` est **interdit** : un filtre omis
   rend la requête globale.
2. **Révocation immédiate.** Le rôle et le tenant sont relus en base à chaque contrôle, pas
   pris dans le JWT : un compte supprimé ou rétrogradé perd l'accès sans attendre
   l'expiration du jeton.
3. **`notFound()`, jamais `redirect()`,** sur un objet hors périmètre — ne pas révéler qu'un
   identifiant existe dans un autre tenant.

Un `establishmentId`, un `missionId`, un `sessionId` d'évaluation ou un `documentVersionId`
reçu en argument d'action est une **entrée non fiable** : une action serveur est une route
HTTP publique, pas un appel interne protégé par l'UI.

**Couverture de test (2026-08-22).** Ces invariants sont désormais adossés à des cas de refus
plutôt qu'à la relecture — `guards.test.ts` est passé de 3 gardes couvertes sur 8 (43 % des
instructions) à la totalité des gardes exportées, 100 % des lignes. La règle zéro s'applique
ici plus qu'ailleurs : une régression IDOR sur ce fichier serait passée en CI verte. Chaque
garde porte au minimum le cas non authentifié, le cas non autorisé et le cas hors périmètre,
et les tests affirment la **destination** du refus (`/deconnexion`, `notFound()`, `/login`),
pas seulement qu'un refus a eu lieu — c'est la destination qui distingue une révocation
d'une simple redirection, et `notFound()` d'une fuite d'existence.

### 4.2 Validation des entrées — `lib/validation/form-parsers.ts` ✅

Les casts `formData.get("x") as "A" | "B"` ne valident rien à l'exécution. Tout champ passe
par un parseur typé (`requiredEnum` contre l'enum Prisma, `requiredInt` qui rejette NaN,
`requiredDate` qui rejette une date invalide, `requiredEmail` qui normalise la casse).
Champs libres bornés en longueur (saturation stockage et coût de tokens LLM en aval).

### 4.3 Dépôt de fichiers — `lib/security/upload-validation-service.ts` ✅

- **Type réel par signature binaire** (magic bytes PDF / ZIP+`word/`), jamais `File.type`,
  qui est une valeur envoyée par le client.
- **Clé de stockage assainie.** Le nom d'origine n'est jamais concaténé brut dans la clé :
  `../../` y échappait le préfixe établissement. Le nom d'origine reste en base
  (`DocumentVersion.originalFilename`) pour l'affichage et le téléchargement.
- **Confinement au niveau de l'adaptateur** (`LocalFsStorageAdapter`) en défense en
  profondeur — un adaptateur de stockage ne dépend pas de la bonne conduite de son appelant.

### 4.4 Cloisonnement du service de fichiers ✅

`/api/local-storage/[...key]` est **hors du middleware** (`matcher` exclut `/api`) : tout le
contrôle s'y fait explicitement — refus en production, résolution de la clé en
`DocumentVersion` puis contrôle d'habilitation sur l'établissement propriétaire, confinement
du chemin, liste blanche d'extensions, `Cache-Control: private, no-store`.
En production les fichiers sont servis par URL signée S3 (expiration 300 s).

### 4.5 Authentification ✅ — vérifiée en conditions réelles (2026-08-19)

- **Limitation de débit dans `authorize()`**, pas dans l'action serveur. ⚠️ **Défaut trouvé
  et corrigé le jour même** : une première version plaçait le contrôle dans `loginAction`.
  Or `POST /api/auth/callback/credentials` est une route publique joignable directement —
  13 tentatives en `curl` passaient sans jamais être comptées. Le contrôle appartient au
  point où **tous** les chemins convergent, jamais à l'interface qui l'appelle.
  Politique : **deux compteurs**, via `RateLimiterPort`, tous deux consommés par le même
  appel `consumeLoginAttempt({ ip, email })` — l'API prend l'identité et jamais une clé
  déjà construite, pour qu'aucun appelant ne puisse n'en viser qu'un.
  Vérifié de bout en bout : après dépassement, **le bon mot de passe est refusé aussi** ;
  et une autre IP se connecte normalement (pas de déni de service sur un compte nominatif).

  | Compteur | Politique | Ferme |
  |---|---|---|
  | `(IP, email)` | 10 / 15 min | le bourrage de mots de passe sur **un** compte |
  | `IP` seule | 30 / 15 min | le **balayage** sur beaucoup de comptes |

  ⚠️ **Second défaut, trouvé et corrigé le 2026-08-22** : le compteur du couple laissait
  passer intégralement le balayage (« password spraying ») — changer d'email remettait son
  compteur à zéro, donc une IP pouvait essayer 10 mots de passe par compte, sur autant de
  comptes qu'elle voulait. Nos adresses de connexion étant des adresses de contact
  publiques (annuaire FINESS), c'était le scénario le plus réaliste. Le plafond par IP est
  volontairement large (30) : une IP peut être le NAT d'une association entière, et une
  limite serrée y deviendrait un déni de service. Invariant à ne pas « simplifier » : une
  connexion réussie remet à zéro le compteur du couple, **jamais celui de l'IP** — sinon un
  attaquant détenant un seul compte valide s'en sert comme bouton de remise à zéro entre
  deux séries. Verrouillé par `lib/security/login-throttle.test.ts` (les trois tests de
  balayage échouent si l'on retire le compteur par IP).
- **Pas d'énumération de comptes** : message d'erreur unique, et comparaison bcrypt contre
  une empreinte factice de même coût quand l'email est inconnu — sinon la différence de
  latence distingue « compte inexistant » de « mot de passe faux », malgré un message
  identique.
- **Session** : cookie `authjs.session-token`, vérifié à l'exécution comme
  `HttpOnly; SameSite=Lax; Path=/`, contenu **chiffré** (JWE `dir` / `A256CBC-HS512`, pas
  seulement signé), expiration à 8 h effective, prolongation sur activité (`updateAge` 1 h).
  Le préfixe `__Secure-` et l'attribut `Secure` sont ajoutés automatiquement par Auth.js
  en HTTPS.
- bcrypt coût 12 ; mot de passe temporaire de 16 caractères issus de `randomBytes`, affiché
  une seule fois, jamais journalisé.

#### Décision — pourquoi pas de couple jeton d'accès court / jeton de rafraîchissement

Les règles `S3` et `S10` des conventions d'ingénierie décrivent une architecture **SPA +
API** : jeton d'accès court porté par le client, jeton de rafraîchissement en cookie, et
intercepteur HTTP qui rejoue sur 401. Cette plateforme n'a **aucun jeton côté client** :
c'est du rendu serveur avec Server Actions, la session vit dans un cookie `HttpOnly` que le
code de page ne peut pas lire, et il n'existe pas de client HTTP à intercepter.

Ce que les deux règles visent réellement est donc satisfait autrement :

| Intention de la règle | Comment elle est tenue ici |
|---|---|
| Un jeton exfiltrable par XSS (`S10`) | Aucun jeton lisible par script : cookie `HttpOnly`, contenu chiffré, rien en `localStorage` |
| Fenêtre d'usage courte (`S3`) | Session 8 h, renouvelée sur activité réelle |
| Ne jamais signer l'objet utilisateur complet (`S3`) | Le jeton ne porte que `userId` et `role` |
| Révocation qui prend effet immédiatement (`S3`) | Le rôle **et** le tenant sont relus en base à chaque contrôle d'autorisation (§4.1) : le rôle du jeton ne sert qu'au routage grossier du middleware, qui tourne en Edge et n'a pas la base. Un compte supprimé ou rétrogradé perd l'accès à la requête suivante, pas à l'expiration du jeton |
| Protection CSRF | Jeton CSRF Auth.js + `SameSite=Lax`, qui bloque déjà l'envoi du cookie sur un POST cross-site |

**Alternative écartée** : implémenter le couple accès/rafraîchissement. Cela ajouterait un
jeton manipulé côté client là où il n'y en a aucun aujourd'hui — donc une surface
d'exfiltration nouvelle — pour un gain nul sur les quatre intentions ci-dessus. À
reconsidérer si un client mobile ou une API publique apparaît, cas où `S3`/`S10`
s'appliqueraient pleinement.

### 4.6 En-têtes de sécurité — `next.config.ts` ✅

CSP, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, HSTS en production,
`poweredByHeader: false`. Présence des en-têtes vérifiée à l'exécution sur une réponse réelle
(2026-08-19), pas seulement dans la configuration.
⚠️ **Point ouvert** : la CSP conserve `script-src 'unsafe-inline'`, requis par le script
d'amorçage de Next.js App Router. Le durcir demande une CSP à nonce par requête via le
middleware — chantier distinct.

### 4.7 Anonymisation avant appel LLM externe ✅

`anonymization-service.ts` masque email / téléphone / NIR avant tout envoi au
`LLMAnalysisPort`. Best-effort assumé : ne remplace pas une revue humaine.
Le contenu du document est transmis dans un tour utilisateur distinct des consignes, avec
instruction explicite de le traiter comme donnée et jamais comme instruction (limitation de
l'injection de prompt par document déposé).

### 4.8 Journal d'audit — `AuditLogEntry` + `audit-log-service.ts` ✅

Table append-only, **sans clé étrangère** vers `User`/`Establishment` : un journal ne doit
pas être effacé en cascade avec l'objet qu'il documente (la suppression d'un établissement
est précisément un événement à conserver). Événements couverts : dépôt, téléchargement,
aperçu, réponse Oui/Non sur document manquant, invitation client, suppression
d'établissement, échec de connexion, blocage pour dépassement de tentatives.
Écriture non bloquante — un échec de journalisation ne fait jamais échouer l'action métier.
Jamais de donnée personnelle dans `detail` (codes de type de document, motifs techniques).

### 4.9 Reste à faire

- [ ] **Chiffrement at-rest du bucket** — à activer côté Supabase Storage ; le bucket réel
  n'est toujours pas provisionné (`S3_*` absentes), donc rien de sensible ne doit être déposé en
  production avant.
- [ ] **CSP à nonce** (cf. §4.6).
- [ ] **Compteur de débit partagé** si l'application passe à plusieurs instances (§4.5).
- [ ] **Purge/rétention du journal d'audit** — durée de conservation à arrêter avec Sandrine
  (RGPD : la traçabilité doit être bornée, pas éternelle).
- [x] **Rotation du mot de passe temporaire** — faite, cf. §4.10.
- [x] **Chaîne d'application mécanique des règles** — lint type-aware (`no-floating-promises`
  & co. en error), `no-console`, `no-explicit-any`, interdiction de lire `process.env` hors du
  module de configuration, seuils de couverture qui font échouer la commande, gitleaks en
  pre-commit et en CI, audit de dépendances, typecheck sur les deux packages. Tableau complet
  dans `CLAUDE.md` §0. Migration de `next lint` (déprécié) vers l'ESLint CLI faite — le CLI
  lint aussi les fichiers de configuration que `next lint` ignorait.
- [x] **Vulnérabilités de dépendances** — `next-auth` et `@auth/core` étaient sous avis
  **critique** ; corrigé (`next-auth` 5.0.0-beta.32, `next` 15.5.23), transitives réglées par
  `pnpm.overrides`. Seule exception restante : `xlsx`, sans version corrigée publiée, déclarée
  nominativement dans `pnpm.auditConfig.ignoreGhsas` avec justification (cf. `CLAUDE.md` §0).

### 4.10 Rotation du mot de passe ✅ (2026-08-20)

Le défaut fermé : `inviteClientUser` générait un mot de passe temporaire de 16 caractères,
l'affichait une fois, et c'était le mot de passe du compte **pour toujours**. Un compte remis
en septembre gardait un secret transmis de vive voix ou dans une fenêtre de discussion.

- `User.mustChangePassword` (défaut **`true`** — fail-closed) et `User.passwordChangedAt`,
  migration écrite à la main `20260820120000_password_rotation` avec backfill : les comptes
  Cabinet existants sont exemptés (ils ont choisi leur mot de passe), les `CLIENT_USER`
  existants sont marqués comme devant tourner — c'est précisément le trou qu'on ferme.
- **Enforcement dans la couche d'autorisation, pas dans les pages.** `lib/auth/guards.ts`
  relisait déjà rôle et tenant en base à chaque contrôle ; il relit maintenant aussi ces deux
  colonnes. Un compte marqué n'atteint **aucune** route authentifiée hors
  `/changer-mot-de-passe`. Le middleware porte le même contrôle en version grossière (jeton,
  Edge, sans base) pour couvrir les routes qui ne passent pas par une garde.
- **Invalidation des sessions concurrentes — réellement, malgré une stratégie JWT.** Le jeton
  porte `authAt`, posé une seule fois à la connexion et conservé par Auth.js lors des
  réémissions sur activité. Une session dont `authAt` est antérieur à `passwordChangedAt`
  appartient à l'avant du changement : les gardes la refusent, y compris sur un autre
  appareil. C'est la seule invalidation possible sans table de sessions, et elle est fiable
  parce que `authAt` — contrairement à `iat` — ne bouge pas au rafraîchissement.
- **Déconnexion par route handler** (`/deconnexion`), jamais par `redirect("/login")` depuis
  une garde : un composant serveur ne peut pas supprimer un cookie, et rediriger en laissant
  le cookie posé produit une boucle middleware ⇄ garde.
- Politique : 12 caractères minimum, plafond à 72 **octets** (au-delà bcrypt tronque
  silencieusement), mot de passe courant exigé, réutilisation refusée, bcrypt coût 12 —
  identique à `auth.ts`. Longueur plutôt que composition (ANSSI / NIST SP 800-63B).
- Limitation de débit dédiée (5 / 15 min sur `(IP, userId)`) : l'action est un oracle de
  vérification du mot de passe courant pour une session volée. Compteur mutualisé avec la
  connexion via `lib/security/attempt-throttle.ts`.
- Journal d'audit : `PASSWORD_CHANGED`, `PASSWORD_CHANGE_FAILED`,
  `PASSWORD_CHANGE_RATE_LIMITED`. Aucun mot de passe, aucune donnée personnelle dans `detail`
  (vérifié par test).

### 4.11 Validation de la configuration au démarrage ✅ (2026-08-20)

Le défaut fermé : `getEnv()` valide paresseusement, et trois refus indépendants
(`lib/storage/index.ts`, `lib/llm/index.ts`, `lib/email/index.ts`) décidaient chacun au
premier appel réel si le service était utilisable. Un déploiement sans `S3_*` démarrait vert,
servait les pages, et n'échouait qu'au premier dépôt de document — devant le client.

- `src/instrumentation.ts` (`register()`, une fois par démarrage, runtime Node uniquement)
  appelle `lib/config/startup-check.ts`.
- En production : `S3_*` complet, `ANTHROPIC_API_KEY`, `NEXTAUTH_URL` en `https://`,
  `AUTH_SECRET` ≥ 32 caractères. Tous les problèmes sont rapportés d'un coup, puis
  `process.exit(1)`.
  **Pourquoi sortir plutôt que lever** : vérifié sur l'artefact standalone, une exception
  levée depuis `register()` laisse Next.js annoncer « Ready » puis échouer en
  `unhandledRejection` — un processus à moitié vivant, c'est-à-dire exactement l'état qu'on
  veut éviter.
- Le profil de production est une **fonction pure** (`lib/config/production-profile.ts`),
  testée sans toucher à `process.env`.
- Le développement n'est pas dégradé : le repli disque local et l'adaptateur stub continuent
  de fonctionner à l'identique. La validation du profil ne s'applique qu'en production, et
  est désactivée pendant `next build` (qui tourne avec `NODE_ENV=production` sur une machine
  de CI sans secrets — discriminée par `NEXT_PHASE`).

### 4.12 Migrations appliquées au déploiement ✅ (2026-08-20)

- `pnpm db:migrate:deploy` ne tournait que dans la CI, contre une base jetable. Rien
  n'appliquait les migrations à la vraie base : c'était une étape manuelle que personne
  n'avait écrite.
- La détection automatique de schéma du SDK Prisma Compute (`detectAppSchema`) descend depuis
  `root` (`apps/web`) et ne trouve donc **pas** `packages/database/prisma/schema.prisma`. Le
  contrat `ComputeAppConfig` n'expose ni hook `prebuild` ni hook `release` : `build.command`
  est le seul point d'accroche. `prisma.compute.ts` y enchaîne `generate`,
  `migrate deploy`, `next build`. Un déploiement dont la migration échoue échoue au build.
- Au démarrage, l'application compare le manifeste `EXPECTED_MIGRATIONS`
  (`packages/database/src/migrations.ts`) à la table `_prisma_migrations` et **journalise une
  erreur unique et complète** si le schéma est en retard ou incohérent. Non bloquant
  volontairement : une base injoignable une fraction de seconde ne doit pas empêcher
  l'instance de se lever, et une base « en avance » (retour arrière applicatif) est légitime.
- La duplication entre le manifeste et le dossier `prisma/migrations` est tenue
  mécaniquement par `apps/web/src/lib/db/migration-manifest.test.ts` (règle zéro).
- *(Depuis le 21/08/2026, c'est la commande de build de `vercel.json` qui porte cet
  enchaînement ; `prisma.compute.ts` est conservé en legacy.)*

## 5. Préparation explicite de l'évolutivité (sans la construire maintenant)

| Besoin futur | Ce qu'on fait maintenant pour ne pas se bloquer |
|---|---|
| Gestion EI/EIG, plaintes/réclamations comme modules dédiés | `DocumentTypeCriterion` couvre déjà le lien preuve↔critère ; le futur module ajoutera des tables `IncidentReport` / `Complaint` sans toucher au noyau existant |
| Export Synaé natif | Le schéma `ElementRating` est déjà structuré 1:1 avec l'unité de cotation Synaé (E.E.) — un export job dédié pourra sérialiser sans remodeler la donnée |
| Reporting KPI / Power BI | Toutes les tables transactionnelles (`Document`, `ElementRating`, `EvaluationSession`) ont des timestamps exploitables ; prévoir un schéma de lecture séparé (vue SQL ou réplique) plutôt que de faire taper le reporting directement sur les tables transactionnelles |
| Multi-cabinet | `Tenant` existe dès V1 même avec une seule ligne |
| Pondération du score (objectif 3.10 à 10%) | `Objective.weight_percent` existe dès le schéma V1, `ScoringService` doit lire cette colonne plutôt que faire une moyenne arithmétique fixe en dur |
