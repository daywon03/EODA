---
name: engineering-conventions
description: "Conventions d'ingénierie universelles, indépendantes de la stack : sécurité non négociable (authentification, autorisation, secrets, configuration, webhooks, journalisation), anti-duplication, typage strict, nommage, tests, et application mécanique des règles par lint et CI. Applique-le au démarrage d'un nouveau projet, avant d'écrire du code d'authentification ou d'autorisation, lors d'une revue de code, d'un audit de dépôt, de la mise en place du lint ou de la CI, de l'écriture d'un fichier de règles (.cursor/rules, CLAUDE.md, AGENTS.md), ou dès qu'une question porte sur les conventions, les bonnes pratiques, la qualité, la dette technique ou la scalabilité d'un projet. Valable pour tout langage et tout framework."
---

# Conventions d'ingénierie universelles

Ce document contient les règles qui restent vraies **quels que soient le langage, le framework
et le domaine métier**. Elles sont dérivées d'audits de dépôts réels : chaque règle correspond à
une faille ou une dette constatée en production, pas à une préférence de style.

**Comment l'utiliser**
- **Nouveau projet** : applique la section *Bootstrap* en premier, avant la première ligne de code métier.
- **Code existant** : n'entreprends pas une migration de masse. Applique les règles au code que tu
  touches, et signale la dette environnante sans la corriger sauf demande explicite.
- **Revue ou audit** : les sections `S1` à `S10` sont **bloquantes**. Le reste est graduel.
- **Conflit avec une convention locale du dépôt** : le dépôt gagne sur le style (nommage,
  formatage). Ce document gagne sur la sécurité et la correction — toujours.

---

## Règle zéro — Une règle qu'aucune machine ne vérifie n'est pas une règle, c'est un souhait

C'est la règle la plus importante du document, et celle qu'on oublie systématiquement.

Un dépôt audité contenait **6 800 lignes** de conventions rédigées, d'excellente qualité. Elles
n'étaient chargées par aucun outil (chemins cassés, activation désactivée). Résultat mesuré :
« `any` interdit » → 274 occurrences · « 80 % de couverture » → 1 % · « helmet obligatoire » →
absent · les middlewares d'autorisation étaient écrits… et branchés nulle part.

**Écrire une règle et l'appliquer sont deux tâches distinctes. Seule la seconde produit un effet.**

Donc : **toute règle que tu ajoutes doit être adossée à un contrôle automatique**, ou être
explicitement étiquetée comme dette. Si tu ne peux pas l'automatiser, elle va dans une checklist
de revue de PR — pas dans un document que personne ne relit.

| Règle | Contrôle mécanique (TypeScript) | Équivalent Python | Équivalent Go |
|---|---|---|---|
| Pas d'échappatoire au typage | `no-explicit-any`, `no-unsafe-*` en **error** | `mypy --strict` | `go vet` |
| Promesses attendues | `no-floating-promises`, `no-misused-promises` | `RUF006`, `ASYNC*` (ruff) | `errcheck` |
| Pas de journalisation sauvage | `no-console` en **error** | `T201` (ruff) | `forbidigo` |
| Aucun secret commité | `gitleaks` en CI **et** en pre-commit | idem | idem |
| Contrat de types respecté | `tsc --noEmit` sur **tous** les packages | `mypy` | build |
| Couverture minimale | `coverageThreshold` qui **fait échouer** le build | `--cov-fail-under` | `-covermode` + seuil |
| Formatage | formateur en pre-commit, **pas** en revue humaine | `ruff format` | `gofmt` |
| Dépendances vulnérables | `audit` / `dependabot` en CI | `pip-audit` | `govulncheck` |

**Trois propriétés obligatoires de la chaîne de contrôle :**
1. **Elle échoue.** Un `|| true`, un `|| echo "skipped"`, un `continue-on-error` sur une étape de
   qualité transforme la CI en théâtre. Un dépôt audité masquait ainsi l'échec de build de son
   frontend : la CI était verte depuis des mois alors que rien n'était ni construit ni testé.
2. **Elle cible les bons chemins.** Vérifie que les globs, filtres et noms de packages existent
   réellement. Le même dépôt lançait ses tests sur un package inexistant, sans jamais s'en rendre compte.
3. **Elle couvre tout le dépôt.** Chaque package a ses scripts `lint`, `typecheck`, `test`, et la CI
   les exécute **tous**. Les deux packages les plus gros de ce dépôt n'avaient aucun script `lint` —
   ce sont ceux dont le code avait le plus dérivé.

> Avant d'écrire une nouvelle règle : vérifie que les règles existantes sont réellement chargées et
> exécutées. C'est presque toujours là que se trouve le problème.

---

# Partie I — Sécurité (bloquant)

Ces dix règles ne se négocient pas. Une violation est un bug bloquant, au même titre qu'un test rouge.
Si on te demande une modification qui en enfreint une, **signale-le et propose la version conforme**
plutôt que de l'appliquer telle quelle.

## S1 — Aucune opération asynchrone non attendue dans un contrôle de sécurité

Dans la plupart des langages, une promesse / future non attendue est un objet **toujours vrai**.
Un test conditionnel sur cette valeur ne teste donc rien, et le contrôle passe systématiquement.

```ts
// ❌ Faille réelle : le token n'est jamais vérifié en base. La révocation (logout, ban,
//    vol de token) est totalement inopérante — sans qu'aucun test ni type ne le signale.
const tokenExists = tokenRepository.findByToken(token);   // promesse, pas de await
if (!tokenExists) return unauthorized(res);               // toujours faux → jamais exécuté

// ✅
const stored = await tokenRepository.findByToken(token);
if (!stored || stored.revokedAt || stored.expiresAt < new Date()) return unauthorized(res);
```

- Une fonction de contrôle qui accède à la base ou au cache est **asynchrone**, sans exception.
- `no-floating-promises` + `no-misused-promises` en **error** : ces deux règles de lint détectent
  cette classe de faille automatiquement. C'est le meilleur retour sur investissement de tout ce document.
- Généralise : tout appel dont on ignore la valeur de retour est suspect (`errcheck` en Go,
  résultat `Result` ignoré en Rust, exception avalée par un `except: pass`).

## S2 — Identité et autorisation sont deux questions distinctes

« Qui es-tu ? » (authentification) ne répond jamais à « as-tu le droit sur **cette** ressource ? »
(autorisation). Omettre la seconde produit une faille IDOR — la vulnérabilité la plus courante et
la plus exploitée des applications métier.

```ts
// ❌ Faille réelle : n'importe quel utilisateur authentifié peut modifier n'importe quel compte.
route.patch('/:id', { preHandler: [isAuthenticated] }, updateUser);

// ✅ Deux contrôles : identité, PUIS appartenance ou rôle.
route.patch('/:id', { preHandler: [isAuthenticated, isSelfOrRole(Role.ADMIN)] }, updateUser);
```

- Toute route portant un identifiant de ressource appartenant à quelqu'un exige **deux** contrôles.
- Le contrôle d'appartenance passe par un **middleware réutilisable**, jamais réimplémenté à la
  main dans le handler : c'est ainsi qu'on en oublie. Dans le dépôt audité, trois contrôleurs
  l'avaient fait à la main, vingt-trois l'avaient oublié — et les middlewares dédiés existaient,
  écrits, testés, branchés nulle part.
- **Toute lecture de liste est filtrée par le périmètre de l'appelant.** Un `findAll` sans
  restriction de périmètre est une fuite de données, y compris entre clients d'un même SaaS.
- Un champ sensible (`role`, `isActive`, `ownerId`, `email` vérifié, `plan`) n'est **jamais**
  modifiable via le schéma de validation d'un endpoint self-service. Prévois deux schémas
  distincts : `updateSelfSchema` et `adminUpdateSchema`.
- Par défaut : **refuser**. Une route sans contrôle explicite doit être fermée, pas ouverte.

## S3 — Les jetons ont un type, une portée et une durée, tous vérifiés

```ts
// ❌ Faille réelle : même secret, même contenu, seule la durée diffère. Un refresh token
//    de 7 jours s'utilise donc directement comme access token.
sign(user, SECRET, { expiresIn: '24h' });   // access
sign(user, SECRET, { expiresIn: '7d'  });   // refresh

// ✅ Secrets distincts, type dans la payload, type vérifié à chaque usage.
sign({ sub: user.id, type: 'access'  }, ACCESS_SECRET,  { expiresIn: '15m' });
sign({ sub: user.id, type: 'refresh' }, REFRESH_SECRET, { expiresIn: '7d'  });

const payload = verify(token, ACCESS_SECRET);
if (payload.type !== 'access') return unauthorized(res, 'Wrong token type');
```

- Jeton d'accès **court** (15 minutes), jeton de rafraîchissement long avec **rotation** à chaque usage.
- **Ne jamais signer l'objet utilisateur complet.** La payload contient un identifiant, un type,
  et rien de plus. Les droits sont relus à la source à chaque requête — sinon une révocation de
  privilèges ne prend effet qu'à l'expiration du jeton, et un changement d'e-mail laisse des
  jetons porteurs de l'ancienne valeur.
- Un échec de vérification renvoie **401**, jamais 500 : une erreur serveur sur un jeton invalide
  révèle une confusion entre « entrée invalide » et « bug ».

## S4 — Un en-tête fourni par le client n'est jamais un contrôle d'accès

```ts
// ❌ Faille réelle : l'autorisation dépend de l'en-tête Origin, trivialement falsifiable
//    hors navigateur, avec des URLs localhost codées en dur donc valides en production.
if (!allowedOrigins.includes(req.headers.origin)) return forbidden(res);
```

- `Origin`, `Referer`, `X-Forwarded-For`, `User-Agent`, un identifiant de tenant dans un en-tête :
  **données déclaratives**, jamais des preuves. L'autorisation se déduit du jeton vérifié, côté serveur.
- CORS est une protection **du navigateur**, pas de ton API. Elle ne remplace aucun contrôle serveur.
- `origin: "*"` (ou reflet automatique de l'origine) **avec** `credentials: true` est interdit :
  cette combinaison autorise n'importe quel site à agir au nom de l'utilisateur. Toujours une
  liste blanche explicite issue de la configuration.
- **Aucune URL ni adresse `localhost` codée en dur dans le code applicatif** : elles resteraient
  valides en production. Elles vivent dans la configuration d'environnement.

## S5 — Aucun secret dans le dépôt

- `.gitignore` contient `.env` et `.env.*`, avec une exception pour `.env.example`.
  **Seul** `.env.example` est versionné, avec des valeurs factices explicites (`JWT_SECRET=change-me`).
- Aucune clé d'API, mot de passe ou chaîne de connexion en dur dans le code, un `Dockerfile` ou un
  fichier de composition — **y compris « juste pour le développement »** : ces fichiers finissent
  déployés, et les identifiants de dev finissent réutilisés en production.
- **En cas de fuite : révoquer chez le fournisseur d'abord**, retirer du suivi Git ensuite. Retirer
  un fichier de Git ne révoque rien, et l'historique reste public sur tous les clones et forks.
- `gitleaks` (ou équivalent) en pre-commit **et** en CI. Le pre-commit peut être contourné, la CI non.

## S6 — La configuration est validée au démarrage, dans un seul endroit

```ts
// ❌ Pattern réel, ~40 occurrences dans un même dépôt : une variable manquante produit un
//    échec silencieux à l'exécution. En production, un secret absent = jetons signés
//    avec la chaîne "undefined" — l'application démarre et paraît fonctionner.
process.env.JWT_SECRET as string

// ✅ Un module unique, validé par schéma, importé partout. Le service refuse de démarrer
//    si la configuration est incomplète ou invalide.
export const env = envSchema.parse(process.env);
```

- L'environnement n'est lu **qu'à un seul endroit** (`config/env.ts`, `settings.py`…). Partout
  ailleurs, on importe l'objet validé et typé.
- Interdiction de forcer le type, d'utiliser `!` ou une valeur par défaut sur un **secret** : un
  défaut silencieux sur un secret est infiniment plus dangereux qu'un crash au démarrage.
  Échouer vite et bruyamment est une fonctionnalité.
- Les secrets font au moins 32 caractères aléatoires, et le schéma le vérifie.
- Toute nouvelle variable est ajoutée **simultanément** au schéma et à `.env.example`. Sinon le
  prochain développeur, ou le prochain déploiement, découvre le manque en production.

## S7 — Le durcissement de production est du code, pas une étape manuelle

- Aucun identifiant par défaut hors développement local (`root/password`, `admin/admin`,
  `minioadmin/minioadmin`). Un dépôt audité les avait en dur dans son fichier de composition **de production**.
- **Aucun service d'infrastructure n'expose de port sur l'hôte en production** : base de données,
  cache, stockage objet, interface d'administration, outils de métriques et de logs communiquent
  sur le réseau interne uniquement.
- Migrations : commande **de déploiement**, jamais la commande de développement (souvent
  interactive et capable de réinitialiser la base). Les données de démonstration ne sont
  **jamais** injectées automatiquement en production.
- Conteneurs privilégiés et montage de la socket du démon Docker : interdits sauf justification
  écrite. C'est une évasion de conteneur immédiate en cas de compromission.
- **Deux services ne partagent jamais une base de données avec deux schémas déclarés distincts** :
  chacun considérera les tables de l'autre comme de la dérive à supprimer, et la première
  migration détruira les données de l'autre.
- Les en-têtes de sécurité HTTP (`helmet` ou équivalent) sont enregistrés dans le code
  d'initialisation. Ce n'est pas optionnel.
- Chaque service expose une sonde de vivacité (`/health`) et une sonde de disponibilité
  (`/ready`, qui vérifie base et cache joignables), réellement utilisées par l'orchestrateur.
  Une dépendance déclarée sans sonde n'attend pas que le service soit prêt, seulement qu'il soit lancé.

## S8 — Toute entrée non authentifiée est hostile

- Un endpoint de webhook (paiement, signature, e-mail, fournisseur tiers) **vérifie la signature
  cryptographique** de l'expéditeur avant toute interprétation du corps de la requête. Sans cela,
  n'importe qui peut déclencher un encaissement, un remboursement ou un changement d'abonnement.
  Le calcul de signature exige le corps **brut** : veille à ce qu'aucun parseur ne le consomme avant.
- Un webhook est **idempotent** : l'identifiant d'événement du fournisseur est persisté, un
  événement déjà traité est ignoré et renvoie un succès. Tous les fournisseurs sérieux rejouent
  leurs événements — c'est une garantie, pas un incident.
- Tout endpoint public (connexion, inscription, mot de passe oublié, webhook, recherche) porte une
  limitation de débit **plus stricte** que le défaut global, indexée sur autre chose que la seule
  adresse IP quand c'est possible.
- Toute entrée est validée par un schéma **au niveau de la frontière** de l'application, jamais en
  profondeur dans la logique métier. Ce qui franchit la frontière est typé et sûr par construction.
- Ne fais jamais confiance à un identifiant fourni par le client pour désigner un propriétaire :
  le propriétaire se déduit du jeton.

## S9 — La journalisation ne fuit rien, et la journalisation sauvage n'existe pas

- **Zéro affichage direct en console dans le code applicatif** : un logger structuré, avec un
  niveau et un contexte. Un dépôt audité en comptait 132, dont un qui journalisait le corps de
  **chaque** requête HTTP dans la console du navigateur.
- Ne journalise **jamais** : mot de passe, empreinte de mot de passe, jeton, clé d'API, cookie,
  en-tête d'autorisation, donnée d'identité réglementée, coordonnées bancaires, corps de requête
  complet. Utilise la fonctionnalité de masquage du logger, configurée une fois pour toutes.
- Les messages d'erreur renvoyés au client ne révèlent ni structure de base, ni trace de pile, ni
  **l'existence d'un compte** : « Identifiants invalides », jamais « Cet e-mail n'existe pas ».
- Journal structuré (JSON) en production, lisible en développement. Un identifiant de corrélation
  par requête, propagé aux services appelés.

## S10 — Le stockage des identifiants côté client obéit au modèle de menace, pas à la commodité

- Le jeton de rafraîchissement va dans un cookie `httpOnly` + `Secure` + `SameSite=Strict`, posé
  par le serveur. Il n'est **jamais** lisible par le code de la page.
- Un jeton stocké dans le stockage local ou un cookie lisible par script est exfiltrable par
  n'importe quelle XSS — y compris via une dépendance compromise, que tu n'as pas écrite et ne
  relis pas. C'est le vecteur le plus probable, pas le plus exotique.
- Le client HTTP intercepte **réellement** la réponse 401 : un rafraîchissement unique mutualisé
  entre les requêtes concurrentes, puis rejeu, et déconnexion propre en cas d'échec. Un fichier
  nommé `interceptor` qui n'intercepte rien est un piège pour la maintenance — un dépôt audité en
  avait un, et ses utilisateurs étaient déconnectés à chaque expiration.

---

# Partie II — Structure et code

## D1 — Un fichier n'existe jamais à deux endroits

C'est la dette structurelle la plus coûteuse, et la plus facile à créer.

Constaté : deux applications d'un même dépôt partageaient **86 fichiers de chemin identique**,
dont un service de 1 121 lignes dupliqué à l'octet près ; deux services partageaient 44 fichiers
de socle technique.

**Le vrai coût n'est pas l'espace disque, c'est que chaque correctif doit être appliqué N fois —
et qu'il le sera N-1 fois.** Un correctif de sécurité appliqué une fois sur deux est un correctif
qui n'existe pas.

- **Avant de créer un fichier, cherche s'il existe déjà ailleurs** (`rg --files -g '<nom>'`).
- Toute logique utilisée deux fois est extraite dans un module partagé et importée des deux côtés.
- **Copier-coller un module entre deux applications est interdit.** Si c'est urgent, extrais quand
  même : l'extraction prend dix minutes de plus que la copie, et fait gagner des mois.
- Le seuil est deux, pas trois. « On verra à la troisième » est la phrase qui a produit chacune de
  ces duplications.
- Corollaire : les dépendances ne vont que dans un sens. Le socle partagé ne connaît pas les
  applications qui le consomment. Une dépendance circulaire entre modules est un défaut de conception.

## D2 — Les couches ne fuient pas

Quelle que soit la stack, la même discipline s'applique :

```
frontière (routes, contrôleurs)  → valide l'entrée, ne contient pas de logique métier
logique métier (services)        → ignore le protocole HTTP et le moteur de base de données
accès aux données (repositories) → seule couche à connaître le schéma de persistance
frontière de sortie              → convertit les entités internes en objets publics
```

- **Une entité de base de données n'est jamais renvoyée telle quelle par une API.** Une couche de
  conversion explicite s'en charge. Sans elle, tout ajout de colonne devient une fuite de données
  potentielle (empreinte de mot de passe, note interne, marge commerciale) et tout renommage
  devient une rupture de contrat.
- Le contrat d'API a **une seule source de vérité**, partagée par le producteur et le consommateur.
  Un type de réponse redéfini à la main côté client est un bug en attente de déploiement.
- La logique métier est testable sans serveur HTTP ni base de données réelle. Si elle ne l'est pas,
  les couches fuient.

## D3 — Typage strict, sans échappatoire

- **L'échappatoire au typage est interdite** : `any`, `as unknown as`, suppression de diagnostic,
  `# type: ignore`, `interface{}` non contraint. Si le type est réellement inconnu, utilise le type
  « inconnu » du langage puis rétrécis-le par une validation de schéma.
- Un type de retour explicite sur toute fonction exportée.
- **Un échappatoire au niveau du socle annule le typage de toutes les couches au-dessus.** Un
  dépôt audité typait son repository de base sur `any` : ses 33 repositories, ses 26 contrôleurs
  et son frontend perdaient toute garantie, malgré 93 000 lignes de TypeScript.
- Mode strict activé dès le premier jour. L'activer sur un code existant coûte cent fois plus.
- Sur du code existant hors norme : ne migre pas en masse. Interdis l'ajout de nouveaux cas
  (règle de lint en `error` + liste d'exceptions figée qui ne peut que décroître).

## D4 — Fonctions et fichiers de taille humaine

- Une fonction = **une** responsabilité, et tient dans un écran (~20 instructions).
- Un fichier dépasse rarement 250-300 lignes. Constaté à l'audit : des fichiers de 600, 900 et
  1 121 lignes — dans un dépôt dont les propres règles imposaient « moins de 20 instructions par
  fonction ». Personne ne lit un fichier de 900 lignes ; on y ajoute juste sa modification à la fin.
- Sorties précoces plutôt qu'imbrication. Au-delà de deux niveaux de conditions imbriquées, extrais.
- Découpe **quand tu passes dans le fichier**, pas dans un chantier dédié qui n'arrivera jamais.

## D5 — Nommage : cohérent avant d'être idéal

- **La convention du dépôt existant gagne toujours** sur toute préférence, la tienne comprise.
  Constaté : un dépôt dont les règles imposaient une convention de nommage de fichiers que
  900 fichiers ne respectaient pas. C'est la **règle** qui avait tort, pas le code. Une convention
  contredite par le code entier n'est pas une convention, c'est du bruit à corriger.
- Applique les invariants universels : les booléens portent un préfixe verbal (`isActive`,
  `hasAccess`, `canDelete`) ; les fonctions commencent par un verbe d'action ; les constantes se
  distinguent des variables ; aucune abréviation non standard.
- **Une seule langue pour le code**, une autre possible pour les messages destinés à l'utilisateur
  final. Documente ce choix. Un vocabulaire d'URL mélangeant deux langues (`/api/users` et
  `/api/utilisateurs`) est une dette permanente : chaque appel exige de deviner.
- Le formatage n'est jamais un sujet de revue : un formateur automatique en pre-commit, et on n'en
  parle plus.

## D6 — Aucune donnée factice dans le chemin de production

- **Aucun import de fichier de données de démonstration depuis du code livré.** Les jeux de
  données factices servent aux tests et aux catalogues de composants, jamais à l'application.
  Constaté : plus de dix écrans d'un produit livré affichaient des données codées en dur ; du
  point de vue du client, ce sont des fonctionnalités en panne.
- Les données de démonstration passent par le mécanisme de peuplement de la base, côté serveur.
- Un travail en cours va derrière un drapeau de fonctionnalité, pas derrière des données factices.

## D7 — Tests : le cas de refus autant que le cas heureux

- Toute route ou fonction publique ajoutée est couverte au minimum par : le cas nominal, le cas
  **non authentifié**, le cas **non autorisé**, et le cas ressource introuvable.
  Les trois derniers sont précisément ceux qu'on omet, et ceux où vivent les failles.
- **Un bug corrigé commence par un test qui échoue.** Sans lui, rien ne garantit ni que le bug
  existait, ni qu'il ne reviendra pas.
- Le seuil de couverture **fait échouer le build**. Un seuil qui n'échoue pas est un indicateur, pas
  un garde-fou. Constaté : 6 fichiers de test pour 93 000 lignes, dans un dépôt exigeant 80 % —
  et une CI verte.
- Priorise par le coût du défaut, pas par la facilité du test : authentification, autorisation,
  paiement, données réglementées, calculs facturés au client.
- Un test ne dépend ni de l'horloge réelle, ni de l'ordre d'exécution, ni du réseau. Un test
  instable est plus nuisible qu'aucun test : il apprend à l'équipe à ignorer le rouge.

## D8 — La documentation qui compte

- Un `README` qui permet à quelqu'un d'arriver et de démarrer le projet, testé sur une machine
  neuve. Vérifie ce que tu documentes : un `README` audité annonçait deux services différents sur
  le même port.
- Les **décisions** d'architecture sont écrites, avec leur contexte et leurs alternatives écartées
  (un dossier de décisions, un fichier par décision). Le code dit *comment*, jamais *pourquoi* — et
  c'est le *pourquoi* qui manque dans six mois, quand personne n'ose plus rien changer.
- Un schéma dans un format propriétaire, illisible sans l'outil qui l'a produit, n'est pas de la
  documentation. Préfère un format textuel versionnable et diffable.
- Un commentaire explique une intention ou un compromis, jamais ce que le code dit déjà. Un
  commentaire qui paraphrase la ligne suivante deviendra faux au premier changement.

---

# Partie III — Bootstrap d'un nouveau projet

À faire **avant** la première ligne de code métier. C'est une demi-journée, et c'est ce qui
détermine si le projet tiendra dans deux ans.

**1. Les garde-fous d'abord**
- [ ] Formateur + linter configurés, avec les règles de la table de la *Règle zéro* en **error**
- [ ] Mode de typage strict activé
- [ ] Hooks pre-commit installés **par le dépôt** (pas un script à lancer à la main — un dépôt
      audité avait un script de pre-commit que Git n'installait jamais, donc jamais exécuté)
- [ ] `gitleaks` en pre-commit et en CI
- [ ] Fichier de verrouillage des dépendances **versionné** (un dépôt audité l'avait mis dans son
      `.gitignore` tout en exigeant une installation verrouillée en CI : builds non reproductibles)

**2. La CI qui dit la vérité**
- [ ] Étapes : install → typecheck → lint → test + couverture → build
- [ ] **Aucun masquage d'échec** : pas de `|| true`, pas de `continue-on-error` sur la qualité
- [ ] **Tous** les packages couverts, noms et chemins vérifiés
- [ ] Le build échoue sous le seuil de couverture
- [ ] Protection de branche : pas de push direct sur la branche principale

**3. Le socle applicatif**
- [ ] Module de configuration unique, validé par schéma, qui refuse de démarrer si incomplet
- [ ] `.env.example` complet et versionné ; `.env*` ignoré
- [ ] Logger structuré avec masquage des champs sensibles configuré **dès le départ**
- [ ] Authentification conforme à `S3` et `S10` (jetons typés, secrets distincts, cookie `httpOnly`)
- [ ] Autorisation en middleware réutilisable dès la première route protégée (`S2`)
- [ ] En-têtes de sécurité, limitation de débit, gestionnaire d'erreurs centralisé, arrêt propre
- [ ] Sondes `/health` et `/ready`
- [ ] Modèle de découpage : socle partagé vs applications, décidé **maintenant** (`D1`)
- [ ] Le premier test écrit est un test de refus (401 ou 403), pour prouver que la chaîne fonctionne

**4. Les décisions écrites**
- [ ] Une décision par sujet structurant : base de données, modèle d'isolation des données,
      style d'API, stratégie d'authentification, découpage des modules
- [ ] Ces conventions rendues disponibles à l'outillage IA du dépôt (`CLAUDE.md`, `.cursor/rules/`,
      `AGENTS.md`) — **et vérifie qu'elles sont effectivement chargées.** C'est exactement là que
      le dépôt audité avait échoué : des règles excellentes, un chemin cassé, zéro effet.

---

# Definition of done (toute modification)

- [ ] Typecheck et lint passent, sans avertissement introduit
- [ ] Tests ajoutés, y compris les cas de refus
- [ ] Aucune opération asynchrone non attendue dans un chemin de sécurité
- [ ] Toute nouvelle route porte un contrôle d'identité **et** un contrôle d'autorisation
- [ ] Aucun secret, aucun échappatoire de typage, aucune journalisation sauvage, aucune donnée
      factice introduits
- [ ] Aucun fichier dupliqué entre modules
- [ ] Nouvelle variable d'environnement présente dans le schéma **et** dans `.env.example`
- [ ] Décision structurante écrite si le contrat ou l'architecture change

---

## Les cinq erreurs qui reviennent dans chaque audit

1. **Des règles écrites que rien n'exécute.** Toujours le premier problème, et jamais celui qu'on
   cherche. Vérifie la chaîne d'application avant d'écrire une ligne de convention.
2. **Une CI qui masque ses échecs.** Verte pendant des mois sur du code qui ne compile pas.
3. **Authentification sans autorisation.** L'identité est vérifiée, l'appartenance jamais.
4. **De la duplication au niveau du socle.** Chaque correctif à appliquer N fois, appliqué N-1 fois.
5. **Le typage relâché à la racine.** Un `any` dans la classe de base annule tout ce qui est au-dessus.

Aucune n'est un problème de compétence. Toutes sont des problèmes d'**absence de garde-fou mécanique**.
