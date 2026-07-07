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

## Jalon 3 — Analyse documentaire automatisée (Module 1 — la priorité business)

- [ ] Pipeline d'extraction de texte (pdf-parse, mammoth)
- [ ] `LLMAnalysisPort` + `AnthropicLLMAdapter`
- [ ] `DocumentAnalysisService` : prompt structuré référentiel HAS + contenu document →
  résultat JSON (manques, suggestions)
- [ ] Étape d'anonymisation/avertissement avant envoi au LLM (cf. contrainte RGPD)
- [ ] `DocumentStatusService` : calcul automatique du statut (`INCOMPLETE` / `COMPLIANT` /
  `EXPIRED`)
- [ ] Affichage des manques + suggestions dans l'UI, en langage clair
- [ ] Job asynchrone (BullMQ/Redis ou équivalent) pour ne pas bloquer l'upload pendant
  l'analyse — statut `ANALYZING` visible pendant le traitement
- [ ] Bouton "Régénérer une version corrigée" → nouvelle `DocumentVersion`

**Definition of done :** sur un vrai document ASSAD BENOIT (ex : `Critère_3_12_1.docx` ou
le `DIPEC_ASSAD_BENOIT_2025.docx`), le système détecte au moins un manque réel et propose
une suggestion de correction cohérente avec les attendus HAS du critère rattaché.

> ⚠️ C'est le jalon le plus risqué techniquement (qualité de l'analyse LLM, fiabilité des
> suggestions). Prévoir une phase de calibration du prompt avec Sandrine sur 5 à 10
> documents réels d'ASSAD BENOIT avant de considérer ce jalon "fini" — la qualité perçue
> de ce module conditionne l'adoption de toute la plateforme.

## Jalon 4 — Auto-évaluation HAS (Module 3)

- [ ] Seed du référentiel complet (`Chapter`, `Theme`, `Objective`, `Criterion`,
  `EvaluationElement`) depuis les grilles Synaé déjà extraites (137 critères / 295 E.E.,
  cf. `context/05-prototype-existant.md`)
- [ ] `ScoringService` (calcul de moyenne avec exclusion NC/RI, ★=4)
- [ ] UI de cotation par chapitre, avec garde-fous (RI Chapitre 1 uniquement, avertissement
  NC sur impératif)
- [ ] Minuteur de session
- [ ] Tableau de résultats par chapitre + global
- [ ] `PreRatingSuggestionService` — pont avec les statuts documents du Module 1
- [ ] Export structuré (CSV/Excel) des cotations — format à valider avec Sandrine

**Definition of done :** Sandrine cote le Chapitre 3 complet pour ASSAD BENOIT, voit les
critères impératifs à risque mis en évidence, et exporte un fichier exploitable.

## Jalon 5 — Durcissement avant mise en usage réel

- [ ] Revue sécurité (cloisonnement établissement testé avec 2 comptes différents)
- [ ] Logs d'audit minimaux sur accès documents
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
