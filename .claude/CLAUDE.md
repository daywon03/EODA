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
| Pas d'opération asynchrone non attendue | `no-floating-promises`, `no-misused-promises`, `await-thenable` en **error** | `apps/web/.eslintrc.json` (type-aware, `parserOptions.project`) |
| Pas d'échappatoire au typage | `no-explicit-any` en **error** | idem |
| Pas de journalisation sauvage | `no-console` en **error** (`error`/`warn` autorisés) | idem |
| `process.env` lu à un seul endroit | `no-restricted-syntax` en **error** | idem — seule exception : `lib/config/env.ts` |
| Contrat de types respecté | `tsc --noEmit` sur **les deux** packages | `pnpm typecheck` (`pnpm -r --if-present`) |
| Couverture minimale | seuils qui **font échouer** la commande | `apps/web/vitest.config.mts` — 80 % lignes/fonctions/instructions, 75 % branches |
| Aucun secret commité | `gitleaks` en pre-commit **et** en CI (historique complet) | `.githooks/pre-commit` + `.github/workflows/ci.yml` |
| Hooks installés par le dépôt | `git config core.hooksPath .githooks` posé par le `postinstall` | `package.json` |
| Manifeste de migrations à jour | test qui compare `EXPECTED_MIGRATIONS` au dossier `prisma/migrations` | `apps/web/src/lib/db/migration-manifest.test.ts` |
| Configuration de production complète | contrôle au démarrage qui **sort en code 1** | `apps/web/src/instrumentation.ts` + `lib/config/production-profile.ts` |
| Migrations appliquées au déploiement | `migrate deploy` dans `build.command` | `prisma.compute.ts` |
| Dépendances vulnérables | `pnpm audit --audit-level high` **sans `\|\| true`** | CI |
| CI qui dit la vérité | aucun `continue-on-error`, aucun masquage d'échec | CI |

**Dette acceptée, avec justification écrite** : `xlsx` (GHSA-4r6h-8v6p-xvw6,
GHSA-5pgg-2g8v-p4x9) n'a pas de version corrigée publiée sur npm. Utilisé uniquement par
`packages/database/prisma/seed-has-referential.ts`, un script de seed exécuté à la main sur
les grilles Synaé locales de Sandrine — jamais dans le chemin d'exécution de l'application,
jamais sur un fichier provenant d'un tiers. Exception déclarée explicitement dans
`pnpm.auditConfig.ignoreGhsas`, pas en abaissant le seuil global d'audit.

## 1. Contexte métier (à connaître avant tout)

**Qui :** Sandrine Regina, fondatrice d'EODA Conseil (auto-entreprise), consultante qualité
ESSMS, formée à la méthodologie HAS (Cabinet Amplea, organisme accrédité COFRAC). ~20 ans
d'expérience qualité international (Orange Business), ITIL, Power BI. **Damon BA**
(l'utilisateur de Claude Code sur ce projet) est le programmeur, concepteur des outils
internes et externes d'EODA — cf. `context/06-mode-operatoire-eoda.md` §Gouvernance.

**Quoi :** EODA accompagne les **SAD** (Services Autonomie à Domicile — un type d'ESSMS)
dans leur préparation à l'**évaluation qualité HAS** (Haute Autorité de Santé), obligatoire
pour tous les ESSMS, sur un cycle de 15 ans (3 évaluations).

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

## 3. Documents de référence (lire dans cet ordre)

| Ordre | Fichier | Contenu |
|---|---|---|
| 1 | `context/01-glossaire-essms.md` | Tous les sigles et termes métier (ESSMS, SAD, DIPC, CVS, EI/EIG, PLAC, CREX...) |
| 2 | `context/02-referentiel-has.md` | Système HAS : 157 critères, 16-18 impératifs, cotation 1-4/★/NC/RI, chapitres Synaé |
| 3 | `context/03-documents-obligatoires.md` | La checklist documentaire loi 2002-2 + HAS, catégorisée — **input direct du module 1** |
| 4 | `context/04-charte-eoda.md` | Identité visuelle (couleurs, typo, logo, conventions de nommage fichiers) |
| 5 | `context/05-prototype-existant.md` | Ce qui existe déjà (HTML statique auto-éval) et pourquoi on le réécrit proprement |
| 6 | `context/06-mode-operatoire-eoda.md` | Mode opératoire humain : contrôle croisé documentaire (matrice, champs critiques, détection d'écarts) + déroulé complet de la mission ASSAD BENOIT (8 phases, gouvernance, vigilances juridiques) — process métier, complémentaire aux fichiers ci-dessus qui documentent les règles produit |
| 7 | `context/07-outil-pilotage-missions.md` | Pipeline commercial (prospects, devis, catalogue, KPI — `/dashboard/cabinet/commercial`, CABINET_ADMIN uniquement) et suivi de mission (checklist diagnostic 12 items + 4 phases — `/dashboard/cabinet/etablissements/[id]/mission`, CABINET_ADMIN + CABINET_EVALUATOR) sont tous deux implémentés dans la plateforme. **§12 = refonte des offres décidée au call du 16/08/2026 (prix, périmètres, portails), pas encore implémentée — elle remplace le §4 : lire §12 avant de toucher au catalogue, aux offres ou aux portails.** |
| 8 | `specs/01-mvp-v1.md` | Spécification fonctionnelle détaillée des 3 modules V1 |
| 9 | `specs/02-architecture-technique.md` | Stack, schéma BDD, architecture, ADRs |
| 10 | `specs/03-roadmap-developpement.md` | Ordre de build, jalons, definition of done |

**Règle :** avant de générer du code touchant au métier HAS (cotation, critères, documents
obligatoires), Claude Code doit relire `context/02-referentiel-has.md` et
`context/03-documents-obligatoires.md` — c'est la source de vérité, pas la mémoire du modèle.
Le référentiel HAS a des règles précises (NC interdit sur impératifs, RI uniquement chapitre 1,
★ = 4/4) qui sont des pièges fréquents si reconstitués de mémoire.

## 4. Stack technique (résumé — détail dans `specs/02-architecture-technique.md`)

- **Frontend :** Next.js 14+ (App Router), TypeScript strict, Tailwind CSS, shadcn/ui
- **Backend :** API Routes Next.js (puis extraction possible en service séparé si besoin),
  Node.js 20+
- **Base de données :** PostgreSQL (hébergement Europe — voir contrainte RGPD), Prisma ORM
- **Stockage fichiers :** S3-compatible **hébergé en Europe** (Scaleway Object Storage ou
  OVHcloud Object Storage) — jamais AWS us-east par défaut
- **Auth :** Auth.js (NextAuth) — comptes Cabinet (Sandrine + futurs collaborateurs) et
  comptes Client (un par établissement)
- **Analyse documentaire :** extraction texte (pdf-parse / mammoth pour docx) +
  appel LLM (Anthropic Claude API) avec prompt structuré contre le référentiel HAS
- **Hébergement :** Scaleway ou OVHcloud (France) — contrainte non-négociable, données
  sensibles (santé/social, mineurs d'âge possibles dans le public accompagné)
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

## 7. Ce que Claude Code ne doit PAS faire

- Ne pas réinventer le système de cotation Qualiscope (A/B/C/D) — **interdit**, c'est un
  référentiel différent. Le seul système valide est **1/2/3/4/★/NC/RI** (voir glossaire).
- Ne pas confondre les 137 critères des grilles Synaé (ce qui est évalué en pratique sur le
  terrain) avec les 157 critères du manuel HAS complet (qui inclut des critères non
  applicables à tous les types d'ESSMS) — toujours préciser le périmètre.
- Ne pas présenter la plateforme comme un outil d'évaluation HAS officiel — c'est un outil
  de préparation/conseil.
- **Ne jamais passer `DATABASE_URL` (ni `DIRECT_URL`) comme `--shadow-database-url`.** Prisma
  *détruit et rejoue* la base désignée comme shadow database. `prisma migrate diff
  --shadow-database-url "$DATABASE_URL"` a effacé la base de développement partagée le
  19/08/2026 (tenant, comptes, catalogue, tout). Utiliser `SHADOW_DATABASE_URL`, qui doit
  pointer une base jetable — cf. `.env.example`. Pour vérifier une migration sans base
  jetable : `prisma validate` + relecture du SQL, jamais `migrate diff` sur la vraie base.
- Ne pas committer de vraies données clients (ASSAD BENOIT) dans des fixtures de test — créer
  des fixtures anonymisées génériques.
- Le pipeline commercial (prospects/devis/catalogue/KPI, décrit dans
  `context/07-outil-pilotage-missions.md`) est intégré à la plateforme depuis le module
  `/dashboard/cabinet/commercial`, réservé au rôle `CABINET_ADMIN` uniquement (jamais
  `CABINET_EVALUATOR` ni `CLIENT_USER`). Ces données restent malgré tout strictement internes :
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
- Le suivi de mission (checklist diagnostic 12 items + 4 phases d'accompagnement, §7 du même
  fichier) est également intégré, sous `/dashboard/cabinet/etablissements/[id]/mission` —
  accessible à `CABINET_ADMIN` **et** `CABINET_EVALUATOR` (contrairement au pipeline commercial
  ci-dessus) car c'est du suivi opérationnel d'accompagnement, pas de la donnée financière. La
  formule contractuelle qui gouverne le périmètre d'une mission (§7.3 — verrouillage
  Consolidation/Préparation finale hors Excellence ou bêta-test gratuit) vit sur `Mission.formule`,
  pas sur `Establishment.commercialTier` (resté hardcodé `BETA`, affichage/historique
  uniquement) — ne jamais dupliquer cette décision sur les deux modèles.