# EODA Conseil — Plateforme SaaS HAS/ESSMS

> Fichier lu automatiquement par Claude Code au démarrage de chaque session.
> Source de vérité unique sur le projet, la stack et les règles de développement.

## 0. À FAIRE AVANT TOUTE CHOSE — conventions d'ingénierie

**Avant d'écrire une ligne de code, avant même de raisonner sur une solution technique,
charge la skill `engineering-conventions`** (`Skill(engineering-conventions)`).

Elle contient les règles indépendantes de la stack : sécurité non négociable (`S1`-`S10`),
anti-duplication, typage strict, tests, et surtout la **Règle zéro** — une règle qu'aucune
machine ne vérifie n'est pas une règle, c'est un souhait. Ces règles **prévalent sur toute
préférence de style**, et sur la sécurité elles prévalent sur les conventions locales du dépôt.

Elles sont **cumulatives** avec les §5 (SOLID), §5 bis (sécurité) et §6 (contraintes) de ce
fichier, jamais en remplacement. En cas de contradiction : le dépôt gagne sur le style, la
skill gagne sur la sécurité et la correction.

### État de la chaîne d'application dans ce dépôt (vérifié le 2026-08-19)

Ce tableau est le contrat mécanique. **Si tu ajoutes une règle, ajoute la ligne qui la
vérifie** — sinon elle n'existe pas.

| Règle | Contrôle mécanique | Où |
|---|---|---|
| Pas d'opération asynchrone non attendue | `no-floating-promises`, `no-misused-promises`, `await-thenable` en **error** | `apps/web/eslint.config.mjs` (type-aware, `projectService`) |
| Pas d'échappatoire au typage | `no-explicit-any` en **error** | idem |
| Pas de journalisation sauvage | `no-console` en **error** (`error`/`warn` autorisés) | idem |
| Aucun dialogue natif du navigateur | `no-restricted-syntax` sur `confirm`/`alert`/`prompt` en **error** | idem — remplacés par `<ConfirmActionButton>` |
| `process.env` lu à un seul endroit | `no-restricted-syntax` en **error** | idem — seule exception : `lib/config/env.ts` |
| Contrat de types respecté | `tsc --noEmit` sur **les deux** packages | `pnpm typecheck` (`pnpm -r --if-present`) |
| Couverture minimale | seuils qui **font échouer** la commande | `apps/web/vitest.config.mts` — 80 % lignes/fonctions/instructions, 75 % branches |
| Aucun secret commité | `gitleaks` en pre-commit **et** en CI (historique complet) | `.githooks/pre-commit` + `.github/workflows/ci.yml` |
| Hooks installés par le dépôt | `git config core.hooksPath .githooks` posé par le `postinstall` | `package.json` |
| Manifeste de migrations à jour | test qui compare `EXPECTED_MIGRATIONS` au dossier `prisma/migrations` | `apps/web/src/lib/db/migration-manifest.test.ts` |
| Clés étrangères indexées (convention `P6`) | test qui lit le schéma et **échoue** sur toute relation sans index, liste d'exceptions figée | `apps/web/src/lib/db/foreign-key-indexes.test.ts` |
| Matrice des rôles cabinet appliquée par les gardes (N9) | matrice testée case par case, chaque garde × chaque rôle testée, commercial gardé export par export | `lib/auth/capabilities.test.ts`, `guards-roles.test.ts`, `commercial-pages-guard.test.ts` |
| La lecture seule n'écrit rien | test qui **échoue** si une action gardée en lecture contient une écriture Prisma | `apps/web/src/lib/auth/read-guards-never-write.test.ts` |
| CSP à nonce réellement applicable (aucune page pré-rendue) | `pnpm check:csp` après le build, **sort en code 1** si un `<script>` est écrit sans nonce | `apps/web/scripts/check-csp-nonce.mjs` + CI ; le réglage est `export const dynamic = "force-dynamic"` dans `apps/web/src/app/layout.tsx` |
| Budget de JavaScript par route | `pnpm check:bundle` après le build, **sort en code 1** au-delà du budget | `apps/web/scripts/check-bundle-budget.mjs` + CI |
| Configuration de production complète | contrôle au démarrage qui **sort en code 1** | `apps/web/src/instrumentation.ts` + `lib/config/production-profile.ts` |
| Migrations appliquées au déploiement | `migrate deploy` dans `buildCommand` | `vercel.json` |
| Dépendances vulnérables | `pnpm audit:deps` — **sort en code 1** sur toute vulnérabilité haute ou critique, **sans `\|\| true`** ; distingue « vulnérabilité trouvée » de « registre npm injoignable », qu'il réessaie avant d'échouer en le disant | `scripts/audit-dependencies.mjs` + CI |
| CI qui dit la vérité | aucun `continue-on-error`, aucun masquage d'échec | CI |
| Texte ≥ 14 px, focus jamais retiré | test qui parcourt `src/**/*.{ts,tsx}` et **échoue** sur une taille arbitraire < 14 px ou un `outline-none` ; vérifie que `text-xs` vaut 14 px | `apps/web/src/lib/design/ui-class-guard.test.ts` |
| Verrou HDS : aucune donnée de personne accompagnée écrite hors hébergeur certifié (lot C) | (1) test qui lit tout `src/` et **échoue** sur un accès aux tables usager (délégué Prisma ou SQL brut) hors de l'adaptateur du port ; (2) avec la configuration par défaut, chaque écriture du port, du stockage HDS et de chaque action usager est refusée ; (3) le profil de production **refuse de démarrer** sur `HDS_BACKEND_ENABLED=true` sans `HDS_PROVIDER` ni stockage distinct | `lib/hds/beneficiary-tables-guard.test.ts`, `lib/hds/hds-lock.test.ts`, `lib/actions/beneficiary-actions-locked.test.ts`, `lib/config/production-profile.test.ts` — ADR `specs/adr/20261014_ADR_lot-C-verrou-HDS.md` |
| Contraste des tokens ≥ 4.5:1 (clair et sombre) | test qui lit `globals.css`, résout les alias et **échoue** sous 4.5:1 ; vérifie que les deux voies du sombre sont identiques | `apps/web/src/lib/design/theme-contrast.test.ts` |
| Ce que la structure fait prévient le cabinet, et personne d'autre | destinataires résolus par le périmètre (`resolveStructureScope` — commercial exclu, consultante non affectée exclue), compte désactivé exclu, dépôt du cabinet muet, « il arrive » muet, libellé du type jamais le nom de fichier | `lib/services/cabinet-recipients-service.test.ts`, `lib/email/templates.test.ts`, `lib/actions/document.test.ts`, `lib/actions/client-document-acceptance.test.ts` |
| « Voir » montre le document, jamais le texte extrait | `.docx`/`.xlsx`/`.csv`/images passent par les pages rendues côté serveur (`document` AVANT `markdown` dans `buildFilePreview`), le PDF est servi en `inline`, son export et son aperçu sont le MÊME artefact, et seuls les formats convertibles proposent le bouton | `lib/services/printable-html-service.test.ts` (nettoyage : script, `on*`, styles, ressources distantes), `document-pdf-render-service.test.ts` (**la signature décide, pas l'extension**), `document-pdf-service.test.ts`, `document-pdf-response.test.ts`, `file-preview-service.test.ts` (ordre des branches), `file-type-service.test.ts` |
| La matrice type de document ↔ critères ATTEINT le prompt | les rattachements sont lus en base pour LE type analysé (`documentTypeCriterion.findMany`) et remis à l'IA sous « Critères HAS rattachés à ce type de document » ; matrice vide → « aucun rattachement connu », jamais un catalogue de remplacement | `lib/services/document-ingestion-service.test.ts` (matrice lue → port d'analyse), `lib/llm/analysis-prompt.test.ts` (rendu de la ligne, repli vide) |
| L'IA ne touche jamais une version ni une date du document | règle du cahier de style (v02) **et** `sanitizeProposal` : toute version/date absente du document d'origine et des extraits du manuel devient `[À compléter : version ou date]`, segments ORIGINAL compris ; un code de critère (« 1.10.12 ») n'est pas une date | `lib/llm/correction-proposal.test.ts` (describe « versions et dates ») |
| Les commentaires du cabinet atteignent l'analyse, et seulement s'ils sont « pris en compte par l'IA » | `fetchCriterionGuidelines` lit les critères de la matrice **et** ceux reconnus dans le document (suggestions non rejetées), filtre `aiEnabled: true` ; la bascule est gardée par tenant (`notFound`) et journalisée `CRITERION_GUIDELINE_AI_TOGGLED`, le texte reste append-only | `lib/services/document-ingestion-service.test.ts` (« commentaires du cabinet »), `lib/actions/document.test.ts` (`setCriterionGuidelineAiUse`) |
| Un échec de lancement de Chromium est NOMMÉ, et n'invite pas à réessayer | le lancement enveloppe son erreur (`ChromiumLaunchError`, cause conservée, recours nommé : `PUPPETEER_EXECUTABLE_PATH` en développement) et le message d'aperçu **échoue** s'il dit « Réessayez » sur cet échec-là ; les drapeaux serverless ne sont jamais passés à un Chrome de bureau | `lib/services/headless-chromium-service.test.ts`, `lib/services/document-pdf-response.test.ts` |
| Toute fonction qui embarque Chromium embarque son binaire | `pnpm check:chromium` après le build lit les `*.nft.json` et **sort en code 1** si une fonction contient le code de `@sparticuz/chromium` sans `bin/chromium.br` / `al2023.tar.br` (le paquet situe son binaire à l'exécution : le traçage ne le voit pas — l'aperçu des documents répondait **503** en production, 21/10/2026), ou si **aucune** fonction n'est concernée. Réglage : `outputFileTracingIncludes` de `next.config.ts`. Corollaire : le cache du rendu vit dans `document-pdf-cache.ts`, qui n'importe pas Chromium — la suppression d'une version le chargeait dans seize pages | `apps/web/scripts/check-chromium-trace.mjs` + CI |
| Un envoi « non configuré » n'est jamais compté comme parti | décompte par `countDeliveries` dans toute la couche d'envoi — aucun comptage brut de promesses tenues (il annonçait « Client prévenu (2 personnes) » pour zéro e-mail) | `lib/email/notifications.test.ts` |
| L'attribut `hidden` masque réellement, même sous une classe d'affichage | `globals.css` porte `[hidden]:where(:not([hidden="until-found"])){display:none !important}` — le préflight de Tailwind, sans `!important`, a la même spécificité que `.flex` (0,1,0) et vient plus tôt : `.flex` gagnait, et le repli du groupe « Réglages » de la barre latérale cabinet restait décoratif (16/10/2026) | `lib/design/hidden-attribute.test.ts` — **échoue** si le `!important` (ou l'exception `until-found`) disparaît de `globals.css` |
| Le pool de connexions est borné, et le mode session du pooler est NOMMÉ | `resolveRuntimeDatabaseUrl` (paquet `@eoda/database`) pose `connection_limit=1` sur l'URL runtime **avant** la construction du client ; sans lui, Prisma ouvre `nb_cpu_physiques × 2 + 1` connexions par processus (21 sur le poste à 10 cœurs) contre **15 créneaux** en mode session, sur une base que le poste partage avec la production — incident du 16/10/2026 (`EMAXCONNSESSION`) ; `connectionPoolWarning` nomme le remède au démarrage au lieu de refuser de servir | `lib/db/database-url.test.ts` — dont le garde qui **échoue** si `packages/database/src/index.ts` cesse de passer l'URL résolue au client |

**Dette acceptée, à réexaminer après le 22/09/2026** : `.npmrc` porte `node-linker=hoisted`,
qui désactive l'arborescence isolée de pnpm et rend possibles les dépendances fantômes
(convention `D9`). Le réglage avait été posé pour Prisma Compute, retiré du dépôt le
22/08/2026 — sa cause n'existe donc plus. Il ne se retire pas à l'aveugle : la
vérification est un déploiement de **prévisualisation Vercel** sans cette ligne, pas une
construction locale.

**Ouvert au 13/10/2026 — `braces` (GHSA-vfj7-8cjw-p6xm)** : aucune version corrigée publiée
(≤ 3.0.3 vulnérable, 3.0.3 est la dernière), atteint seulement par l'outillage de
développement (`eslint-config-next` > `fast-glob` > `micromatch`, `tailwindcss`). `pnpm
audit:deps` échoue sur lui seul. **Décision de Damon attendue** : exception écrite dans
`ignoreGhsas` (comme `xlsx`) ou remplacement de l'outillage ; le seuil n'est pas abaissé.

**Dette acceptée, avec justification écrite** : `xlsx` (GHSA-4r6h-8v6p-xvw6,
GHSA-5pgg-2g8v-p4x9) n'a pas de version corrigée publiée sur npm. Utilisé uniquement par
`packages/database/prisma/seed-has-referential.ts`, un script de seed exécuté à la main sur
les grilles Synaé locales de Sandrine — jamais dans le chemin d'exécution de l'application,
jamais sur un fichier provenant d'un tiers. Exception déclarée explicitement dans
`pnpm.auditConfig.ignoreGhsas`, pas en abaissant le seuil global d'audit.

**Dette acceptée, décision de Damon du 14/10/2026** : `braces` (GHSA-vfj7-8cjw-p6xm, haute)
n'a **aucune version corrigée publiée**. Il n'arrive que par l'outillage de lint
(`eslint-config-next > @next/eslint-plugin-next > fast-glob > micromatch > braces`) : exécuté
sur le poste et en CI, **jamais** dans l'application livrée ni sur Vercel en réponse à une
requête. Exception déclarée dans `pnpm.auditConfig.ignoreGhsas`, seuil global inchangé.
**À retirer dès qu'un correctif sort** (vérifier à chaque `pnpm audit:deps`).

## 1. Contexte métier (à connaître avant tout)

**Qui :** Sandrine Regina, fondatrice d'EODA Conseil (auto-entreprise), consultante qualité
ESSMS, formée à la méthodologie HAS (Cabinet Amplea, organisme accrédité COFRAC). ~20 ans
d'expérience qualité international (Orange Business), ITIL, Power BI. **Damon BA**
(l'utilisateur de Claude Code sur ce projet) est le programmeur, concepteur des outils
internes et externes d'EODA — cf. `context/06-mode-operatoire-eoda.md` §Gouvernance.

**Quoi :** EODA accompagne les **SAD** (Services Autonomie à Domicile — un type d'ESSMS)
dans leur préparation à l'**évaluation qualité HAS** (Haute Autorité de Santé), obligatoire
pour tous les ESSMS : **une évaluation tous les 5 ans** (soit 3 sur 15 ans).

**Positionnement (décision Damon, 30/09/2026) — lire `context/09-vision-produit.md` :**
EODA est **à la fois la SaaS et le cabinet**. Le portail est le produit (abonnement payé par
la structure) ; le contenu des offres v10 (Essentiel, Performance, Excellence, prestations à
la carte) **tient toujours** et devient un **supplément d'accompagnement** pour les
structures qui n'ont personne de dédié à la mise en place des processus. **L'IA n'est pas un
argument** : elle travaille en coulisse, l'interface ne parle que de « propositions à
vérifier » et de validation humaine. Cible inchangée : les SAD du 93, 78, 28. Ordre de
construction : **la conformité d'abord, les fonctionnalités métier ensuite.** Les nouveaux
prix SaaS sont des **propositions**, pas des décisions.

**Client pilote (beta-test gratuit) :** ASSAD BENOIT, association loi 1901, FINESS 930034459,
Le Blanc-Mesnil (93). Échéance évaluation HAS visée : **janvier 2027**.

**Marché cible :** SAD associatifs / privés / publics en Seine-Saint-Denis (93), Yvelines (78),
Eure-et-Loir (28). 120+ SAD en Seine-Saint-Denis seuls programmés en évaluation 2026-2030.

**Le problème business à résoudre par cette plateforme :**
Sandrine perd un temps considérable à comparer manuellement les documents qu'un client lui
envoie (PDF/Word) aux exigences documentaires du référentiel HAS, à relancer par email pour
les pièces manquantes, et à coter à la main les 137 critères des grilles Synaé. Cette
plateforme doit absorber ce travail répétitif et faire gagner du temps, **pas** remplacer le
jugement professionnel de l'évaluatrice — elle prépare et accélère, elle ne décide pas.

**⚠️ Point de vigilance déontologique** (cf. `context/02-referentiel-has.md` §Indépendance) :
un organisme évaluateur HAS ne peut pas être aussi conseil/consultant pour le même ESSMS sur
le même cycle d'évaluation. EODA est positionné en **conseil/préparation**, jamais en
évaluateur officiel du client qu'elle accompagne. La plateforme doit rester un outil de
préparation interne, jamais présentée comme une évaluation HAS officielle.

## 2. Les 3 priorités V1 (dans cet ordre strict)

1. **Analyse documentaire automatisée** — upload de documents obligatoires, détection des
   manques face aux exigences loi 2002-2 / HAS, suggestions de correction, régénération de
   version corrigée. *(Module le plus rentable en temps gagné immédiat.)*
2. **Espace client** — dépôt de documents par établissement, checklist des pièces attendues,
   suivi des statuts, versioning. *(Remplace les échanges email dispersés.)*
3. **Auto-évaluation HAS** — Chapitres 1/2/3 Synaé, cotation réelle (1-4, ★, NC, RI), aide à
   la pré-cotation, export compatible Synaé. *(Base déjà prototypée en HTML statique, voir
   `context/05-prototype-existant.md` — à absorber dans l'architecture propre.)*

Le détail fonctionnel complet de chaque module est dans `specs/01-mvp-v1.md`.

**Suite (arrêtée le 30/09/2026)** — ces trois modules existent ; la suite est découpée en
lots dans `context/09-vision-produit.md` §7 :
- **Lot A — refonte et socle conformité** : nouveau design (`DESIGN.md` à la racine,
  écrit le 15/10/2026 — il décrit le système **implémenté** et remplace le brief
  `.claude/design/20260930_DOC_EODA_Brief-Claude-Design-Refonte_v01_Interne.md`,
  devenu la référence d'intention), critères
  & preuves, plan d'action (PAC), échéancier des documents, file « À relire ».
- **Lot B — équipe et sensibilisation** : quiz par QR code **dans la plateforme** (remplace
  le renvoi vers Kahoot du doc 07 §12.5), fiches, preuve de sensibilisation par salarié.
- **Lot C — terrain** (signature sur tablette, enquêtes) : **construit le 14/10/2026 et
  verrouillé** derrière le port HDS (§6 ci-dessous) — démonstration sur données fictives.
- **Lot D — offre SaaS** : paliers d'abonnement, **après** validation des prix par Sandrine.
- Ensuite seulement : fonctionnalités métier (registres EI / plaintes, KPI, liens ERP).

**Bilan au 08/10/2026** — `specs/05-bilan-2026-10.md` : relecture de tous les calls du 19/07
au 07/10, audit du code, **douze décisions à trancher** (D1 HDS et D2 fournisseur d'IA en
tête), correctifs rapides, reste à faire par module. À lire avant de choisir le prochain
chantier.

## 3. Documents de référence (lire dans cet ordre)

| Ordre | Fichier | Contenu |
|---|---|---|
| 1 | `context/01-glossaire-essms.md` | Tous les sigles et termes métier (ESSMS, SAD, DIPC, CVS, EI/EIG, PLAC, CREX...) |
| 2 | `context/02-referentiel-has.md` | Système HAS : 157 critères, 16-18 impératifs, cotation 1-4/★/NC/RI, chapitres Synaé |
| 3 | `context/03-documents-obligatoires.md` | La checklist documentaire loi 2002-2 + HAS, catégorisée — **input direct du module 1** |
| 4 | `context/04-charte-eoda.md` | Identité visuelle (couleurs, typo, logo, conventions de nommage fichiers) |
| 5 | `context/05-prototype-existant.md` | Ce qui existe déjà (HTML statique auto-éval) et pourquoi on le réécrit proprement |
| 6 | `context/06-mode-operatoire-eoda.md` | Mode opératoire humain : contrôle croisé documentaire (matrice, champs critiques, détection d'écarts) + déroulé complet de la mission ASSAD BENOIT (8 phases, gouvernance, vigilances juridiques) — process métier, complémentaire aux fichiers ci-dessus qui documentent les règles produit |
| 7 | `context/07-outil-pilotage-missions.md` | Pipeline commercial (prospects, devis, catalogue, KPI — `/dashboard/cabinet/commercial`, capacité COMMERCIAL : CABINET_ADMIN + CABINET_COMMERCIAL) et suivi de mission (checklist diagnostic 12 items + 4 phases — `/dashboard/cabinet/etablissements/[id]/mission`, lecture des structures : CABINET_ADMIN, CABINET_EVALUATOR, CABINET_READONLY ; montants : CABINET_ADMIN seul) sont tous deux implémentés dans la plateforme. **§12 = refonte des offres décidée au call du 16/08/2026 (prix, périmètres, portails), pas encore implémentée — elle remplace le §4 : lire §12 avant de toucher au catalogue, aux offres ou aux portails.** |
| 8 | `context/08-offre-commerciale-v10.md` | Plaquette commerciale v10 (modules, méthode, formules, options). Contenu toujours valide ; sa **mise en marché** change (supplément d'un abonnement) — voir 09 §4 |
| 9 | `context/09-vision-produit.md` | **Vision arrêtée le 30/09/2026** : SaaS + cabinet, marché et concurrence sourcés, proposition de prix, doctrine IA (vue CTO), exigence d'accessibilité, **décision HDS bloquante**, lots A→D |
| 10 | `context/10-regles-mise-en-conformite.md` | **Cahier de style de la génération** : règles de rédaction dites par Sandrine en séance (01/09 → 07/10), règles de contenu par document (livret, DIPC, règlement…), « paquet » de preuves d'un critère, branchement des documents finaux validés — **à relire avant de toucher un prompt** |
| 10 bis | `context/11-modes-operatoires-sandrine.md` | **Transcription intégrale** des deux modes opératoires écrits de Sandrine (« Vérification documentaire » : matrice, champs critiques, code couleur, revue en trois temps ; « Guide EODA » : déroulé de la mission pilote, phases, livrables). **Fait foi pour les prompts, à la lettre** ; l'emporte sur `context/10` en cas de contradiction. Notes ⚠️ = points à confirmer avec Sandrine |
| 11 | `specs/01-mvp-v1.md` | Spécification fonctionnelle détaillée des 3 modules V1 (+ modules suivants en fin de fichier) |
| 12 | `specs/02-architecture-technique.md` | Stack, schéma BDD, architecture, ADRs |
| 13 | `specs/03-roadmap-developpement.md` | Ordre de build, jalons, definition of done |
| 14 | `.claude/specs/04-liaison-document-type-critere.md` | Rattachement type de document ↔ critères HAS (`DocumentTypeCriterion`, **vide au 08/10** — levier n°1 de la qualité des analyses ; **vérifié le 16/10** : la matrice est bien lue et injectée dans le prompt, le maillon est désormais testé) |
| 15 | `specs/05-bilan-2026-10.md` | **Bilan au 08/10/2026** : décisions bloquantes, correctifs, pipeline IA réel, reste à faire, lisibilité des documents de `context/Documents/` |
| — | `PRODUCT.md` (racine) | Vérité produit lue par la skill impeccable (utilisateurs, positionnement, principes, accessibilité) |
| — | `DESIGN.md` (racine) | **Système de design réellement implémenté** (jetons de rôle, typographie, coquilles, vocabulaire des statuts, seuils des gardes, écarts assumés par rapport aux maquettes) : **toute implémentation d'écran s'y conforme**. Il **remplace** le brief du 30/09 comme référence d'implémentation ; en cas de contradiction avec le code, c'est le code qui gagne et `DESIGN.md` qui se corrige |
| — | `.claude/design/…Brief-Claude-Design-Refonte_v01_Interne.md` | Brief de refonte remis à Claude Design — **historique** : intention, maquettes, voix et anti-objectifs. Ne fait plus autorité sur l'implémentation, que `DESIGN.md` décrit |
| — | `.claude/design/20261009_PLAN_EODA_Implementation-maquettes-v2_v01_Interne.md` | **Plan d'implémentation des maquettes v2** (Cabinet, Client, Espace structure accompagnée, Tablette) : ordre de construction (socle → refontes → schéma), écarts maquette → règles du dépôt, questions avec réponse par défaut. Les maquettes elles-mêmes restent hors dépôt (noms réels du pilote) |

**Règle :** avant de générer du code touchant au métier HAS (cotation, critères, documents
obligatoires), Claude Code doit relire `context/02-referentiel-has.md` et
`context/03-documents-obligatoires.md` — c'est la source de vérité, pas la mémoire du modèle.
Le référentiel HAS a des règles précises (NC interdit sur impératifs, RI uniquement chapitre 1,
★ = 4/4) qui sont des pièges fréquents si reconstitués de mémoire.

## 4. Stack technique (résumé — détail dans `specs/02-architecture-technique.md`)

- **Frontend :** Next.js 14+ (App Router), TypeScript strict, Tailwind CSS, shadcn/ui
- **Backend :** API Routes Next.js (puis extraction possible en service séparé si besoin),
  Node.js 20+
- **Base de données :** **Supabase PostgreSQL**, région `aws-0-eu-west-1` (Irlande), Prisma ORM
  — remplace Prisma Postgres depuis le 21/08/2026
- **Stockage fichiers :** **Supabase Storage** (S3-compatible, même projet que la BDD, donc
  même région Europe) — jamais AWS us-east par défaut. **Provisionné le 01/09/2026** :
  bucket `eoda-documents`, clé d'accès S3 et les cinq variables `S3_*` dans `.env.local`.
  Aller-retour vérifié en exécution (envoi, URL signée, relecture 200, suppression, 404
  ensuite). `getFileStoragePort()` sélectionne donc `S3StorageAdapter` **y compris en
  développement** : les dépôts ne vont plus sur le disque local. Reste à confirmer côté
  Supabase : le chiffrement at-rest.
- **Auth :** Auth.js (NextAuth) — comptes Cabinet (Sandrine + futurs collaborateurs) et
  comptes Client (un par établissement)
- **Analyse documentaire :** extraction texte (pdf-parse / mammoth pour docx) +
  appel LLM avec prompt structuré contre le référentiel HAS (`lib/llm/`). **État réel au
  08/10/2026** : si `OPENROUTER_API_KEY` est posée, le modèle par défaut est
  `minimax/minimax-m2.7` (et Gemini pour les images) via OpenRouter, sinon Anthropic
  direct. **Décision Damon du 08/10/2026 : on reste sur OpenRouter** (remplace la cible
  Haiku + Sonnet de `09-vision-produit.md` §6.3). Le choix du modèle reste réglable par
  OpenRouter ; ce qui ne se règle pas, c'est la conservation des données par le
  fournisseur final — à verrouiller par les options de routage d'OpenRouter (refus de la
  collecte de données, fournisseurs sans conservation) au moment de la migration du
  backend (§6, HDS).
- **Hébergement app :** **Vercel**, région `cdg1` (Paris) — `vercel.json` à la racine ;
  remplace Prisma Compute depuis le 21/08/2026 (`prisma.compute.ts` et le paquet
  `@prisma/compute-sdk` ont été supprimés le 22/08/2026 : le SDK tirait un `tar` vulnérable
  pour du code plus jamais exécuté).
  Écart assumé par rapport au §6 qui nomme Scaleway/OVHcloud : la contrainte qui compte est
  l'hébergement **en Europe**, satisfaite par Vercel `cdg1` et Supabase `eu-west-1`. Vercel et
  Supabase restent des sociétés américaines — décision produit de Damon, pas une conformité
  acquise (détail : `specs/02-architecture-technique.md` §1, note ADR).
- **Environnement :** **une seule source de vérité**, le `.env.local` de la racine.
  `apps/web/.env.local` et `packages/database/.env` sont des **liens symboliques** vers lui.
  Ne jamais les recréer en fichiers réels : le 21/08/2026, trois fichiers décrivaient deux
  bases différentes et l'application tournait silencieusement sur une autre base que celle
  décrite par la documentation.
- **Monorepo :** structure simple `apps/web` + `packages/` partagés si besoin, gérée au
  pnpm workspace — pas de sur-ingénierie en V1

## 5. Principes d'architecture (SOLID appliqué pragmatiquement)

- **Single Responsibility** : un service = une responsabilité (`DocumentAnalysisService` ne
  fait pas aussi le matching de checklist — voir `specs/02-architecture-technique.md` §services)
- **Open/Closed** : le moteur de règles documentaires et le moteur de cotation HAS doivent
  être extensibles par configuration (nouvelles catégories de documents, évolution du
  référentiel HAS dans le temps) sans réécrire le cœur
- **Dependency Inversion** : le code métier ne dépend jamais directement d'un SDK externe
  (S3, LLM provider) — toujours via une interface/port, pour pouvoir changer de fournisseur
  de stockage ou de LLM sans casser le métier
- **Pas de couplage prématuré** entre les 3 modules : le module Auto-évaluation HAS doit
  pouvoir vivre indépendamment du module Analyse documentaire, même s'ils partagent le
  concept d'« établissement » et de « critère HAS »
- **Évolutivité explicitement préparée** (ne pas construire maintenant, mais ne rien faire
  qui l'empêche) : gestion EI/EIG, registre plaintes/réclamations, reporting KPI/Power BI,
  multi-cabinet (si EODA recrute), export Synaé

## 5 bis. Sécurité — règles à appliquer sans exception

Détail complet et état d'avancement : `specs/02-architecture-technique.md` §4.

- 🔐 **Une seule couche d'autorisation** : `apps/web/src/lib/auth/guards.ts`. Ne **jamais**
  réécrire un contrôle d'accès dans une action serveur, ni recopier une garde localement.
  C'est ainsi qu'on obtient des divergences (une action qui vérifie le tenant, une autre qui
  l'oublie) et donc des IDOR — c'est exactement ce que l'audit du 2026-08-19 a trouvé.
- 🔐 **Un identifiant reçu par une action serveur est une entrée non fiable.** Un
  `establishmentId`, `missionId`, `sessionId`, `documentVersionId` vient d'une route HTTP
  publique, pas de l'UI. Toute action qui en reçoit un doit vérifier son appartenance
  (`requireEstablishmentInTenant`, `requireEstablishmentAccess`), pas seulement la session.
- 🔐 **Fail-closed.** Le motif `if (user.tenantId) where.tenantId = user.tenantId` est
  interdit : un filtre omis rend la requête globale. Pas de tenant ⇒ pas d'accès.
- 🔐 **`notFound()` et jamais `redirect()`** sur un objet hors périmètre — ne pas révéler
  qu'un identifiant existe dans un autre tenant.
- 🔐 **Pas de cast d'enum sur une entrée** : `formData.get("x") as "A" | "B"` ne valide rien
  à l'exécution. Passer par `lib/validation/form-parsers.ts`.
- 🔐 **Fichier déposé** : type déterminé par signature binaire (jamais `File.type`), nom
  d'origine jamais concaténé dans une clé de stockage (`lib/security/upload-validation-service.ts`).
- 📋 **Journaliser tout accès à un document** (`recordAuditEvent`) — secteur médico-social,
  traçabilité attendue. Jamais de donnée personnelle dans le champ `detail`.

## 6. Contraintes non négociables

- 🇪🇺 **Hébergement Europe** — données de santé/social, RGPD strict
- 🔒 **Données sensibles** — chiffrement at-rest, accès cloisonné strict par établissement
  (un client ne voit jamais les données d'un autre client)
- 🎨 **Charte EODA obligatoire** sur toute interface visible (voir `context/04-charte-eoda.md`)
- 📁 **Convention de nommage fichiers** EODA : `AAAAMMJJ_TYPE_CLIENT_OBJET_vXX_Interne|Externe.ext`
  à respecter pour tout export généré par la plateforme
- 🧩 **Le référentiel HAS évolue** (dernière MAJ juillet 2025) — ne jamais hardcoder les
  règles de cotation dans la logique applicative sans passer par une couche de configuration
  versionnée (cf. `specs/02-architecture-technique.md` §moteur-regles-has)
- ♿ **Accessibilité : « même un enfant de 12 ans doit pouvoir s'en servir »** (Damon,
  30/09/2026). Objectif WCAG 2.2 AA + règles FALC sur le portail client et l'espace équipe.
  Règles d'usage de la charte (contrastes mesurés, tailles minimales) :
  `context/04-charte-eoda.md` §7. **Contrôle mécanique branché le 09/10/2026 (tranche S1)
  pour trois règles** : texte ≥ 14 px (l'échelle Tailwind commence à 14 px — `text-xs`
  compris — et toute taille arbitraire inférieure est refusée), focus visible (aucun
  `outline-none` : le contour ambre de 3 px de `globals.css` ne peut pas être retiré),
  contraste ≥ 4.5:1 des paires de tokens de rôle, clair ET sombre, recalculé depuis
  `globals.css` (`lib/design/ui-class-guard.test.ts`, `lib/design/theme-contrast.test.ts`).
  Le nouveau code écrit les tokens de rôle (`text-ink`, `bg-card`, `text-accent-text`…) ;
  `--muted` / `gris-mid` est réservé au décor (3.7:1 sur le papier).
  **Dette soldée le 13/10/2026** : `text-gris-mid` (→ `text-ink2`) et `text-terre`
  (4.29:1 → `text-accent-text`) ne sont plus écrits en couleur de texte, et le garde
  `findLowContrastTextColors` (`ui-class-guard.test.ts`) refuse désormais `text-gris-mid`,
  `text-muted` et `text-terre`, avec variante (`hover:`, `placeholder:`) ou opacité ;
  `theme-contrast.test.ts` prouve que ces teintes sont sous 4.5:1 en clair.
  **Reste dette déclarée** : `eslint-plugin-jsx-a11y` en error, axe-core en CI sur les
  pages client, hiérarchie de titres (h1 unique) non vérifiée mécaniquement.
- 🏥 **Données de santé (HDS) — décision prise le 08/10/2026 : le backend migre.** Un DIPC
  signé, un PAP, une évaluation des besoins, une enquête de satisfaction **nominative**
  sont des données de santé (CSP L1111-8, référentiel CNIL médico-social) ; Supabase et
  Vercel **ne sont pas certifiés HDS**. Damon a tranché : l'enquête reste **nominative**,
  et **tout le backend change pour un hébergement conforme** (09 §8, option b). Le lot C
  (tablette, enquête, dossier usager, signature) **peut se construire** ; ce qui reste
  interdit, c'est d'**envoyer en production** une donnée nominative de personne
  accompagnée **avant** que la migration soit faite et vérifiée. Les documents
  institutionnels restent dans le périmètre actuel.
  **Le verrou est mécanique depuis le 14/10/2026** (ADR
  `specs/adr/20261014_ADR_lot-C-verrou-HDS.md`) : toute donnée de personne accompagnée
  (dossier, représentant, feuille de réception signée, preuve de signature, remise,
  journal, réponse d'enquête) passe par `BeneficiaryDataPort` (`lib/hds/`). L'adaptateur
  par défaut, `LockedBeneficiaryDataAdapter`, **refuse toute écriture**
  (`HdsNotAvailableError`) et rend des lectures vides ; les fichiers signés passent par
  `getHdsFileStoragePort()`, jamais par le bucket `eoda-documents`, verrouillé de même.
  L'adaptateur Prisma réel n'est sélectionnable que si `HDS_BACKEND_ENABLED="true"` **et**
  `HDS_PROVIDER` + `HDS_S3_*` (bucket distinct) sont posés — sinon la production refuse
  de démarrer. Ne **jamais** écrire `prisma.beneficiary…` / `prisma.survey…` ailleurs que
  dans `lib/hds/prisma-beneficiary-data-adapter.ts` (test qui échoue), ne jamais poser
  `HDS_BACKEND_ENABLED` sur l'infrastructure actuelle, et ne jamais « tester » avec une
  vraie personne. **Le cabinet ne lit que des chiffres** (décision de Damon, 14/10/2026,
  minimisation RGPD/HDS ; ADR 20261014 point 8) : la liste nominative est réservée à la
  structure — `getPeopleBoard` répond `notFound()` à un compte cabinet, qui passe par
  `getPeopleAggregates` / `getSurveyBoard` et `listBeneficiaryTimelines` (identifiant +
  dates, aucun champ nominatif sélectionné). Ne jamais « rendre service » en rouvrant la
  liste côté cabinet. Les écrans d'écriture affichent l'état verrouillé et se démontrent en
  **mode démonstration** (en mémoire du navigateur, données fictives, port jamais appelé).
  Les appareils enregistrés et codes des salariés (`DeviceEnrollment`, `StaffPin`) ne
  sont pas des données usager et restent sur l'infrastructure actuelle.

## 7. Ce que Claude Code ne doit PAS faire

- Ne pas réinventer le système de cotation Qualiscope (A/B/C/D) — **interdit**, c'est un
  référentiel différent. Le seul système valide est **1/2/3/4/★/NC/RI** (voir glossaire).
- Ne pas confondre les 137 critères des grilles Synaé (ce qui est évalué en pratique sur le
  terrain) avec les 157 critères du manuel HAS complet (qui inclut des critères non
  applicables à tous les types d'ESSMS) — toujours préciser le périmètre.
- Ne pas présenter la plateforme comme un outil d'évaluation HAS officiel — c'est un outil
  de préparation/conseil.
- **L'IA peut être nommée, mais jamais sans sa réserve** (décision Damon du 08/10/2026,
  après accord de Sandrine — remplace l'interdiction du 30/09). Le libellé « Analysés par
  l'IA » reste. Ce qui ne change pas : une sortie de modèle reste une **proposition** avec
  les gestes Accepter / Corriger, soumise à `analysisVisibleTo`, et EODA vend la relecture
  humaine. Ce qui devient obligatoire : pour une structure **en autonomie** (palier seul,
  sans relecture EODA), tout document produit ou corrigé porte la mention qu'**il n'a pas été
  revérifié par un humain, peut comporter des erreurs, et doit absolument être relu** avant
  usage — à l'écran, dans l'export et dans l'e-mail qui l'annonce. Jamais « validé »,
  jamais « conforme » sans relecture.
- **Générer un document corrigé est payant, en deux niveaux** (décision Damon du
  08/10/2026) : (1) la génération seule, en autonomie, avec la réserve ci-dessus ; (2) la
  génération **vérifiée par un consultant EODA**, plus chère. Les montants ne sont **pas**
  fixés — ne pas en inventer. Conséquence dans le code (**fait le 10/10/2026**) :
  `generateDocumentDraft` vérifie le droit de la mission AVANT d'appeler le modèle
  (`correctionRight` de `offer-scope-service.ts`, qui lit enfin `correctionScope`) :
  Essentiel = rien ; Performance = `IMPERATIVES_AND_PROCESSES` (D11 — transposé en
  catégories LOI_2002_2 + QUALITE_RISQUES, provisoire jusqu'à la liaison type ↔ critère
  de N4) ; Excellence et bêta-test = tout ; sans mission = refus. Hors droit, le message
  renvoie à la demande d'option existante (`ClientOptionRequest`), sans aucun prix.
  Le geste de génération et le geste de vérification EODA restent deux faits distincts,
  jamais fusionnés : seul le second permet d'afficher « relu par EODA ».
- **Les modes opératoires de Sandrine font foi pour l'IA**
  (`context/11-modes-operatoires-sandrine.md`, transcription de « Guide EODA Mode
  Opératoire » et « Mode Opératoire Analyse Documentaire ») : les prompts d'analyse et de
  mise en conformité les suivent **à la lettre**. En cas de contradiction avec
  `context/10-regles-mise-en-conformite.md` (règles dites en séance), le mode opératoire
  écrit l'emporte et la contradiction est signalée à Damon.
- Ne pas utiliser de pictogrammes **ARASAAC** ni **SantéBD** : leurs licences interdisent
  l'usage commercial (vérifié le 30/09/2026). Icônes Lucide, ou pictogrammes propres à EODA.
- Ne pas apposer le **logo FALC européen** tant que les textes n'ont pas été relus par des
  personnes concernées (condition d'usage d'Inclusion Europe).
- **Ne jamais passer `DATABASE_URL` (ni `DIRECT_URL`) comme `--shadow-database-url`.** Prisma
  *détruit et rejoue* la base désignée comme shadow database. `prisma migrate diff
  --shadow-database-url "$DATABASE_URL"` a effacé la base de développement partagée le
  19/08/2026 (tenant, comptes, catalogue, tout). Utiliser `SHADOW_DATABASE_URL`, qui doit
  pointer une base jetable — cf. `.env.example`. Pour vérifier une migration sans base
  jetable : `prisma validate` + relecture du SQL, jamais `migrate diff` sur la vraie base.
- **Le pool de connexions se borne à la construction du client, jamais par une variable
  d'environnement discrétionnaire.** Le 16/10/2026, la page d'accueil cabinet est tombée sur
  `FATAL: (EMAXCONNSESSION) max clients reached in session mode — max clients are limited to
  pool_size: 15`. Deux faits mesurés se cumulaient : `DATABASE_URL` vise le pooler Supabase en
  **mode session** (port 5432 — chaque client occupe une connexion serveur, plafond dur de 15,
  partagé entre le poste, les prévisualisations et la production puisque c'est **une seule
  base**), et sans paramètre Prisma ouvre `nb_cpu_physiques × 2 + 1` connexions **par
  processus** — 21 sur un poste à 10 cœurs. `resolveRuntimeDatabaseUrl`
  (`packages/database/src/database-url.ts`, pur, testé) pose donc `connection_limit=1` sur
  l'URL runtime avant que le client existe, et complète `pgbouncer=true` si l'URL vise le port
  6543 (mode transaction : les requêtes préparées n'y tiennent pas). Il **ne réécrit pas le
  port** : passer en 6543 est un choix d'infrastructure, qui doit se lire dans `DATABASE_URL`
  et s'entendre au démarrage (`connectionPoolWarning`, via `reportConnectionPoolState` de
  `lib/config/startup-check.ts`), jamais se deviner d'un code qui transforme une URL en
  silence. Ne jamais « simplifier » en déplaçant ce réglage dans `DATABASE_URL` : le poste, les
  prévisualisations et la production doivent obéir à la même règle, et une variable oubliée
  reproduit exactement l'incident. Le mode session produit un **avertissement**, pas un refus
  de servir : refuser éteindrait l'application au moment précis où elle rame.
- Ne pas committer de vraies données clients (ASSAD BENOIT) dans des fixtures de test — créer
  des fixtures anonymisées génériques.
- Le pipeline commercial (prospects/devis/catalogue/KPI, décrit dans
  `context/07-outil-pilotage-missions.md`) est intégré à la plateforme depuis le module
  `/dashboard/cabinet/commercial`, réservé à la capacité `COMMERCIAL` — rôles
  `CABINET_ADMIN` **et** `CABINET_COMMERCIAL` depuis N9 (13/10/2026), jamais
  `CABINET_EVALUATOR`, `CABINET_READONLY` ni `CLIENT_USER`. Garde : `requireCommercialSession()`,
  vérifiée page par page et export par export (`commercial-pages-guard.test.ts`). Ces données
  restent malgré tout strictement internes :
  ne jamais les exposer sur une route accessible à un `CLIENT_USER`, ni les inclure dans un
  livrable/export destiné à un client.
  **Exception décidée le 20/08/2026 (Damon), à ne pas « corriger » :** un client voit, sur son
  portail, **son propre contrat** — offre souscrite, options souscrites, montant signé, acompte,
  solde — **et** les options non souscrites avec leur prix « à partir de », qui sont la base du
  paywall du §12.6. Ce qui reste interdit : le catalogue interne dans son ensemble, les données
  d'un autre client, le pipeline de prospection, les devis non signés d'autrui, les KPI
  commerciaux. La règle §12.3 tient toujours : le client demande, **Sandrine déclenche** — voir
  une option et son prix n'est pas la même chose que se l'auto-attribuer.
  **Implémenté** dans `/dashboard/client/accompagnement` (lecture :
  `lib/actions/client-contract.ts`, règles pures : `lib/services/client-contract-service.ts`,
  file côté cabinet : `lib/actions/option-request.ts`). Deux natures de prix y coexistent et ne
  doivent jamais être rendues pareil : les montants du devis signé sont **fermes**
  (`formatEuros` / `formatPriceWithUnit`), les prix du catalogue sont des **« à partir de »**
  (`formatStartingPrice`). Il n'existe **pas** de lien direct `Establishment → Devis` : la
  résolution passe par `Prospect.establishmentId`, et sans devis `SIGNE` unique **aucun montant
  n'est affiché** — ne jamais « réparer » ça par un rapprochement de noms.
- **Rôles cabinet et capacités (N9, 13/10/2026).** Quatre rôles : `CABINET_ADMIN` (tout),
  `CABINET_EVALUATOR` (consultante : structures, documents, évaluation, mission **sans
  montants**), `CABINET_COMMERCIAL` (pipeline commercial, **aucune** structure, ni équipe EODA
  ni réglages), `CABINET_READONLY` (lit les structures, n'écrit rien, ne voit pas le
  commercial). La matrice vit dans `lib/auth/capabilities.ts` (pur, testé case par case) et
  n'est appliquée QUE par `lib/auth/guards.ts` : chaque garde reçoit la capacité ou le mode
  (`"READ"` / `"WRITE"` / `"CONTRACT"`, `NEED.*`) en argument **obligatoire** — ne jamais
  réécrire un `role === "CABINET_ADMIN"` dans une page ou une action. Une action gardée en
  lecture n'écrit rien (`read-guards-never-write.test.ts`). Les montants d'une structure
  (périmètre contractuel, contrat, avenant, prix proposés au démarrage d'une mission) exigent
  `STRUCTURE_CONTRACT` : masqués ET refusés côté serveur pour une consultante.
  **Affectation consultante ↔ structures** (`EstablishmentAssignment`) : une consultante
  affectée ne voit QUE ses structures (listes filtrées par `structureScopeWhere`, objet d'une
  autre structure → `notFound()`) ; **sans aucune affectation elle voit tout** — choix de
  compatibilité des comptes existants, à ne pas « corriger » en fail-closed sans décision.
  Équipe EODA : `/dashboard/cabinet/equipe` (administration seule) ; jamais retirer son propre
  accès ni le dernier administrateur (`cabinet-team-service.ts`).
- **Rôles d'accès CLIENT (N9).** `EstablishmentUser.accessRole` (`DIRECTION`,
  `RESPONSABLE_QUALITE`, `ADMINISTRATIF`, `INTERVENANT`, défaut `DIRECTION` pour les liens
  existants) est distinct de `roleInEstablishment` (le POSTE). Même matrice pure
  (`capabilities.ts`, modules DOCUMENTS / DIAGNOSTIC / TASKS / TEAM / MESSAGES / CONTRACT /
  ACCESS, niveaux Tout / Voir / Les siens / —), appliquée par `requireClientEstablishment(need)`
  et `requireEstablishmentAccess(id, need)` — `need` obligatoire. Seule la DIRECTION gère les
  accès de SA structure (`/dashboard/client/parametres`) ; un retrait **désactive** le lien
  (`revokedAt`), jamais de suppression, et les gardes ignorent un lien retiré. EODA n'est
  jamais un rôle client. Messages / rendez-vous ouverts aux trois rôles de bureau, fermés à
  l'intervenant : choix de N9, à confirmer.
- **Équipe et quiz de sensibilisation (lot B, N10).** « Sensibiliser », jamais « former ».
  `StaffMember` existe sans compte (rotation), ne se supprime pas (`active`/`leftAt`). Les
  questions sont du CONTENU versionné (`content/quiz/`, provisoires, à valider par Sandrine)
  — corriger une question incrémente `version`. `QuizAttempt` est append-only ; « À jour /
  À refaire / Pas fait » se DÉRIVE (`quiz-status-service.ts`, retest 6 mois). La seule route
  publique nouvelle est `/quiz/[token]` (`classifyPath` dans `lib/auth/routes.ts`, testé) :
  jeton 256 bits jamais stocké (empreinte SHA-256 comparée en temps constant), usage unique
  posé atomiquement, 72 h, limitation de débit par IP, rien d'autre que le nom de la
  structure et le quiz sans ses réponses. QR code rendu côté serveur (`qrcode-generator`
  épinglé, aucune dépendance), pas de SMS. L'alerte d'échéance (D12) est une tâche
  `ActionItem` source QUIZ créée **idempotemment au chargement** de l'onglet par un rôle qui
  écrit — pas d'horloge ni de cron (aucun n'existe sur Vercel ici).
- **Terrain (lot C, 14/10/2026) — construit, verrouillé HDS** (§6, ADR 20261014). Module
  client `TERRAIN` (direction + responsable qualité ; administratif et intervenant : aucun ;
  cabinet : `STRUCTURES_READ`, en lecture) : `/dashboard/client/personnes` (dossiers, tablettes
  et codes), `/dashboard/client/enquetes` (statistiques AGRÉGÉES, jamais nominatives ; plan
  d'action PROPOSÉ sous 75 %, `ActionItem` source `ENQUETE` recalculé côté serveur ; export
  CSV agrégé `/api/export/enquete/[id]`), onglets `personnes` / `enquetes` de la fiche —
  l'onglet cabinet `personnes` n'affiche **que des agrégats** (nombre de personnes,
  feuilles de réception à jour / à remettre ou à renouveler, enquêtes faites, échéances ;
  `beneficiary-aggregate-service.ts`), jamais de liste nominative (§6) ; l'onglet cabinet
  `enquetes` n'affiche **aucun commentaire libre** (idées, propositions sur le règlement —
  un texte libre peut contenir un nom ; décision de Damon du 14/10/2026) : retirés côté
  serveur par `getSurveyBoard` (`withoutFreeTexts`), la structure les garde.
  **Tablette** `/tablette` (route ANONYMOUS de `classifyPath`) : « jamais un code seul » —
  appareil enregistré par la structure (`DeviceEnrollment`, jeton en cookie httpOnly,
  empreinte seule en base) + fiche salarié + code de 6 chiffres (`StaffPin`, scrypt, blocage
  au 5e échec, déblocage par la direction), session signée de 30 min ; gardes
  `resolveTabletDevice` / `resolveTabletSession` dans `guards.ts`. Les écritures usager
  (`lib/actions/terrain-write.ts`) vérifient la garde PUIS le verrou avant même de lire le
  formulaire. Le parcours se montre sur `/tablette/demonstration` (en mémoire, données
  fictives, aucun appel serveur) — ne jamais y brancher d'action. Questionnaires = contenu
  versionné (`content/enquete/`, transcription du gabarit de Sandrine) ; points « à dire » de
  la feuille de réception **provisoires**. Signature : PNG final seul, jamais le tracé.
- Le suivi de mission (checklist diagnostic 12 items + 4 phases d'accompagnement, §7 du même
  fichier) est également intégré, sous `/dashboard/cabinet/etablissements/[id]/mission` —
  lisible par `CABINET_ADMIN`, `CABINET_EVALUATOR` et `CABINET_READONLY` (contrairement au
  pipeline commercial ci-dessus) car c'est du suivi opérationnel d'accompagnement ; sa carte
  « Périmètre contractuel » (montants) reste à l'administration. La
  formule contractuelle qui gouverne le périmètre d'une mission (§7.3 — verrouillage
  Suivi/Préparation finale hors Excellence ou bêta-test gratuit) vit sur `Mission.formule`,
  pas sur `Establishment.commercialTier` (resté hardcodé `BETA`, affichage/historique
  uniquement) — ne jamais dupliquer cette décision sur les deux modèles.
  **Quatre ÉTAPES affichées (décision 3 des maquettes v2, corrigée par Damon le
  10/10/2026), affichage seulement** : Diagnostic / Mise en conformité / Suivi /
  Préparation finale. Elles ne correspondent PAS une à une aux phases stockées (le
  renommage du 09/10 appelait `FONDATIONS` « Diagnostic », en double avec la checklist) :
  étape 1 Diagnostic = la checklist `DIAGNOSTIC` (12 items, sans dates) ; étape 2 Mise en
  conformité = `FONDATIONS` + `DEPLOIEMENT` regroupées (début de la première, fin de la
  seconde, état dérivé des deux) ; étape 3 Suivi = `CONSOLIDATION` ; étape 4 =
  `PREPARATION_FINALE`. Chaque phase stockée reste éditable sous son étape (« Mise en
  conformité — fondations » / « — déploiement »). Sources uniques : `MISSION_STEPS`,
  `stepPercent` et `PHASE_LABELS` (`mission-progress-service.ts`) ; frise dans
  `structure-sheet-service.ts`. Ne jamais renommer l'enum ni les colonnes
  `fondationsStartDate`… : ce serait une migration destructive pour un mot.
  **Corollaire depuis le 20/08/2026** : les options souscrites vivent elles aussi sur la mission (`MissionOption`,
  peuplée à la signature par `lib/actions/conversion.ts`). Les `DevisOption` restent le
  **document commercial** — ils font contrat et ne se réécrivent jamais — et servent de repli
  de lecture pour les missions antérieures à cette bascule.
  **Complété le 22/08/2026** : le cabinet peut aussi rattacher une option **à la main** au
  périmètre d'une mission, depuis `/dashboard/cabinet/etablissements/[id]/mission` — le cas
  d'un établissement créé directement, sans devis (le bêta-test, notamment), qui n'avait
  jusque-là aucun moyen d'avoir des options. D'où `MissionOption.priceIsFirm`, qui n'est pas
  cosmétique : `true` = montant issu d'un devis signé, il fait contrat et l'option **ne peut
  pas être retirée depuis cet écran** (avenant obligatoire) ; `false` = montant recopié du
  catalogue, donc un « à partir de », rendu comme tel côté portail client. Ne jamais fusionner
  les deux chemins de création « puisque c'est le même objet » : ils n'ont pas la même valeur
  juridique. Règles pures dans `lib/services/mission-option-service.ts`.
- **L'identité de la structure se saisit au stade PROSPECT, et se recopie.** FINESS,
  adresse, type de SAD et échéance HAS visée vivent sur `Prospect` (facultatifs — un
  prospect dont on ne connaît que le nom doit pouvoir entrer dans le pipeline) et
  pré-remplissent l'écran de signature, qui continue de les EXIGER avant de créer la
  fiche. Règles pures dans `lib/services/structure-identity-service.ts` : normalisation
  du FINESS (« 93 00 34 459 » = « 930034459 »), contrôle de forme partagé entre le
  prospect et la signature, et refus explicite d'un FINESS déjà rattaché à une autre
  fiche — sans lui, la contrainte unique tombait dans le `catch` général de la
  conversion, qui annonce « conversion déjà enregistrée », soit le contraire de ce qui
  s'est passé. `Prospect.finessNumber` n'est **pas** unique : deux prospects peuvent
  désigner la même structure pendant une prospection, c'est la création de la FICHE qui
  tranche. Le type de SAD reste **demandé** à la signature, jamais déduit.
- **Une fiche client ne se crée QUE par la signature d'un devis.** Il n'existe
  volontairement plus de `createEstablishment` ni de route `/etablissements/nouveau`
  (supprimés le 23/08/2026). Une création manuelle produisait un établissement sans
  prospect, sans devis et sans chiffre d'affaires — donc absent de tous les indicateurs
  commerciaux — et redemandait FINESS / adresse / échéance HAS **avant** qu'aucune
  relation commerciale n'existe. Un seul chemin : prospect → devis → signature. Si le
  besoin « client déjà signé hors plateforme » revient, il passe par un prospect et un
  devis, jamais par une seconde porte. **Libre-service (décision du 08/10/2026, implémenté
  le 13/10/2026)** : une structure qui s'inscrit seule et fait le diagnostic devient un
  **prospect** (`AcquisitionChannel.LIBRE_SERVICE`), visible du cabinet pour être
  démarché — **pas** une fiche client. La fiche client naît toujours et seulement de la
  signature. Concrètement :
  - routes publiques `/` (landing) et `/inscription` (trois étapes) — liste EXACTE dans
    `classifyPath` (`lib/auth/routes.ts`, testée), CSP à nonce comme partout ; un visiteur
    connecté est renvoyé à son espace. `signUpSelfService` (`lib/actions/self-service.ts`) :
    débit sur l'IP **et** l'adresse, validation serveur des trois étapes
    (`self-service-service.ts`), **même réponse** que l'adresse ait un compte ou non (même
    coût bcrypt, e-mail différent ; depuis le 14/10, création du compte et envois
    **déférés par `after()`** des deux côtés — aucune fuite de durée, test), un seul cabinet en base sinon inscription fermée.
    Crée `Prospect` + `User` au rôle **`PROSPECT_USER`** + lien `ProspectAccount` ;
  - `PROSPECT_USER` n'a **aucune capacité** : toutes les gardes le refusent par
    construction ; `requireProspectSession()` (`guards.ts`) résout le prospect depuis le
    LIEN, jamais depuis un identifiant reçu ; `portalRedirectFor` (middleware) le
    cantonne à `/espace` et en tient tout autre rôle à l'écart ;
  - espace `/espace` : diagnostic **déclaratif** (questions `content/pratiques/` par
    impératif du profil, table `ProspectPracticeAnswer` **distincte** de `PracticeAnswer`,
    qui reste rattachée à un établissement), liste de travail estimée DÉRIVÉE
    (`prospect-diagnostic-service.ts`), « Être accompagné » = `Appointment` R1 au statut
    **`DEMANDE`** (préférence libre jour + moment, aucun agenda de disponibilités) + alerte
    au cabinet par le port e-mail **sans** le message. **Aucun dépôt de document** avant
    la signature — c'est dit à l'écran. Le cabinet confirme une demande ; il ne pose
    jamais `DEMANDE` lui-même ;
  - le cabinet voit l'AVANCEMENT et l'activité d'une structure inscrite, jamais le contenu
    de ses réponses (tableau Prospects, fiche « en autonomie » `SelfServicePanel`).
  - **adresse confirmée avant toute ouverture** (tranche 11, décision de Damon) : le
    compte naît avec `User.emailVerifiedAt` à null ; l'e-mail porte un lien
    `/confirmer-email/<jeton>` (route ANONYMOUS, empreinte SHA-256 seule en base dans
    `EmailVerificationToken`, temps constant, usage unique, 24 h, débit limité — socle
    `lib/security/one-time-token.ts` partagé avec le quiz). La page ne confirme
    **qu'au clic** (un scanner de messagerie ne consomme pas le jeton). `authorize()`
    refuse, APRÈS bcrypt, un compte qui a un `ProspectAccount` et pas d'adresse
    confirmée (`isEmailVerificationPending`) ; l'écran le dit et propose « renvoyer le
    lien » (`resendVerificationLink` : même réponse que l'adresse existe ou non, travail
    réel dans `after()`). Un compte créé par le cabinet n'est **jamais** concerné.
    Sans Resend, l'écran dit « e-mail non envoyé en local » et, **en développement
    seulement** (`confirmationLinkDisclosure`, testé), montre le lien — jamais en
    production ;
  - **bascule à la signature** (tranche 11) : `convertDevisToClient` fait des comptes
    encore `PROSPECT_USER` du prospect des `CLIENT_USER` rattachés à la fiche créée
    (`accessRole = DIRECTION`, poste `AUTRE` — non deviné), **dans la transaction**
    de signature (`lib/db/promote-prospect-accounts.ts`, règle pure
    `selectAccountsToPromote`), une trace `PROSPECT_ACCOUNT_PROMOTED` par compte.
    L'écran de signature l'annonce avant le clic et ne propose plus d'inviter la même
    personne. Un prospect démarché sans compte n'est pas touché. La session encore
    « prospect » est fermée par `requireProspectSession` avec un motif
    (`prospectSpaceExitPath`) ; à la reconnexion, `/espace` renvoie au portail client.
    La bascule ne lève pas l'exigence d'adresse confirmée.
- **L'état d'une fiche est DÉRIVÉ, jamais stocké** — `lib/services/lifecycle-service.ts`
  (pur, testé). `SIGNE` / `EN_COURS` se calculent à partir des faits (items de
  diagnostic cochés, dates de phases posées) ; `TERMINE` vient de `Mission.closedAt`,
  seul fait non dérivable parce que la clôture est une décision, pas un calcul. Ne
  **jamais** ajouter `Establishment.status` : le dépôt porte déjà quatre sources d'état
  et `commercialTier` a démontré ce qui arrive à la cinquième — ajoutée, puis plus
  jamais mise à jour, elle annonçait « Bêta-test gratuit » à des clients payants.
  Le bêta-test (`Mission.gratuit`) est un **attribut orthogonal**, pas une étape : une
  mission gratuite peut être signée, en cours ou terminée.
- **Les indicateurs commerciaux se dérivent des faits, jamais d'un compteur stocké.**
  Depuis le 13/10/2026 (maquette v2, demande de Damon : « le nouveau design est
  meilleur »), la vue d'ensemble commerciale est l'entonnoir en **cinq cartes**
  (Inscrites seules → Diagnostic terminé → Appel réservé → Devis en cours → Signés dans
  l'année), le bloc **« À faire »** (appel à préparer, devis envoyé depuis > 7 jours —
  dernier envoi tiré du journal `DEVIS_EMAIL_SENT`/`DEVIS_REMINDER_SENT` —, brouillon à
  finir, structure inscrite inactive depuis 10 jours) et les **abonnements actifs** par
  formule de MISSION — `commercial-overview-service.ts` (pur, testé). Les prospects
  démarchés entrent dans l'entonnoir à « Devis en cours ». Seuls les prospects **non
  convertis** sont lus (un prospect converti garde `SIGNE` à vie). **Le kanban par étape
  est retiré** (et avec lui `FunnelChart`, `getProspectKpiCounts`) : le tableau
  « Prospects » le remplace, avec le filtre **Origine** (libre-service / démarché — la
  maquette ne montrait que le libre-service) ; l'étape commerciale se change sur la
  fiche, la grille de découverte y reste. Côté **portefeuille**, un seul compteur
  survit : « Évaluations HAS dans moins de 6 mois » de l'accueil cabinet
  (`countUpcomingHasEvaluations`, `portfolio-kpi-service.ts`, nourri par
  `to-portfolio-row.ts` depuis les fiches que `getStructuresOverview` charge déjà) ;
  les agrégats que plus aucun écran n'affichait (clients actifs, accompagnements en
  cours, bêta actives, missions par formule, entonnoir unifié) ont été **supprimés**
  en tranche 11 — l'étape d'une fiche se dérive toujours de `lifecycle-service.ts`, et
  un futur compteur s'y adosse plutôt que de recalculer l'état. Ne jamais compter une
  formule depuis `Establishment.commercialTier` : c'est `Mission.formule`.
- 🎨 **Le logo ne se redessine pas.** Assets officiels dans `apps/web/public/`
  (`logo-eoda.png` = bloc complet pour fonds clairs, `marque-eoda.png` = rond pour
  fonds sombres), servis par `components/layout/EodaLogo.tsx`. Source :
  `context/Documents/20260827_CHARTE_EODA_Couleurs-et-logo_v01_Interne.pptx`. Ces
  fichiers sont PUBLICS (exclus du matcher du middleware) parce qu'un e-mail doit
  pouvoir charger le logo hors session.
- **Deux mentions, jamais interchangeables** (`document-ownership-service.ts`) : la
  **paternité** (« créé par EODA […] propriété de EODA, qui en concède le droit
  d'exploitation à X ») va sur les documents PRODUITS pour la structure ; la mention
  de **prestation** va sur les documents contractuels (devis, avenant), où EODA ne
  revendique rien. Revendiquer la propriété d'un devis serait faux. Le logo du client
  (`Establishment.logoDataUri`, déposé par le cabinet) s'affiche à côté de celui
  d'EODA sur ces documents ; sans logo, c'est le NOM de la structure qui est écrit —
  jamais un emplacement vide.
- **Ce qu'on réclame au client n'est pas tout ce qu'on produit pour lui.**
  `DocumentType.requestedFromClient` sépare les deux (les **sept** documents de la loi
  2002-2 réclamés depuis la migration du 10/10/2026 — décision du 15/09 —, le reste
  produit par EODA). Le portail client n'affiche que les types réclamés **plus** ceux
  dont un document existe déjà **ou** que la structure a déclarés absents.
  **« Je ne l'ai pas » n'est pas « non concerné »** (N3, `missing-answer-service.ts`) :
  le document reste MANQUANT, à produire (fait « déclaré absent » =
  `statusOverriddenByUser` sur un MISSING, aucun nouvel état), il quitte les relances et
  entre dans la liste de travail dérivée ; « non concerné » est refusé côté serveur sur
  les sept documents de la loi 2002-2, et un ancien « Non » sur ceux-ci se relit comme
  « Je ne l'ai pas » sans réécrire la base. Ne jamais « rétablir » la
  liste complète côté client : demander les 29 à une structure qui fait appel à EODA
  parce qu'elle ne les a pas, c'est lui remettre le travail qu'elle a acheté. La
  liste exacte est modifiable par `CABINET_ADMIN` depuis la fiche client (elle
  attend confirmation des experts de Sandrine).
- **Le parcours d'un document se dérive, sauf sa validation.** Déposé → analysé → mis
  en conformité → restitué → validé (`lib/services/document-workflow-service.ts`).
  Seul `Document.validatedAt` est stocké : valider engage la parole de l'évaluatrice.
  **Décision du 08/10/2026 : deux gestes distincts, jamais fusionnés** — EODA marque
  « relu » (`validatedAt`, parole du cabinet), puis le **client** marque « accepté »
  (`Document.clientAcceptedAt` / `clientAcceptedByUserId`, action `acceptDocument` de
  `lib/actions/client-document-acceptance.ts`, depuis le 10/10/2026 — elle ne touche
  jamais `validatedAt`). Sandrine, 15/09 : « c'est lui qui valide, ce n'est pas moi ».
  Le client n'accepte que ce qu'on lui a montré (`canClientAcceptDocument` : relu par EODA
  en accompagné ; l'analyse affichée sous la réserve en autonomie) ; une version déposée
  après l'acceptation la rend caduque, ce qui se DÉRIVE (`isAcceptanceCurrent`). Le
  portail CLIENT a son propre vocabulaire, dérivé (`client-documents-view-service.ts`) :
  « À déposer », « Reçu, en cours », accompagné « Relu par EODA » → « Accepté par vous »,
  autonomie « À vérifier par vous » → « Accepté par vous · non revérifié par un humain »
  — « les deux portails ne regardent pas la même chose » (call du 26/08). Côté cabinet,
  « À rédiger · EODA » / « Chez la structure » sont dérivés (`deriveMissingOwner`).
- **« Voir » montre le DOCUMENT, jamais ce que l'IA en a lu** (décision de Damon,
  16/10/2026). L'aperçu d'un `.docx` affichait le texte extrait — un texte, pas une
  pièce. Désormais tout document déposé est converti côté serveur en PAGES puis rendu
  par le lecteur PDF du navigateur (vignettes, « n / N », zoom, rotation) : aucun
  visualiseur écrit à la main, aucun kilo-octet de bundle, et le **même artefact** sert
  l'aperçu et l'export PDF (deux artefacts auraient divergé — ce que Sandrine voit ne
  serait plus ce qu'elle envoie). Chaîne : `lib/services/printable-html-service.ts`
  (HTML autonome + nettoyage), `document-pdf-render-service.ts` (conversion puis
  Chromium), `document-pdf-service.ts` (cache), routes
  `/api/documents/[versionId]/pdf` et `/api/templates/versions/[versionId]/pdf`.
  Quatre règles à ne pas casser :
  - **le type se décide par SIGNATURE**, jamais par l'extension ni par `File.type`
    (un `.docx` qui n'en est pas un rend `null`, donc « aperçu indisponible » — pas des
    pages vides) ; le prédicat sur le nom (`canRenderDocumentPages`) ne sert qu'à
    afficher ou non les boutons ;
  - **le fichier est hostile** : `sanitizeExtractedHtml` retire script, `on*`, styles et
    ressources distantes, et Chromium rend avec le réseau COUPÉ (seuls `data:` et
    `about:` passent) — la requête partirait sinon du réseau de l'hébergeur, où
    `169.254.169.254` répond ;
  - **l'aperçu le DIT quand il n'est pas fidèle** (en-têtes, pieds de page, colonnes,
    mise en forme Excel) : c'est la même doctrine que la réserve de l'IA ;
  - **ce qui est dérivé disparaît avec sa source** : `deleteDocumentVersion` supprime le
    rendu en cache (`deleteCachedDocumentPdf`), et un cache illisible ou de signature
    invalide n'est jamais servi — il est refait.
  Le PDF **du document** (`?download=1`, bouton « PDF ») existe là où la structure
  remet une pièce (checklist, `/dashboard/client/livrables`) ; la bibliothèque de
  modèles a l'aperçu paginé et laisse le téléchargement au lecteur natif.
  **Chromium en développement** : le repli embarqué est `@sparticuz/chromium`, un
  binaire **Linux** (AL2023) — sur un poste macOS il ne démarre pas (`spawn ENOEXEC`,
  mesuré le 16/10/2026). Poser `PUPPETEER_EXECUTABLE_PATH` dans `.env.local` (chemin
  d'un Chrome installé, cf. `.env.example`) pour tester l'aperçu et les PDF en local ;
  en production la variable reste vide. Le lancement enveloppe son échec
  (`ChromiumLaunchError`, cause conservée, recours nommé) et l'aperçu **ne propose
  jamais de réessayer** sur cet échec-là : réessayer redonne le même — même règle que
  `devis-pdf-failure.ts`. Jamais le détail technique à l'écran.
- **Chacun ne supprime que son propre dernier dépôt** (`canDeleteVersion`). Le cabinet
  ne peut pas effacer une pièce déposée par le client — demande explicite de Sandrine,
  risque juridique autant que mauvaise manip — et aucune version antérieure n'est
  supprimable : l'historique complet est ce qu'elle a demandé à voir.
- 🔐 **Aucune analyse automatique n'atteint le client sans revue humaine.** Exigence
  écrite deux fois dans le cahier des charges du 20/08/2026
  (`context/Documents/20260820_CDC_EODA_Plateforme_v01_Interne.md` §5 et §7) : la
  consultante valide avant restitution. La barrière est
  `analysisVisibleTo(audience, …)` dans `lib/services/analysis-view-service.ts`,
  appliquée une seule fois dans `lib/actions/checklist.ts` — jamais dans un composant.
  `DocumentVersion.analysisReviewedAt` est le fait ; `setAnalysisReviewed` le pose et
  refuse un appelant client. Une mention de réserve à l'écran NE remplace PAS cette
  revue : EODA engage sa parole professionnelle sur ce qu'elle restitue, sur des
  documents qui seront présentés à la HAS.
  **Mode seul / accompagné — implémenté le 10/10/2026 (tranche N1)** (évolution de
  `context/09-vision-produit.md` §4.2, décisions Damon du 30/09 et du 08/10). Le mode est
  un FAIT de la mission, `Mission.supportMode` (`AUTONOMIE` | `ACCOMPAGNE`, migration
  `20261010120000_support_mode_client_acceptance`, défaut `ACCOMPAGNE` pour toutes les
  missions existantes). Posé à la signature par `convertDevisToClient` selon la formule
  (`defaultSupportModeForOffer`, `lib/services/support-mode-service.ts` : Excellence et
  bêta-test = accompagné, Essentiel / Performance = autonomie), modifiable ensuite par
  `CABINET_ADMIN` seul depuis l'onglet Mission (`lib/actions/mission-support-mode.ts`).
  **Jamais déduit de `commercialTier`.** Sans mission : règle stricte
  (`STRICT_SUPPORT_MODE`). `analysisVisibleTo(audience, version, mode)` prend le mode en
  paramètre **obligatoire** et reste appliqué une seule fois dans `lib/actions/checklist.ts` :
  accompagné = règle stricte ci-dessus, inchangée ; autonomie = la structure voit l'analyse
  non relue, **toujours** sous la réserve. Les mentions viennent d'**un seul** service,
  `lib/services/review-mention-service.ts` (`AUTONOMY_RESERVE` : « Non revérifié par un
  humain : peut comporter des erreurs. À relire absolument. » ; `describeReviewMention` :
  « Relu par EODA, le JJ/MM ») — à l'écran (`ChecklistItem.currentVersion.clientMention`),
  dans l'export Word du brouillon (`reviewMention` de `markdown-to-docx-service`) et dans
  tout futur e-mail qui annonce un document (`documentAnnouncementMention` ; aucun n'existe
  au 10/10). Jamais « Relu par Sandrine », jamais « validé » ni « conforme » côté client
  sans relecture.
- **La fin de mission ne supprime rien, et la clôture ne coupe rien.** Trois états
  d'accès dérivés de deux faits (`Mission.closedAt`, `Mission.clientAccessRevokedAt`)
  par `lib/services/mission-access-service.ts` : `ACTIVE` / `LIBRARY` (lecture seule)
  / `REVOKED`. L'application est dans `lib/auth/guards.ts` et dans les actions
  d'écriture — jamais seulement en masquant un bouton. Le cabinet garde l'accès dans
  tous les états (rétention). Ne jamais transformer la clôture en coupure d'accès :
  c'est la position finale du call du 16/08, après deux rétractations.
- **L'historique d'un prospect ne se réécrit pas.** `ProspectTimelineEntry` est
  append-only : commentaires ET changements d'étape sur la même frise, aucune action
  de modification ni de suppression, le changement de statut et sa trace dans une
  seule transaction (`lib/actions/prospect.ts`). Ne pas ajouter d'édition « pour
  corriger une faute » : un dossier réécrivable ne prouve rien le jour où il faut
  expliquer pourquoi une négociation a échoué.
- **Un choix « Autre » exige sa précision** — `otherPrecisionError` /
  `keepPrecisionOnlyForOther` (`lib/services/prospect-contact-service.ts`), une seule
  règle partagée par le canal d'acquisition et la fonction du contact. La précision
  est effacée si la valeur cesse d'être `AUTRE`. Même principe pour la civilité et la
  fonction : elles ne se recopient jamais dans `contactName`, un nom qui contient sa
  civilité ne se trie ni ne s'adresse.
- **Le devis part par un vrai e-mail, PDF joint** (depuis le 22/09/2026, commit
  `6ffeff6`, qui remplace la décision « `mailto:` seulement » du 26/08 après le retour
  « préparer l'e-mail n'envoie pas l'e-mail »). Le PDF est produit en naviguant vers
  `/imprimer/devis/[id]` — la même page que « Télécharger » — par Chromium headless
  (`devis-pdf-service.ts`), envoyé via Resend (`email-port.ts`), Sandrine en copie ; le
  corps du mail ne recopie pas les montants (le PDF fait foi) ; l'envoi passe le devis
  BROUILLON → ENVOYE et se journalise (`DEVIS_EMAIL_SENT`). Toujours **pas de jeton de
  partage public** : aucune route publique pour consulter un devis, aucune signature en
  ligne (la maquette en montrait une : écart assumé). **Devis par abonnement (maquette
  v2, 13/10/2026)** : engagement `Devis.commitmentMonths` (12, 24, 0 = sans engagement ;
  null = devis antérieur), prix mensuel de l'offre `CatalogueFormule.monthlyPriceEuros`
  (null = « à partir de xx € / mois », jamais un montant inventé) **snapshoté** sur le
  devis, note pour la structure `Devis.clientNote` (e-mail + PDF). Le récapitulatif range
  en « Par mois » / « Ponctuel » (`devis-recap-service.ts`) **sans toucher** aux totaux ni
  à l'acompte (`devis-calculation-service`), ni à la dégressivité. La **relance** d'un
  devis envoyé est un geste (`remindDevis`, `lib/actions/devis-email.ts`), journalisé
  `DEVIS_REMINDER_SENT`, sans pièce jointe ni montant ; `NOT_CONFIGURED` n'est jamais
  compté comme parti.
- **`StructureType` (statut juridique) et `EstablishmentType` (type SAD) sont deux axes
  indépendants**, portés par `Prospect` *et* `Establishment` pour le premier. Le support
  commercial les aligne sur une même ligne (« SAD Aide · SAD Mixtes · Associations loi
  1901 · CCAS/CIAS · Secteur privé ») : c'est une liste de segments de marché, pas un
  enum. Les fusionner rendrait « association qui est un SAD Mixte » inexprimable. Le
  statut juridique est saisi une seule fois, au stade prospect, et **recopié** sur la
  fiche à la signature — jamais redemandé, une seconde saisie du même fait finit par
  diverger.
- **Le contrat RÉCAPITULE le devis signé, il ne le remplace pas.** Le document
  contractuel du dépôt reste le devis (§7 ci-dessus). Le contrat d'accompagnement
  (`contract-service.ts`, `/imprimer/contrat/[id]`) ajoute ce qu'un devis ne dit
  pas — parties, objet, engagements réciproques — et n'écrit **aucune clause de
  droit nouvelle** : chaque engagement listé est la reprise d'une décision déjà
  écrite dans le dépôt. Ne pas y ajouter de CGV rédigées à la main : elles
  n'existent pas encore côté Sandrine, et le contrat y renvoie en annexe. Il refuse
  de se produire sans accord chiffré (`canIssueContract`), sauf bêta-test gratuit.
- **`priceIsFirm` et `avenantSignedOn` ne disent pas la même chose.** Le premier est
  la PROVENANCE (l'option vient d'un devis signé, le montant fait contrat), le second
  la RÉGULARISATION (l'avenant est revenu signé). Signer un avenant ne rend pas son
  montant ferme : l'avenant porte un « à partir de » recopié du catalogue. Les deux
  verrouillent en revanche le retrait de l'option depuis l'écran de mission — une
  seule fonction pour les deux (`isOptionContractuallyLocked`).
- **La dégressivité de l'abonnement portail vit dans l'outil**, pas au catalogue
  (`subscription-service.ts`) : -10 % Performance, -30 % Excellence, 0 en Essentiel,
  et le bêta-test suit Excellence. Elle dépend de l'OFFRE souscrite à côté, jamais de
  la ligne de catalogue. Appliquée une seule fois à la construction du devis, puis
  snapshotée : un montant remisé fait partie du document commercial. L'appariement se
  fait par CODE (`VEILLE_PORTAIL_EODA`), jamais par libellé.
- **Un livrable n'est pas un objet à créer, c'est un état dérivé** — la dernière
  version produite par le cabinet sur un document dont `validatedAt` est posé
  (`deliverables-service.ts`). Ne jamais ajouter de table « livrable » : elle se
  remplirait à la main, donc s'oublierait. Seule l'étape VALIDE ouvre la remise au
  client ; ce qui est en cours est compté, jamais listé (promettre à la place de
  Sandrine).
- **La grille de découverte est un CONTENU, pas un schéma** (`content/decouverte/`,
  réponses en `Prospect.discoveryAnswersJson` lues défensivement). Ajouter une
  question ne doit jamais demander une migration. Les questions sont la
  transposition de SA grille v03 (transmise le 01/09, provenance en tête de
  `grille.ts`), et non plus un gabarit d'attente. **L'ouverture de cette grille au
  client n'est pas tranchée** —
  `CABINET_ADMIN` uniquement jusqu'à décision explicite.
- **« Contenus à valider » se LIT depuis `content/`, il ne se recopie pas**
  (`/dashboard/cabinet/contenus`, décision de Damon du 14/10/2026 ; capacité
  `CONTENT_REVIEW` = `CABINET_ADMIN` + consultante). Quiz, questions sur les
  pratiques, questionnaires d'enquête, grille de découverte et points « à dire » de
  la feuille de réception, versionnés, chacun marqué « provisoire, à valider par
  Sandrine » ; export Word ou CSV (`/api/export/contenus?format=docx|csv`) pour
  l'annotation hors ligne. Un seul catalogue (`content-review-service.ts`, pur) sert
  l'écran et les deux exports. Lecture seule : une correction se fait dans
  `content/`, en augmentant la version.
- **La bibliothèque de modèles se range avec les mots de Sandrine, pas ceux du
  référentiel.** Le dossier est une ligne de `TemplateCategory` créée à la main,
  ordonnée à la main — jamais l'enum `DocumentCategory`, qui classe les pièces
  ATTENDUES d'une structure au regard de la loi 2002-2 et ne s'invente pas. Les
  deux axes ont failli être confondus : « Phase 0 — prise de contact » est une
  étape de son mode opératoire et n'existe dans aucun référentiel (call du
  03/09). Le tri est manuel parce que ses dossiers suivent le déroulé d'une
  mission — l'alphabet mettrait « Phase 10 » avant « Phase 2 ».
  Deux natures de fiches, et elles n'obéissent pas aux mêmes règles
  (`TemplateDocumentKind`) : un **GABARIT** a des stades et des numéros de
  version — **deux stades seulement**, `VIERGE` (le modèle) et `FINALE` (la version
  produite par EODA) ; la version « initiale » n'existe plus côté cabinet, c'est le
  document que le **client** dépose sur son portail (décision des 15 et 20/09) ; un
  **document de RÉFÉRENCE** — manuel HAS, texte réglementaire — n'en a aucun (« lui n'aura pas forcément plusieurs versions »). D'où
  `TemplateVersion.stage` et `versionLabel` nullables : l'obligation dépend du
  parent, la base ne sait pas l'exprimer, elle vit dans `resolveVersionIdentity`
  avec ses tests. Ne jamais convertir une fiche d'une nature à l'autre : les
  fichiers déjà déposés deviendraient inatteignables.
  **L'import de dossier PROPOSE, il ne range pas.** `planFolderImport` (pur,
  testé) lit une arborescence et remplit un tableau que Sandrine corrige avant
  que rien ne soit écrit — un rangement automatique silencieux se découvre trois
  semaines plus tard, quand la bibliothèque est déjà fausse. Un stade **deviné**
  et un stade **par défaut** sont distingués à l'écran (`stageDetected`) :
  sinon on relit les cinquante lignes ou aucune. L'envoi est **un appel par
  fichier**, séquentiel — une requête unique de cinquante fichiers ne passe
  aucune passerelle, et une coupure au trente-septième perdrait les trente-six
  premiers.

- **Une session d'évaluation clôturée est une PHOTO.** Elle ne se cote plus (refus
  côté serveur), et l'écran de chapitre ne crée plus de session en se chargeant : il
  le faisait, et rouvrir un chapitre après une clôture faisait disparaître toutes les
  cotations. L'ouverture est un geste explicite. C'est ce qui rend la seconde
  auto-évaluation comparable à la première (`evaluation-comparison-service.ts`, où un
  critère coté d'un seul côté est `INCOMPARABLE` et jamais un écart de ±4).
- **Les relances sont un geste, pas un automate — les alertes d'échéance, si.**
  (Distinction actée par Damon le 08/10/2026.) La **relance d'une pièce manquante** reste
  manuelle. L'**alerte d'échéance** d'un document récurrent (DIPC annuel, projet de
  service à 5 ans, retest de quiz à 6 mois — `03-documents-obligatoires.md`, périodicités)
  part **automatiquement** : ce n'est pas une relance, c'est un rappel de calendrier. Pour
  les relances : délais et cadence n'ont jamais été spécifiés (§12.7) : ne pas en inventer. Une pièce déjà justifiée par le client n'est
  jamais relancée, ni un document que le cabinet doit produire
  (`reminder-service.ts`). Les destinataires viennent du lien `EstablishmentUser`,
  jamais d'une adresse saisie.
- **Le fil d'échange est append-only et ne transporte rien.** Un fil par
  établissement, aucune pièce jointe (les documents ont leur propre dépôt), aucune
  modification ni suppression. L'e-mail de notification ne contient PAS le message :
  il peut évoquer des situations de personnes accompagnées, et le fil existe pour que
  les échanges restent dans la plateforme. Le client garde la parole en bibliothèque ;
  seul un accès révoqué ferme le fil.
- **Les documents finaux validés sont la base d'exemples de l'IA — jamais du code.**
  Les livrables validés de l'ASSAD BENOIT (et ensuite de chaque client) servent de
  référence à la mise en conformité pour **tous** les clients : c'est voulu, et c'est
  pour ça qu'ils obéissent à des règles plus dures qu'un dépôt ordinaire
  (`context/10-regles-mise-en-conformite.md` §9). Ils n'entrent **jamais** dans le dépôt
  de code (ni fixture, ni `content/`) — par la bibliothèque de modèles seulement, en
  stade `FINALE` ; ils sont **anonymisés avant dépôt** (`anonymizeText` ne masque
  qu'e-mails, téléphones et NIR : il ne suffit pas) ; aucune pièce nominative (DIPC
  signé, PAP) n'en fait partie (HDS) ; ils sont injectés dans le prompt comme **donnée**
  balisée, jamais comme instruction ; et on ne va jamais chercher d'exemple dans les
  `Document` d'un autre établissement. Chaque paire « original → version validée »
  rejoint le jeu d'évaluation rejoué à tout changement de prompt ou de modèle (09 §6.3).
- **Un devis peut n'avoir AUCUNE offre** (prestations à la carte seules — décision du
  01/09, livrée le 11/10/2026) : formule et snapshots du devis nullables, au moins une
  prestation exigée (`devisContentError`). La mission qui en naît a `formule = null` →
  palier `SANS_OFFRE` (`offer-scope-service`) : socle loi 2002-2 + impératifs, **mode
  accompagné**, **aucun droit de génération**. Ne jamais lui inventer une formule.
- **La matrice type de document → critère ne s'écrit que par l'écran**
  `/dashboard/cabinet/criteres` (CABINET_ADMIN, spec 04) — jamais par seed ni migration.
  La proposition du 08/10 y est embarquée et vérifiée contre sa source ; seuls les
  critères **proposés et présents en base** sont décidables (`planMatrixDecision`).
- **« Prouvé » est dérivé, jamais stocké, jamais « conforme »**
  (`criteria-proof-service`) : tous les documents attendus d'un critère relus par EODA
  (`validatedAt` postérieur à la version courante, structure accompagnée) ou acceptés
  par la structure (autonomie). Un SAD aide ne voit jamais un critère `SAD_MIXTE`
  (`criterion-applicability-service`, une seule règle pour l'auto-évaluation, la
  comparaison et critères & preuves).
- **Tâches = plan d'action : un seul modèle, `ActionItem`** (N5), quelle que soit la
  source (saisie, PAC, document, diagnostic…). « En retard » se DÉRIVE
  (`action-item-service`), jamais de colonne. Un client ne voit que les tâches confiées
  à la structure, n'agit que sur celles de la structure ou les siennes, ne confie
  jamais à EODA ; mission close = lecture seule ; accès révoqué = rien. Le journal porte
  la source et le côté, **jamais le titre**. Le PAC « Générer depuis l'auto-évaluation »
  **propose** (une action par critère coté sous 4, verbe + document, pilote = une
  fonction) et n'écrit que ce que le cabinet coche, recalculé côté serveur.
- **« Mon diagnostic » se DÉRIVE, ses deux gestes se stockent** (N6,
  `diagnostic-service`, `diagnostic-validation-service`). Prouvé / En partie / Sans
  preuve et les 3 actions prioritaires (impératifs sans preuve × documents attendus) se
  lisent des critères & preuves. `DiagnosticValidation` porte la PHOTO relue
  (`snapshotJson`) et deux faits jamais fusionnés : « relu par EODA » (cabinet,
  accompagné seulement) puis « accepté » (structure) ; en autonomie, la structure
  accepte seule sous la réserve. Une photo dont l'empreinte ne correspond plus au
  diagnostic courant n'est plus « à jour » — dérivé, aucune remise à zéro.
- **Les questions sur les pratiques sont un CONTENU** (`content/pratiques/`, N7), une
  par impératif, versionnées question par question ; **provisoires tant que Sandrine
  ne les a pas validées**. `PracticeAnswer` est append-only, la version relue côté
  serveur, le journal ne recopie jamais le texte libre.
- **Mettre en conformité = une PROPOSITION structurée, décidée ajout par ajout** (N8).
  Le modèle rend des segments ORIGINAL / AJOUT (`lib/llm/correction-proposal.ts`,
  validés par schéma ; code de critère inconnu et citation du manuel introuvable
  retirés). Le cahier de style est injecté depuis `content/regles-redaction/` — ne
  jamais le recopier dans un prompt. « Enregistrer la version N+1 » crée une NOUVELLE
  `DocumentVersion` liée par `regeneratedFromVersionId` (l'originale est conservée) et
  fige les décisions sur `CorrectionProposal` ; un ajout sans décision n'entre pas.
  Structure : écran ouvert en autonomie ET avec `correctionRight` seulement
  (`canUseComplianceWorkspace`, `correction-context.ts`) ; cabinet : toujours, la
  génération restant soumise au droit. `generateDocumentDraft` délègue à
  `generateCorrectionProposal` : une seule porte de génération.
- **Les exemples validés ne se mélangent jamais au référentiel** (N8, context/10 §9) :
  `KnowledgeChunk.nature` (`REFERENCE` / `EXEMPLE_VALIDE`), filtre de nature dans
  chaque lecture, exemples filtrés par tenant ET type de document dans la requête.
- **Le client est prévenu à la VALIDATION, jamais au dépôt** (27/09/2026). Un e-mail
  part vers chaque compte actif de l'établissement quand Sandrine valide un document
  (`setDocumentValidated` → `notifyDocumentAvailable`), ou quand EODA dépose une
  nouvelle version sur un document DÉJÀ validé (elle devient le livrable
  sur-le-champ). Un dépôt sur un document non validé ne prévient pas le CLIENT : c'est un
  travail en cours, l'annoncer serait promettre à la place de la consultante (le cabinet,
  lui, est prévenu de ce dépôt — règle suivante). Deux
  libellés : « nouveau livrable » si EODA a produit une version, « document validé »
  si seule la pièce du client a été jugée conforme. L'e-mail porte l'INTITULÉ du type,
  jamais le nom de fichier ni le contenu. Dans l'application, la pastille « Mes
  livrables » se DÉRIVE de `EstablishmentUser.deliverablesSeenAt` (seul fait stocké)
  par `countNewDeliverables` — pas de table de notifications.
- **Ce que la STRUCTURE fait, le cabinet l'apprend par e-mail** (16/10/2026, demande de
  Damon : les deux parties doivent voir ce qui se met à jour). Jusqu'ici le cabinet
  informait le client, jamais l'inverse. Trois gestes de la structure, et **trois
  seulement**, partent vers les comptes du cabinet qui SUIVENT la structure : un dépôt de
  pièce (`DEPOSIT`), une acceptation (`ACCEPTED`), et « je ne l'ai pas »
  (`DECLARED_MISSING` — ce n'est pas une absence, c'est une commande : le document est à
  produire, N3). Les autres réponses (« il arrive », « ne nous concerne pas ») ne
  demandent aucun travail au cabinet : une alerte qui part à chaque clic cesse d'être lue.
  Une seule fonction d'envoi, `notifyStructureActivity` (`lib/email/notifications.ts`),
  appelée par `acceptDocument`, par la branche CLIENT de `uploadDocument` et par la
  branche `DONT_HAVE` de `respondToMissingDocument` — **jamais** par un dépôt du cabinet,
  qui ne s'annonce pas à lui-même. Les destinataires viennent du périmètre en vigueur
  (`selectStructureRecipients`, `lib/services/cabinet-recipients-service.ts` :
  `resolveStructureScope` par rôle et par affectation, compte désactivé exclu, adresses
  dédupliquées), jamais d'une liste de rôles écrite pour l'occasion — **une commerciale ne
  reçoit rien**, elle ne voit pas les documents d'une structure. Le tenant est lu depuis
  l'ÉTABLISSEMENT, jamais reçu d'un appelant ; le message porte l'INTITULÉ du type et
  renvoie à la fiche, jamais à un fichier. L'envoi ne peut pas faire échouer le geste :
  l'acceptation est déjà enregistrée quand l'e-mail part. Vérifié par
  `cabinet-recipients-service.test.ts`, `templates.test.ts`, `document.test.ts`,
  `client-document-acceptance.test.ts`.
- **Ce qu'un écran annonce d'un envoi est ce qui est réellement parti.** Le décompte des
  envois groupés passe par `countDeliveries`, jamais par les promesses simplement tenues :
  un envoi `NOT_CONFIGURED` (adaptateur console, sans `RESEND_API_KEY`) n'est **pas** un
  destinataire prévenu. `notifyDocumentAvailable` comptait les promesses tenues et faisait
  dire « Client prévenu par e-mail (2 personnes) » à l'écran de validation pour un message
  jamais parti (corrigé le 16/10/2026, révélé par le premier test propre de
  `lib/email/notifications.ts` — le module n'en avait aucun). Un module d'envoi sans
  test n'est pas « couvert par les tests d'action » : ces derniers doublent le module,
  donc ils ne voient rien de ce qu'il fait pour de vrai.
- Ne pas faire passer un devis à `SIGNE` par `changeDevisStatus` : la signature est la seule
  transition qui produit des effets hors du module commercial (fiche établissement, mission,
  périmètre ouvert au client) et passe par `convertDevisToClient` (`lib/actions/conversion.ts`),
  en une transaction. `EstablishmentType` (SAD_AIDE / SAD_MIXTE) y est **demandé**, jamais
  déduit de `ProspectType` (ASSOCIATION / PRIVE / PUBLIC) : ce sont deux dimensions distinctes.