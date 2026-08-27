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
- [x] **Cinq documents réclamés au client, pas vingt-neuf** *(27/08/2026)* —
  `DocumentType.requestedFromClient` : le portail client n'affiche que les types réclamés,
  plus ceux dont un document existe déjà (sa bibliothèque). Les 29 types restent visibles
  côté cabinet : ils sont le plan de production de l'accompagnement. ⚠️ Les cinq codes seedés
  (`L2002_PROJET_SERVICE`, `L2002_CHARTE_DROITS`, `L2002_LIVRET_ACCUEIL`, `L2002_DIPC`,
  `L2002_REGLEMENT_FONCTIONNEMENT`) sont une **proposition à confirmer par Sandrine**, qui
  consulte ses experts — d'où la bascule modifiable depuis l'application par `CABINET_ADMIN`,
  sans migration. Migration `20260827140000_document_types_requested`.
- [x] **Parcours documentaire côté cabinet** *(27/08/2026)* — déposé → analysé → mis en
  conformité → restitué → validé (`document-workflow-service.ts`, quatre étapes dérivées,
  la validation stockée parce que c'est une décision). Le client garde ses statuts simples :
  « les deux portails ne regardent pas la même chose » (call du 26/08).
- [x] **Toutes les versions affichées** *(27/08/2026)* — historique complet par document, avec
  auteur (client ou EODA) et date ; elles étaient déjà toutes conservées, l'écran n'en montrait
  qu'une.
- [x] **Formats acceptés élargis** *(27/08/2026)* — PDF, .doc/.docx, .xls/.xlsx, CSV, JPEG, PNG.
  Type toujours déterminé par signature binaire ; le CSV, qui n'en a pas, est reconnu à sa
  FORME (plusieurs lignes, même nombre de séparateurs) — une charge utile d'une seule ligne
  reste refusée. Les formats non analysables sont conservés comme pièces, sans statut trompeur.
- [x] **Droits de suppression** *(27/08/2026)* — chacun ne retire que son propre dernier dépôt.
  Le cabinet ne peut pas effacer une pièce déposée par le client (demande explicite du 26/08),
  le client peut corriger la sienne, et aucune version antérieure n'est supprimable.
- [x] Affichage détaillé des manques + suggestions **fait le 26/08/2026** — panneau
  « Analyse automatique » sous chaque document déposé, dans le portail client ET côté
  cabinet (`components/checklist/DocumentAnalysisPanel.tsx`). Le JSON était produit et
  payé à chaque dépôt depuis juillet, et lu par personne. Validé défensivement à la
  lecture (`analysis-view-service.ts`) : une colonne `Json` écrite par un modèle sous un
  contrat plus ancien ne doit pas casser la checklist, et un résultat vide
  (StubAnalysisAdapter, appel échoué) ne doit pas passer pour un document sans reproche.
  Mention de réserve obligatoire : préparation, jamais évaluation HAS (CLAUDE.md §1).
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
- [x] **CSP à nonce** *(26/08/2026)* — `script-src 'unsafe-inline'` supprimé. Nonce tiré
  par requête dans `src/middleware.ts` (`lib/security/content-security-policy.ts`, pur et
  testé), transmis à Next.js par les en-têtes de la requête et appliqué par ceux de la
  réponse ; `'strict-dynamic'` laisse le script d'amorçage charger les chunks. Vérifié en
  exécution : l'en-tête porte le nonce, les balises `<script>` servies le portent toutes,
  et il change à chaque requête. La CSP des pages ne vit plus dans `next.config.ts` — les
  routes `/api`, hors du middleware, y gardent une politique statique bien plus serrée
  (`default-src 'none'`). Restent `style-src 'unsafe-inline'` (Tailwind, styled-jsx) et
  `'unsafe-eval'` en développement seulement, tenus par test.
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
- [x] **Avenant** *(26/08/2026)* — généré pour toute option rattachée au périmètre hors
  devis signé (`MissionOption.priceIsFirm = false`), depuis le suivi de mission :
  `/imprimer/avenant/[id]`, nommé à la convention EODA, avec emplacements de signature.
  Le document CONSTATE (ce qui s'ajoute, à quel prix, sous les conditions du contrat
  initial) et n'écrit aucune clause nouvelle. **Le « contrat » lui-même reste le devis
  signé** — c'est déjà le document contractuel du dépôt (CLAUDE.md §7) ; produire un
  second document de contrat supposerait un texte de CGV/CGP que Sandrine n'a pas fourni.
  Reste ouvert : aucun suivi de la SIGNATURE de l'avenant (pas de modèle, pas de statut).
- [x] **Rapport de mise en conformité** *(27/08/2026)* — document autonome et archivable,
  remis au client : compteurs d'ouverture, puis document par document ce qui manque, avec
  les critères HAS rattachés. `/imprimer/rapport/[id]`, nommé à la convention EODA, en-tête
  à deux logos et mention de PATERNITÉ (c'est un livrable produit pour la structure).
  ⚠️ Seules les analyses **relues** y entrent : une analyse non validée y figure comme « en
  cours de relecture », sans son contenu — sinon la revue humaine serait contournée par la
  porte de l'imprimante. Un rapport sans rien à dire n'est pas produit du tout.
  Reste du lot B : la version modifiée du document (surlignages + encarts) et la base
  vectorielle du manuel HAS, toutes deux en attente des templates de Sandrine.
- [x] **Identité sur les documents** *(27/08/2026)* — logo EODA officiel appliqué partout
  (fini le SVG approximé de l'en-tête et de la connexion), logo de la structure déposable
  depuis sa fiche (`Establishment.logoDataUri`, PNG/JPEG ≤ 300 Ko, type vérifié par
  signature binaire, stocké en data URI), en-tête à deux logos sur les documents produits,
  et deux mentions qui ne se confondent pas : **paternité** (propriété EODA + droit
  d'exploitation concédé) sur les livrables produits pour la structure, **prestation** sur
  les documents contractuels. Migration `20260827160000_establishment_logo`.
  Reste à faire : appliquer l'en-tête et la mention de paternité aux documents de mise en
  conformité — ils n'existent pas encore (lot B, en attente des templates de Sandrine).
- [~] **Deux parcours d'achat d'option** — le parcours « demande → alerte interne → devis →
  déblocage » est complet depuis le 27/08 : la demande client déclenche un e-mail vers les
  comptes `CABINET_ADMIN` **et** une pastille de navigation qui reste tant que la demande
  n'est pas traitée. Le **paywall direct** reste à faire : il suppose un prestataire de
  paiement, décision non prise (§12.6).
- [x] **E-mail d'invitation client** *(27/08/2026)* — identifiant, mot de passe temporaire et
  lien, envoyés à la création du compte. L'écran DIT si l'e-mail est parti : sinon Sandrine
  communique le mot de passe elle-même. Un échec d'envoi ne perd jamais le compte.
- [ ] **Abonnement portail** — 400 €/mois, engagement 1 an à reconduction tacite, dégressivité
  -10 % Performance / -30 % Excellence à calculer dans l'outil (§12.2).
- [ ] **Module sensibilisation** — génération du PDF de questions ciblé sur les critères
  faibles, renvoi vers Kahoot, réimport des statistiques (§12.5). Pas de moteur de quiz maison.
- [ ] **Relances automatiques** — délais, cadence et condition d'arrêt jamais spécifiés (§12.7).
- [x] **Fin de mission** *(26/08/2026)* — trois états d'accès DÉRIVÉS de deux faits
  (`Mission.closedAt`, `Mission.clientAccessRevokedAt`) : mission active / bibliothèque en
  lecture seule / accès révoqué. Aucune suppression, tout est réversible, les quatre gestes
  sont réservés à `CABINET_ADMIN` et journalisés. Alerte de mise à jour au 5ᵉ mois calculée à
  l'affichage. Migration `20260826140000_mission_client_access`. Détail :
  `specs/02-architecture-technique.md` §4.16.
- [ ] **Export Excel compatible Synaé** — format d'import réel toujours inconnu (§12.7,
  risque n°1 ci-dessous).
