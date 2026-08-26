# Roadmap de développement — ordre exact à suivre

> Principe directeur : la valeur perçue prioritaire par Sandrine est l'**analyse
> documentaire**, mais elle a une dépendance structurelle sur les fondations (auth,
> établissement, upload). On construit donc les fondations vite et sobrement, puis on
> accélère sur l'analyse dès qu'elles sont posées — pas l'inverse.

## Jalon 0 — Socle technique (1 à 2 jours de build) — ✅ FAIT (2026-07-07)

- [x] Init monorepo pnpm, Next.js 15 App Router, TypeScript strict, Tailwind, shadcn/ui
- [x] Prisma + PostgreSQL — **écart au plan initial** : au lieu d'un Postgres local via
  docker-compose comme unique environnement, la BDD réelle est **Prisma Postgres**
  (managé, région `eu-west-3`), avec un Postgres local en fallback dev uniquement
  (`docker-compose.yml`, port 5544 en local sur ce poste pour éviter un conflit avec des
  Postgres natifs déjà installés). Voir `specs/02-architecture-technique.md` §1 pour l'ADR
  mis à jour et le point de vigilance associé.
- [x] Auth.js avec 2 rôles minimum fonctionnels : `CABINET_ADMIN`, `CLIENT_USER`
- [x] Déploiement — **écart au plan initial** : hébergé sur **Prisma Compute** (plateforme
  de déploiement managée par Prisma, actuellement en beta publique gratuite) plutôt que
  directement sur Scaleway/OVHcloud. ✅ Région Europe **confirmée et corrigée le
  2026-07-07** : l'app de production tournait par défaut hors Europe ; redéployée
  explicitement en `eu-west-3` (Paris) et testée fonctionnelle. Détail dans
  `specs/02-architecture-technique.md` §1 (note ADR).
- [x] Environnement staging — base de données **`eoda-staging`** créée en `eu-west-3`,
  dédiée à la branche `develop`/preview (séparée de la BDD de production), migrée et
  seedée avec les fixtures de test anonymisées. Auth/URL de preview configurées.
- [x] CI basique (lint + typecheck + build) — GitHub Actions (`.github/workflows/ci.yml`)
  + check "Prisma Compute Deploy" à chaque push sur `develop`/`main`

**Definition of done :** ✅ un utilisateur Cabinet peut se connecter, un utilisateur Client
peut se connecter, chacun voit un dashboard correspondant à son rôle (vérifié en conditions
réelles avec les comptes de test `cabinet@eoda-test.local` / `client@eoda-test.local`).

## Jalon 1 — Établissement + Espace client minimal (Module 2, socle) — ✅ FAIT (2026-07-07)

- [x] CRUD Établissement côté Cabinet (création établissement fonctionnelle ; ASSAD BENOIT
  à créer comme premier établissement réel lors de l'onboarding, fixtures de test
  actuellement anonymisées)
- [x] Invitation d'un utilisateur Client rattaché à un établissement (mot de passe
  temporaire généré, affiché une seule fois)
- [x] Seed de `DocumentType` depuis `context/03-documents-obligatoires.md`
- [x] Affichage de la checklist des documents attendus par catégorie, avec statuts

**Definition of done :** ✅ vérifié fonctionnellement (création établissement, invitation,
connexion client, affichage checklist complète).

## Jalon 2 — Upload + catégorisation (Module 2, complet) — ✅ FAIT (2026-07-07)

- [x] Upload de fichier (PDF/DOCX) — port/adapter storage (`file-storage-port.ts`) avec
  implémentations `LocalFsStorageAdapter` (dev, actif par défaut) et `S3StorageAdapter`
  (Scaleway/OVHcloud, code prêt). ⚠️ **Point ouvert** : le bucket S3 réel Scaleway/OVHcloud
  n'est pas encore configuré/connecté (`S3_*` vides dans `.env.example`) — LocalFs sert de
  fallback tant que ce n'est pas fait ; à faire avant tout stockage de vrais documents
  clients en production.
- [x] `DocumentCategorizationService` — suggestion automatique de type
- [x] Statut passe à `UPLOADED` dès dépôt
- [x] Gestion de versions (versioning implémenté, historique conservé)
- [x] Tableau de bord établissement : % checklist complétée, vue par catégorie

**Definition of done :** testé avec des fixtures de test (voir point ouvert stockage
ci-dessus avant un vrai document ASSAD BENOIT en production).

## Jalon 3 — Analyse documentaire automatisée (Module 1) — ✅ FAIT (2026-07-19), fusionné avec le Jalon 4

> Décision prise en session : Jalons 3 et 4 ont été fusionnés en un seul pipeline plutôt que
> construits séquentiellement — un seul appel LLM par document à l'upload produit un JSON
> stocké dans `DocumentVersion.analysisResultJson`, qui alimente à la fois le statut de
> conformité (ce Jalon) et les suggestions de pré-cotation (Jalon 4), pour éviter un second
> appel LLM coûteux. Voir `context/07-outil-pilotage-missions.md` et le plan de session pour
> le détail des décisions.

- [x] Pipeline d'extraction de texte (pdf-parse, mammoth) — déjà fait au Jalon 2
- [x] `LLMAnalysisPort` + `AnthropicAnalysisAdapter` (+ `StubAnalysisAdapter` en dev tant que
  `ANTHROPIC_API_KEY` n'est pas configuré — jamais de blocage de l'upload)
- [x] `DocumentStatusService` : calcul du statut (`COMPLIANT` / `INCOMPLETE`) depuis le JSON
  d'analyse
- [x] Étape d'anonymisation best-effort (email/téléphone/NIR) avant tout envoi au LLM
  (`anonymization-service.ts`)
- [ ] `EXPIRED` (périmé selon fréquence attendue) — pas encore branché, dépend des alertes
  documents périmés (roadmap process métier, phase ultérieure)
- [ ] Affichage détaillé des manques + suggestions dans l'UI espace client (le JSON est
  stocké et le statut dérivé, mais pas encore affiché en détail côté client)
- [x] Pas de file Redis/BullMQ — simplification volontaire : analyse synchrone dans l'action
  d'upload (timeout borné), statut `ANALYZING` affiché pendant le traitement
- [ ] Bouton "Régénérer une version corrigée" → nouvelle `DocumentVersion` — **non fait**,
  gap connu (nécessite sa propre génération DOCX, pas juste l'analyse)

**Definition of done partielle :** le pipeline fonctionne de bout en bout (vérifié par script
direct + `StubAnalysisAdapter`) ; **calibration du prompt sur de vrais documents ASSAD
BENOIT avec `ANTHROPIC_API_KEY` configurée reste à faire** avant mise en usage réel — la
qualité perçue de ce module conditionne l'adoption de toute la plateforme.

## Jalon 4 — Auto-évaluation HAS (Module 3) — ✅ FAIT (2026-07-19)

- [x] Seed du référentiel complet (`Chapter`, `Theme`, `Objective`, `Criterion`,
  `EvaluationElement`) depuis les grilles Synaé réelles (138 critères / 295 E.E., vérifié
  exactement contre `context/02-referentiel-has.md` §4 — 6 impératifs Chapitre 2, 10
  Chapitre 3). Fichiers source non committés (`.claude/context/Documents/`, cf. `.gitignore`
  — nom de fichier référence le vrai client ASSAD BENOIT, CLAUDE.md §7)
- [x] `ScoringService` (calcul de moyenne avec exclusion NC/RI, ★=4, point d'extension
  pondération par objectif non hardcodé)
- [x] UI de cotation par chapitre (`/dashboard/cabinet/etablissements/[id]/evaluation`), avec
  garde-fous (RI Chapitre 1 uniquement, avertissement NC sur impératif), filtrée par offre
  (Essentielle = critères impératifs uniquement, via `OfferScopeService`)
- [x] Minuteur de session
- [x] Tableau de résultats par chapitre + critères impératifs à risque mis en évidence
- [x] `PreRatingSuggestionService` — pont avec les statuts documents du Module 1, suggestion
  virtuelle jamais persistée sans confirmation humaine
- [ ] Export structuré (CSV/Excel) des cotations — format à valider avec Sandrine, **pas
  encore fait**
- [ ] Critère 3.6.2 (17ᵉ impératif, SAD Mixte) absent des grilles source (spécifiques SAD
  Aide) — support SAD Mixte complet en attente d'une grille Mixte fournie séparément

**Definition of done partielle :** cotation d'un chapitre complet vérifiée (script direct +
rendu HTTP authentifié) ; **export structuré et calibration avec Sandrine restent à faire**
avant mise en usage réel.

## Jalon 5 — Durcissement avant mise en usage réel — 🟡 EN COURS (2026-08-19)

- [x] **Revue sécurité — faite, écarts corrigés.** Le cloisonnement client fonctionnait, mais
  le cloisonnement **par tenant côté Cabinet** était absent ou défaillant sur plusieurs
  actions : dépôt/aperçu/téléchargement de document, checklist d'établissement, invitation
  d'un utilisateur client, cotation et clôture de session d'évaluation. Plus un motif
  fail-open (`if (user.tenantId) where.tenantId = …`) qui rendait la requête globale pour un
  compte Cabinet sans tenant. Corrigé par une couche d'autorisation unique
  (`lib/auth/guards.ts`) que toute action doit désormais traverser — détail complet dans
  `specs/02-architecture-technique.md` §4.
- [x] **Logs d'audit sur accès documents** — modèle `AuditLogEntry` + `audit-log-service.ts`
  (dépôt, téléchargement, aperçu, réponse document manquant, invitation client, suppression
  d'établissement, échec de connexion, blocage de tentatives). Migration
  `20260819120000_audit_log` — à appliquer avec `pnpm db:migrate:deploy`.
- [x] **Durcissement transverse** : validation réelle des entrées (plus de cast d'enum non
  vérifié), détection du type de fichier par signature binaire, assainissement de la clé de
  stockage (traversée de chemin), en-têtes de sécurité + CSP, limitation de débit sur le
  login, session ramenée à 8 h, révocation immédiate sur rôle/compte supprimé.
- [x] **Tests unitaires** (`pnpm test`, 216 tests au 20/08/2026) sur les services purs et les
  refus des actions serveur, exécutés en CI : règles de cotation HAS, périmètre des offres,
  avancement de mission, validation des dépôts, parseurs d'entrée, formatage des prix,
  politique de mot de passe, gardes d'autorisation, profil de configuration de production.
- [ ] **Chiffrement at-rest / bucket S3 réel — cible retenue : Supabase Storage** (même
  projet Supabase que la base, donc même région `aws-0-eu-west-1`, décision du 21/08/2026).
  Il manque exactement deux choses : **créer le bucket** et **générer une clé d'accès S3**,
  d'où découlent les cinq variables `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`,
  `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (aucune n'existe aujourd'hui). Le code est prêt
  (`S3StorageAdapter`) ; le chiffrement at-rest est à confirmer côté Supabase. Reste le point
  bloquant n°1 avant de déposer un vrai document client en production.
- [ ] **CSP à nonce** — la CSP actuelle conserve `script-src 'unsafe-inline'`, requis par le
  script d'amorçage de Next.js App Router.
- [x] **Compteur de limitation partagé** (table Postgres) — fait le 21/08/2026 avec la bascule
  du déploiement sur Vercel, où le compteur mémoire ne protégeait plus de rien (une instance
  par invocation, remise à zéro au démarrage à froid). `PostgresRateLimiter`
  (`lib/security/postgres-rate-limiter.ts`) derrière le `RateLimiterPort` existant, frontière
  SQL isolée dans `prisma-rate-limit-store.ts`, arithmétique de fenêtre pure dans
  `rate-limit-window.ts`. Sélection automatique en serverless ou en production, compteur
  mémoire conservé en développement et dans les tests. Atomicité par
  `INSERT … ON CONFLICT DO UPDATE … RETURNING` (verrou de ligne PostgreSQL), purge des lignes
  échues greffée en CTE sur 2 % des écritures, **fail-closed** en cas de base injoignable.
  Politique inchangée (10 / 15 min connexion, 5 / 15 min mot de passe). Migration
  `20260821100000_rate_limit_counters` — à appliquer avec `pnpm db:migrate:deploy`.
- [ ] **Rétention du journal d'audit** — durée de conservation à arrêter avec Sandrine.
- [x] **Rotation du mot de passe temporaire** à la première connexion d'un compte client —
  `User.mustChangePassword` / `passwordChangedAt`, page `/changer-mot-de-passe`, enforcement
  dans `lib/auth/guards.ts` + middleware, invalidation des sessions ouvertes avant le
  changement. Migration `20260820120000_password_rotation` — à appliquer avec
  `pnpm db:migrate:deploy`. Détail : `specs/02-architecture-technique.md` §4.10.
- [x] **Configuration validée au démarrage** — `src/instrumentation.ts` refuse de démarrer
  (sortie code 1) une instance de production sans `S3_*`, `ANTHROPIC_API_KEY` ou
  `NEXTAUTH_URL`. Fin du déploiement « vert » qui explose au premier dépôt de document.
  Détail : §4.11.
- [x] **Migrations appliquées au déploiement** — le `buildCommand` de `vercel.json` enchaîne
  `migrate deploy` puis `next build` ; l'application journalise une erreur unique au démarrage
  si le schéma est en retard. Checklist de mise en production dans `README.md`. Détail : §4.12.
- [ ] Tests de charge basiques sur le pipeline d'analyse (un upload simultané de plusieurs
  documents ne doit pas planter le job queue)
- [ ] Vérification réelle du format d'export attendu par Synaé (point ouvert — voir
  §risques)

---

## Risques connus à lever pendant le build (ne pas attendre la fin)

1. **Format d'import Synaé réel inconnu à ce stade.** Aucun document du projet ne décrit
   un format d'API ou d'import officiel Synaé. Hypothèse de travail : export CSV/Excel
   structuré. **Action : vérifier avec Sandrine dès le Jalon 4**, potentiellement via le
   support HAS ou la documentation Synaé si elle y a accès en tant qu'évaluatrice.
2. **Qualité de l'extraction PDF sur des documents scannés.** Certains documents clients
   réels peuvent être des scans (photos jointes au projet : `20260408_*.jpg` suggèrent des
   captures terrain). Si les vrais documents ASSAD BENOIT contiennent des scans non
   nativement texte, prévoir un fallback OCR plus tôt que prévu (déprioriser une autre
   tâche du Jalon 3 plutôt que de livrer une analyse qui échoue silencieusement).
3. **Fiabilité du LLM sur la détection de manques.** Risque de faux positifs/négatifs.
   Mitigation produit : toujours garder le statut "suggestion à valider", jamais
   d'auto-validation, et logger les corrections manuelles de Sandrine pour, à terme,
   améliorer le prompt (boucle de feedback implicite).
4. **Volume réel de documents par établissement** sous-estimé — la checklist comporte
   déjà ~30 documents attendus (toutes catégories confondues) ; vérifier que l'UI de
   checklist reste lisible à cette échelle (prévoir des catégories repliables dès le
   Jalon 1, pas comme une optimisation tardive).

## Jalon 6 — Refonte des offres (call du 16/08/2026) — 🟡 EN COURS (2026-08-20)

Source : `context/07-outil-pilotage-missions.md` §12 (corrigé le 20/08 contre le transcript
Fathom) et `context/08-offre-commerciale-v10.md` (plaquette du 18/08, source de vérité
tarifaire).

- [x] **Catalogue aligné sur la plaquette v10** — 2 500 / 6 500 / 15 000 € « à partir de »,
  acompte 40 %, 10 options avec unité de tarification (forfait, heure, document, support,
  mois), fourchettes et engagement minimal. Migration `20260819180000_catalogue_v10`.
- [x] **Périmètre par offre appliqué aux deux portails** — `MissionChecklistItem.minFormule`
  porte la règle en base ; `offer-scope-service` est la seule couche qui répond « cette
  formule couvre-t-elle ceci ? » (critères, items de mission, catégories de documents) ;
  refus côté serveur sur les mutations, pas seulement à l'affichage. Migration
  `20260820090000_mission_checklist_min_formule`.
- [x] **Compteurs miroir** sur le suivi de mission (déposés / analysés / modifiés / conformes),
  sans aucun dépôt dans ce portail.
- [ ] **Page « plan d'action »** (§12.5) — bouton de génération si l'offre couvre la ligne,
  paywall / demande de devis sinon. **Bloqué** : nécessite le fichier PAC de Sandrine et le
  tri ligne par ligne inclus/option qu'elle a demandé à Damon de proposer
  ([4:36:18](https://fathom.video/calls/786436116?timestamp=16578)). Le critère de tri n'est
  pas « création vs modification » — cette règle est renversée en fin de call (§12.1).
- [x] **Dossier prospect** *(26/08/2026, call Sandrine)* — civilité et fonction du
  contact en colonnes (plus de « Madame Dupont » dans le nom), précision obligatoire
  sur tout « Autre » (canal, fonction), historique append-only (commentaires +
  changements d'étape sur une même frise), une action mise en avant par étape, bascule
  du titre prospect → client sur l'existence de la fiche. Migration
  `20260826090000_prospect_contact_and_timeline`. Détail :
  `specs/02-architecture-technique.md` §4.15.
- [x] **Partage d'un devis** *(26/08/2026)* — téléchargement nommé à la convention EODA
  via la vue imprimable + brouillon `mailto:` pré-rempli. Aucun envoi serveur, aucun
  moteur PDF, aucun lien public : décision explicite de Damon, à ne pas « améliorer »
  sans nouvelle demande.
- [ ] **Génération de contrat + avenant** pour toute option hors contrat (§12.6).
- [ ] **Deux parcours d'achat d'option** — paywall direct ou demande → alerte interne → devis
  → déblocage, selon la forme juridique du client (§12.6).
- [ ] **Abonnement portail** — 400 €/mois, engagement 1 an à reconduction tacite, dégressivité
  -10 % Performance / -30 % Excellence à calculer dans l'outil (§12.2).
- [ ] **Module sensibilisation** — génération du PDF de questions ciblé sur les critères
  faibles, renvoi vers Kahoot, réimport des statistiques (§12.5). Pas de moteur de quiz maison.
- [ ] **Relances automatiques** — délais, cadence et condition d'arrêt jamais spécifiés (§12.7).
- [ ] **Fin de mission** — trois états à modéliser : mission active / bibliothèque abonnée en
  lecture seule / accès révoqué. Aucune suppression dure (§12.5).
- [ ] **Export Excel compatible Synaé** — format d'import réel toujours inconnu (§12.7,
  risque n°1 ci-dessous).
