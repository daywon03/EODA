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
| Aucun dialogue natif du navigateur | `no-restricted-syntax` sur `confirm`/`alert`/`prompt` en **error** | idem — remplacés par `<ConfirmActionButton>` |
| `process.env` lu à un seul endroit | `no-restricted-syntax` en **error** | idem — seule exception : `lib/config/env.ts` |
| Contrat de types respecté | `tsc --noEmit` sur **les deux** packages | `pnpm typecheck` (`pnpm -r --if-present`) |
| Couverture minimale | seuils qui **font échouer** la commande | `apps/web/vitest.config.mts` — 80 % lignes/fonctions/instructions, 75 % branches |
| Aucun secret commité | `gitleaks` en pre-commit **et** en CI (historique complet) | `.githooks/pre-commit` + `.github/workflows/ci.yml` |
| Hooks installés par le dépôt | `git config core.hooksPath .githooks` posé par le `postinstall` | `package.json` |
| Manifeste de migrations à jour | test qui compare `EXPECTED_MIGRATIONS` au dossier `prisma/migrations` | `apps/web/src/lib/db/migration-manifest.test.ts` |
| Clés étrangères indexées (convention `P6`) | test qui lit le schéma et **échoue** sur toute relation sans index, liste d'exceptions figée | `apps/web/src/lib/db/foreign-key-indexes.test.ts` |
| CSP à nonce réellement applicable (aucune page pré-rendue) | `pnpm check:csp` après le build, **sort en code 1** si un `<script>` est écrit sans nonce | `apps/web/scripts/check-csp-nonce.mjs` + CI ; le réglage est `export const dynamic = "force-dynamic"` dans `apps/web/src/app/layout.tsx` |
| Budget de JavaScript par route | `pnpm check:bundle` après le build, **sort en code 1** au-delà du budget | `apps/web/scripts/check-bundle-budget.mjs` + CI |
| Configuration de production complète | contrôle au démarrage qui **sort en code 1** | `apps/web/src/instrumentation.ts` + `lib/config/production-profile.ts` |
| Migrations appliquées au déploiement | `migrate deploy` dans `buildCommand` | `vercel.json` |
| Dépendances vulnérables | `pnpm audit --audit-level high` **sans `\|\| true`** | CI |
| CI qui dit la vérité | aucun `continue-on-error`, aucun masquage d'échec | CI |

**Dette acceptée, à réexaminer après le 22/09/2026** : `.npmrc` porte `node-linker=hoisted`,
qui désactive l'arborescence isolée de pnpm et rend possibles les dépendances fantômes
(convention `D9`). Le réglage avait été posé pour Prisma Compute, retiré du dépôt le
22/08/2026 — sa cause n'existe donc plus. Il ne se retire pas à l'aveugle : la
vérification est un déploiement de **prévisualisation Vercel** sans cette ligne, pas une
construction locale.

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
  appel LLM (Anthropic Claude API) avec prompt structuré contre le référentiel HAS
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
  uniquement) — ne jamais dupliquer cette décision sur les deux modèles. **Corollaire depuis le
  20/08/2026** : les options souscrites vivent elles aussi sur la mission (`MissionOption`,
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
  devis, jamais par une seconde porte.
- **L'état d'une fiche est DÉRIVÉ, jamais stocké** — `lib/services/lifecycle-service.ts`
  (pur, testé). `SIGNE` / `EN_COURS` se calculent à partir des faits (items de
  diagnostic cochés, dates de phases posées) ; `TERMINE` vient de `Mission.closedAt`,
  seul fait non dérivable parce que la clôture est une décision, pas un calcul. Ne
  **jamais** ajouter `Establishment.status` : le dépôt porte déjà quatre sources d'état
  et `commercialTier` a démontré ce qui arrive à la cinquième — ajoutée, puis plus
  jamais mise à jour, elle annonçait « Bêta-test gratuit » à des clients payants.
  Le bêta-test (`Mission.gratuit`) est un **attribut orthogonal**, pas une étape : une
  mission gratuite peut être signée, en cours ou terminée.
- **Les KPI de portefeuille se dérivent des mêmes faits que les badges d'étape** —
  `lib/services/portfolio-kpi-service.ts` (pur, testé), conversion dans
  `lib/db/to-portfolio-row.ts`. Un compteur qui recalculerait l'état à sa façon
  finirait par contredire la fiche qu'il compte. Ne jamais compter une formule
  depuis `Establishment.commercialTier` : c'est `Mission.formule`. Corollaire :
  `getProspectKpiCounts` ne compte dans `byStatus` que les prospects **non
  convertis** (`establishmentId: null`) — un prospect converti garde `SIGNE` à vie
  et serait sinon compté deux fois dans l'entonnoir unifié, une fois en « Signé »
  et une fois à l'étape réelle de sa mission. `byStructureType` reste sur tous les
  prospects : c'est une lecture de marché, pas une photo du pipeline.
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
  `DocumentType.requestedFromClient` sépare les deux (cinq documents réclamés avant
  la visite, ~24 produits par EODA). Le portail client n'affiche que les types
  réclamés **plus** ceux dont un document existe déjà. Ne jamais « rétablir » la
  liste complète côté client : demander les 29 à une structure qui fait appel à EODA
  parce qu'elle ne les a pas, c'est lui remettre le travail qu'elle a acheté. La
  liste exacte est modifiable par `CABINET_ADMIN` depuis la fiche client (elle
  attend confirmation des experts de Sandrine).
- **Le parcours d'un document se dérive, sauf sa validation.** Déposé → analysé → mis
  en conformité → restitué → validé (`lib/services/document-workflow-service.ts`).
  Seul `Document.validatedAt` est stocké : valider engage la parole de l'évaluatrice.
  Le portail CLIENT garde les statuts simples (manquant / déposé / conforme) — « les
  deux portails ne regardent pas la même chose » (call du 26/08).
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
- **Le partage d'un devis ne passe par aucun envoi serveur** (décision Damon,
  26/08/2026) : `mailto:` pré-rempli + téléchargement via la vue imprimable, nommé
  selon la convention EODA (`devis-sharing-service.ts`). Ne pas « améliorer » en
  ajoutant un jeton de partage public ou un moteur PDF sans que ce soit redemandé —
  c'est une route publique et une dépendance lourde, pour un service déjà rendu.
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
  question ne doit jamais demander une migration. Le gabarit officiel de Sandrine
  n'est pas dans le dépôt : les questions livrées sont provisoires et annoncées comme
  telles à l'écran. **L'ouverture de cette grille au client n'est pas tranchée** —
  `CABINET_ADMIN` uniquement jusqu'à décision explicite.
- **La bibliothèque de modèles se range avec les mots de Sandrine, pas ceux du
  référentiel.** Le dossier est une ligne de `TemplateCategory` créée à la main,
  ordonnée à la main — jamais l'enum `DocumentCategory`, qui classe les pièces
  ATTENDUES d'une structure au regard de la loi 2002-2 et ne s'invente pas. Les
  deux axes ont failli être confondus : « Phase 0 — prise de contact » est une
  étape de son mode opératoire et n'existe dans aucun référentiel (call du
  03/09). Le tri est manuel parce que ses dossiers suivent le déroulé d'une
  mission — l'alphabet mettrait « Phase 10 » avant « Phase 2 ».
  Deux natures de fiches, et elles n'obéissent pas aux mêmes règles
  (`TemplateDocumentKind`) : un **GABARIT** a les trois stades et des numéros de
  version ; un **document de RÉFÉRENCE** — manuel HAS, texte réglementaire — n'en
  a aucun (« lui n'aura pas forcément plusieurs versions »). D'où
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
- **Les relances sont un geste, pas un automate.** Délais et cadence n'ont jamais été
  spécifiés (§12.7) : ne pas en inventer. Une pièce déjà justifiée par le client n'est
  jamais relancée, ni un document que le cabinet doit produire
  (`reminder-service.ts`). Les destinataires viennent du lien `EstablishmentUser`,
  jamais d'une adresse saisie.
- **Le fil d'échange est append-only et ne transporte rien.** Un fil par
  établissement, aucune pièce jointe (les documents ont leur propre dépôt), aucune
  modification ni suppression. L'e-mail de notification ne contient PAS le message :
  il peut évoquer des situations de personnes accompagnées, et le fil existe pour que
  les échanges restent dans la plateforme. Le client garde la parole en bibliothèque ;
  seul un accès révoqué ferme le fil.
- Ne pas faire passer un devis à `SIGNE` par `changeDevisStatus` : la signature est la seule
  transition qui produit des effets hors du module commercial (fiche établissement, mission,
  périmètre ouvert au client) et passe par `convertDevisToClient` (`lib/actions/conversion.ts`),
  en une transaction. `EstablishmentType` (SAD_AIDE / SAD_MIXTE) y est **demandé**, jamais
  déduit de `ProspectType` (ASSOCIATION / PRIVE / PUBLIC) : ce sont deux dimensions distinctes.