# EODA Conseil — Plateforme SaaS HAS/ESSMS

Outil de **préparation** à l'évaluation qualité HAS des ESSMS (SAD). Ce n'est pas un outil
d'évaluation HAS officiel — cf. `.claude/CLAUDE.md` §1.

Documentation projet : `.claude/CLAUDE.md` (règles), `.claude/context/` (métier),
`.claude/specs/` (spécifications, architecture, roadmap).

## Prérequis

- Node.js ≥ 20, pnpm ≥ 10
- Une base PostgreSQL (Prisma Postgres, région Europe)

## Démarrage local

```bash
pnpm install                    # installe + pose les hooks git + génère le client Prisma
cp .env.example .env            # puis renseigner DATABASE_URL, DIRECT_URL, AUTH_SECRET
pnpm db:migrate:deploy          # applique les migrations
pnpm db:seed                    # jeu de données de démonstration anonymisé
pnpm dev
```

En développement, trois services ont un repli local **volontaire** : le stockage fichiers
écrit sur disque (`apps/web/.local-storage`), l'analyse documentaire utilise un adaptateur
stub, l'envoi d'email est journalisé. Ces replis sont **refusés en production** (voir
ci-dessous).

## Contrôles de qualité

```bash
pnpm typecheck   # tsc --noEmit sur les deux packages
pnpm lint        # eslint --max-warnings 0
pnpm test        # vitest + seuils de couverture qui font échouer la commande
pnpm build       # next build
```

## Configuration

Toute variable d'environnement est déclarée **simultanément** dans `.env.example` et dans
`apps/web/src/lib/config/env.ts` — seul endroit du code autorisé à lire `process.env` (règle
mécaniquement tenue par ESLint).

### Profil de production

Au démarrage (`apps/web/src/instrumentation.ts`), une instance en `NODE_ENV=production`
vérifie **une fois** que la configuration est complète, et **sort en code 1** si elle ne l'est
pas. Objectif : un déploiement mal configuré échoue au démarrage, il ne sert pas des pages
qui exploseront au premier dépôt de document, devant le client.

Requis en production, sans quoi l'instance refuse de démarrer :

| Variable(s) | Pourquoi |
|---|---|
| `DATABASE_URL`, `DIRECT_URL` | Socle, requis dans tous les environnements |
| `AUTH_SECRET` (≥ 32 caractères) | Signature/chiffrement du cookie de session |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Le repli disque local ne survit pas à un redéploiement |
| `ANTHROPIC_API_KEY` | Sans elle, l'analyse documentaire est un stub qui n'analyse rien |
| `NEXTAUTH_URL` (https://…) | Auth.js construit ses URLs de callback derrière le reverse proxy |

Avertissement non bloquant : `RESEND_API_KEY` / `RESEND_FROM_EMAIL` absents ⇒ les emails sont
journalisés au lieu d'être envoyés.

## Déploiement en production (Prisma Compute)

Le déploiement est **manuel** : `prisma app deploy`, piloté par `prisma.compute.ts`.

Les migrations sont désormais appliquées par le déploiement lui-même : `prisma.compute.ts`
définit `build.command`, qui enchaîne `prisma generate`, `prisma migrate deploy`, puis
`next build`. C'est le seul point d'accroche que le contrat de configuration du SDK expose
(`ComputeAppConfig` n'a ni hook `prebuild` ni hook `release`), et il s'exécute avec les
variables d'environnement de la branche déployée. Un déploiement dont la migration échoue
échoue au build, avant qu'aucun trafic ne soit routé.

⚠️ La détection automatique de schéma du SDK ne trouve **pas** notre schéma : elle descend
depuis `root` (`apps/web`) alors que le schéma vit dans `packages/database/`. Sans le
`build.command` ci-dessus, aucune migration n'est appliquée au déploiement.

### Checklist de mise en production

1. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — tout doit être vert localement.
2. Vérifier que les variables du **profil de production** ci-dessus sont posées sur la branche
   Prisma Compute cible (secrets côté plateforme, jamais dans `prisma.compute.ts`, qui est
   versionné).
3. Relire le SQL de toute migration ajoutée depuis le dernier déploiement
   (`packages/database/prisma/migrations/`) et vérifier qu'elle figure dans
   `packages/database/src/migrations.ts` (le test `migration-manifest.test.ts` le vérifie).
4. `prisma app deploy` — la migration est appliquée pendant le build.
5. Lire les journaux de démarrage. Trois messages possibles :
   - `[EODA] CONFIGURATION DE PRODUCTION INCOMPLÈTE` ⇒ l'instance est sortie en code 1,
     corriger la variable et redéployer ;
   - `[EODA] SCHÉMA DE BASE DE DONNÉES DÉSYNCHRONISÉ` ⇒ la base n'est pas au niveau du code,
     appliquer les migrations (étape 6) avant d'ouvrir l'accès ;
   - aucun des deux ⇒ configuration et schéma cohérents.
6. Séquence **manuelle** de migration, si le `build.command` devait être retiré ou si la base
   doit être remise à niveau hors déploiement :
   ```bash
   pnpm --filter @eoda/database generate
   DATABASE_URL="<url pooler>" DIRECT_URL="<url directe>" pnpm db:migrate:deploy
   DATABASE_URL="<url pooler>" DIRECT_URL="<url directe>" \
     pnpm --filter @eoda/database exec prisma migrate status   # doit dire « up to date »
   ```

### ⛔ Commandes interdites sur ce dépôt

`prisma migrate dev`, `prisma migrate reset`, `prisma migrate diff`, et toute commande portant
`--shadow-database-url` pointant une base réelle. Prisma **détruit et rejoue** la base désignée
comme shadow database : la base de développement partagée a été effacée ainsi le 19/08/2026.
Seules `prisma validate`, `prisma migrate status` et `prisma migrate deploy` sont autorisées.
Les migrations sont écrites **à la main** dans `packages/database/prisma/migrations/`.

## Déploiement sur Vercel

`vercel.json` à la racine porte la configuration. Deux réglages à faire une fois dans le
projet Vercel :

1. **Root Directory** : laisser la racine du dépôt (pas `apps/web`) — la commande de build
   est un enchaînement pnpm workspace qui a besoin de `packages/database`.
2. **Variables d'environnement** (Production *et* Preview) : `DATABASE_URL`, `DIRECT_URL`,
   `AUTH_SECRET`, `NEXTAUTH_URL`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`,
   `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `ANTHROPIC_API_KEY`. Les deux variables
   Resend sont facultatives (avertissement, pas blocage).

### Ordre de la commande de build, et pourquoi

```
pnpm db:generate && pnpm verify:prod-config && pnpm db:migrate:deploy && pnpm --filter @eoda/web build
```

- `verify:prod-config` **avant** la migration : inutile de migrer une base pour un
  déploiement qui n'aboutira pas. Une variable manquante fait échouer le build, donc
  aucune URL n'est publiée — c'est le seul moment où l'on peut encore refuser.
- `migrate deploy` **jamais** `migrate dev` ni `migrate diff` (cf. `CLAUDE.md` §7).
- Une migration en échec fait échouer le build, avant qu'aucun trafic ne soit routé.

### Région

`regions: ["cdg1"]` (Paris). Les fonctions s'exécutent en France, la base Prisma Postgres
est en `eu-west-3`, et le bucket S3 doit être européen. **À vérifier avant d'y mettre de
vraies données** : Vercel reste une société américaine, et l'hébergement des données de
santé/social est une contrainte non négociable du projet (`CLAUDE.md` §6, qui nomme
Scaleway ou OVHcloud). Le choix de Vercel est une décision produit, pas une conformité
acquise.

### Ce qui change par rapport à un serveur long

- **Le refus au démarrage n'existe pas en *serverless*.** Une fonction éphémère n'a pas de
  démarrage à refuser : `process.exit(1)` y tuerait l'invocation en cours et se rejouerait
  à chaque requête. Sur Vercel, `runStartupChecks()` lève au lieu de sortir, et c'est
  `verify:prod-config` au build qui empêche réellement le déploiement incomplet.
- **La limitation de débit sur la connexion devient poreuse.** L'adaptateur est en mémoire
  du processus (`lib/security/in-memory-rate-limiter.ts`) : chaque instance a son propre
  compteur, et un démarrage à froid le remet à zéro. Le quota effectif contre la force
  brute est donc multiplié par le nombre d'instances. **À remplacer par un compteur
  partagé (table Postgres ou Redis) avant d'ouvrir la plateforme à de vrais comptes.**

## Comptes et mots de passe

Un compte client est créé par `inviteClientUser` avec un mot de passe temporaire affiché une
seule fois. Ce mot de passe **ne vaut que pour la première connexion** : le compte porte
`mustChangePassword`, et la couche d'autorisation (`apps/web/src/lib/auth/guards.ts`) ne sert
aucune autre route authentifiée tant que la rotation n'a pas eu lieu
(`/changer-mot-de-passe`).

Changer son mot de passe invalide **toutes** les sessions ouvertes avant le changement, y
compris sur un autre appareil : `User.passwordChangedAt` fait office d'horodatage de
révocation, comparé à l'heure de connexion portée par le jeton.
