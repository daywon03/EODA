# EODA Conseil — Plateforme SaaS HAS/ESSMS

> Fichier lu automatiquement par Claude Code au démarrage de chaque session.
> Source de vérité unique sur le projet, la stack et les règles de développement.

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
| 7 | `context/07-outil-pilotage-missions.md` | Pipeline commercial (prospects, devis, catalogue, KPI — `/dashboard/cabinet/commercial`, CABINET_ADMIN uniquement) et suivi de mission (checklist diagnostic 12 items + 4 phases — `/dashboard/cabinet/etablissements/[id]/mission`, CABINET_ADMIN + CABINET_EVALUATOR) sont tous deux implémentés dans la plateforme |
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
- Ne pas committer de vraies données clients (ASSAD BENOIT) dans des fixtures de test — créer
  des fixtures anonymisées génériques.
- Le pipeline commercial (prospects/devis/catalogue/KPI, décrit dans
  `context/07-outil-pilotage-missions.md`) est intégré à la plateforme depuis le module
  `/dashboard/cabinet/commercial`, réservé au rôle `CABINET_ADMIN` uniquement (jamais
  `CABINET_EVALUATOR` ni `CLIENT_USER`). Ces données restent malgré tout strictement internes :
  ne jamais les exposer sur une route accessible à un `CLIENT_USER`, ni les inclure dans un
  livrable/export destiné à un client.
- Le suivi de mission (checklist diagnostic 12 items + 4 phases d'accompagnement, §7 du même
  fichier) est également intégré, sous `/dashboard/cabinet/etablissements/[id]/mission` —
  accessible à `CABINET_ADMIN` **et** `CABINET_EVALUATOR` (contrairement au pipeline commercial
  ci-dessus) car c'est du suivi opérationnel d'accompagnement, pas de la donnée financière. La
  formule contractuelle qui gouverne le périmètre d'une mission (§7.3 — verrouillage
  Consolidation/Préparation finale hors Excellence ou bêta-test gratuit) vit sur `Mission.formule`,
  pas sur `Establishment.commercialTier` (resté hardcodé `BETA`, affichage/historique
  uniquement) — ne jamais dupliquer cette décision sur les deux modèles.