# Design

> Système de design **réellement implémenté** de la plateforme EODA. Il remplace le brief
> `.claude/design/20260930_DOC_EODA_Brief-Claude-Design-Refonte_v01_Interne.md` comme
> référence d'implémentation d'un écran : le brief décrit l'intention et les maquettes,
> ce fichier décrit ce que le dépôt fait — et ce que la machine vérifie.
>
> Il ne remplace pas `PRODUCT.md` (vérité produit : qui, pourquoi, quelles contraintes) ni
> `.claude/CLAUDE.md` (règles métier et techniques). En cas de contradiction entre ce
> fichier et le code, **le code gagne** : ce document se corrige, il ne se présume pas.

## 0. Comment lire ce document

Trois natures de règles, jamais mélangées — les distinguer est le point :

| Marque | Signification |
|---|---|
| **Vérifié** | un test échoue si on l'enfreint. La règle existe indépendamment de la discipline de qui écrit. |
| **Intention** | une règle de conception tenue par la relecture et le bon sens, qu'aucune machine ne contrôle. À traiter comme un point de revue obligatoire. |
| **Interdit** | une décision produit prise ailleurs (souvent `CLAUDE.md` §7) qui se traduit ici en choix visuel. |

La **Règle zéro** du dépôt s'applique : une règle qu'aucune machine ne vérifie est un souhait.
Chaque fois qu'un « Interdit » ou une « Intention » peut descendre en « Vérifié », la ligne
du tableau §8 s'ajoute au même commit.

---

## 1. Couleurs

### 1.1 La charte, en canaux bruts

`apps/web/src/app/globals.css` porte les teintes officielles
(`.claude/context/04-charte-eoda.md`) au format **canaux RGB bruts** — `"62 44 38"`, jamais un
hex. Ce n'est pas une coquetterie : c'est ce qu'exige `rgb(var(--x) / <alpha-value>)` dans
`tailwind.config.ts` pour que les modificateurs d'opacité déjà écrits partout (`bg-terre/12`,
`border-rouge-imp/50`) continuent de fonctionner.

| Variable | Clair | Sombre |
|---|---|---|
| `--brun-ancre` | `62 44 38` #3E2C26 | `243 233 223` #F3E9DF |
| `--brun-moyen` | `92 61 46` #5C3D2E | `205 187 174` #CDBBAE |
| `--terre` | `180 90 50` #B45A32 | `232 148 104` #E89468 |
| `--ambre` | `214 150 70` #D69646 | `230 179 110` #E6B36E |
| `--ivoire` | `240 232 220` #F0E8DC | `47 36 32` #2F2420 |
| `--ivoire-light` | `250 243 235` #FAF3EB | `28 21 18` #1C1512 |
| `--rouge-imp` | `192 57 43` #C0392B | `240 138 125` #F08A7D |
| `--vert-ok` | `39 174 96` #27AE60 | `111 207 151` #6FCF97 |
| `--gris-mid` | `138 123 114` #8A7B72 | `156 139 128` #9C8B80 |
| `--gris-light` | `232 221 214` #E8DDD6 | `70 55 47` #46372F |
| `--surface` | `255 255 255` | `38 29 25` #261D19 |

`--surface` est la **seule** couleur de la liste qui n'existait pas dans la charte d'origine :
elle a été ajoutée pour remplacer les quelque 150 `bg-white`, blanc en clair et brun très
sombre en sombre.

### 1.2 Les jetons de rôle — ce que le code écrit

Le nouveau code n'écrit **pas** les teintes de charte : il écrit le **rôle**. Un rôle nomme un
usage, pas une couleur, et suit le thème sans qu'un composant change.

| Jeton | Clair | Sombre | Usage |
|---|---|---|---|
| `paper` | alias `--ivoire-light` | suit | fond de page |
| `card` | alias `--surface` | suit | fond de carte, d'en-tête, de panneau |
| `soft` | alias `--ivoire` | suit | fond doux, distinct de la carte |
| `line` | alias `--gris-light` | suit | bordures, séparateurs |
| `ink` | alias `--brun-ancre` | suit | texte principal |
| `ink2` | alias `--brun-moyen` | suit | texte secondaire |
| `muted` | alias `--gris-mid` | suit | **décor seulement** (3.7:1) |
| `ink-fill` / `on-ink` | `--brun-ancre` / `--ivoire-light` | redéfinis | pastille d'encre, texte dessus |
| `accent-text` | #A2512D | #E89468 | texte d'accent |
| `accent-fill` | #B45A32 | fixe | aplat d'accent |
| `danger-text` / `danger-fill` | #C0392B | redéfini / fixe | erreur, refus, action destructrice |
| `ok-text` / `ok-soft` / `green-fill` | #2E7D4F / #F2FAF5 / #27AE60 | redéfinis | réussite, pièce réglée |
| `amber-text` / `amber-fill` | #8A5A22 / #D69646 | redéfinis | à relire, en cours |
| `highlight` | #F6E3C6 | #4A3720 | surlignage d'une ligne |
| `focus` | #D69646 | fixe | anneau et contour de focus |
| `on-accent` | #FFFFFF | fixe | texte sur un aplat d'accent |

**La règle à retenir : un aplat garde sa teinte, un texte prend le jeton `*-text`.** Le texte
coloré s'éclaircit en thème sombre, l'aplat reste. C'est ce qui fait que `bg-terre` reste terre
et que `text-accent-text` reste lisible.

Les noms shadcn encore vivants (`border`, `input`, `ring`, `background`, `foreground`) pointent
désormais sur ces rôles ; les autres ont été retirés (sans usage, et en collision avec les rôles).

### 1.3 Couleurs de cotation HAS — **réservées**

`cot-1` #C0392B · `cot-2` #E67E22 · `cot-3` #27AE60 · `cot-4` #1A5276 · `cot-star` #D69646 ·
`cot-nc` #8A7B72 · `cot-ri` #8E44AD. **Vérifié** : ce ne sont pas des variables de thème, et
`rating-palette.test.ts` + `theme-contrast.test.ts` le contrôlent. Elles ne servent qu'à la
cotation — jamais à décorer un état, un badge ou une carte.

### 1.4 Les cinq teintes interdites en texte — **vérifié**

`text-gris-mid`, `text-muted`, `text-terre`, `text-ambre`, `text-vert-ok` font **échouer**
`ui-class-guard.test.ts`, variantes (`hover:`, `placeholder:`) et opacité (`/60`) comprises.
`theme-contrast.test.ts` prouve la raison : ces teintes sont sous 4.5:1 sur le papier clair. Les
remplaçants sont dans le message d'échec : `gris-mid`/`muted` → `text-ink2`, `terre` →
`text-accent-text`, `ambre` → `text-amber-text`, `vert-ok` → `text-ok-text`.

Un **aplat** (`bg-terre`), une **bordure** (`border-gris-mid`) ou un fond très dilué
(`bg-ambre/10`) restent permis : la règle porte sur la couleur d'un texte.

---

## 2. Typographie, formes, focus, mouvement

- **Police** : `'Trebuchet MS', 'Segoe UI', Arial, sans-serif`, posée sur `body` et comme
  `fontFamily.sans`. Aucune web font n'est chargée. (Le brief §12 laissait ouverte la question
  d'une police de substitution : non tranchée, donc rien n'a bougé.)
- **Plancher typographique : 14 px — vérifié.** L'échelle Tailwind est relevée plutôt que
  corrigée : `text-xs` vaut **0.875rem / 14 px** dans `tailwind.config.ts`, parce qu'il est écrit
  plus de 300 fois. Toute taille **arbitraire** sous 14 px (`text-[11px]`, `text-[0.75rem]`,
  `text-[0.8em]`) échoue. Les tailles nommées, elles, ne sont pas interceptées par ce garde : la
  discipline est de partir de `text-sm`/`text-base`, pas de descendre.
- **Rayons** : `rounded-xl` = **12 px** (rayon de carte de la maquette v2, surcharge explicite),
  `rounded-lg` = 8 px (`--radius`), `md` 6 px, `sm` 4 px.
- **Ombres** : `shadow-eoda-sm` / `-md` / `-lg`, trois niveaux seulement, teintés brun
  (`rgba(62,44,38,…)`). Pas d'ombre ad hoc.
- **Focus — vérifié** : posé **une seule fois** en `:focus-visible` dans `globals.css`
  (contour ambre 3 px, `outline-offset: 2px`) plutôt que composant par composant — c'est ainsi
  qu'on en oublie. `outline-none` et `outline-0` échouent, nus ou sous variante.
- **Espacements** : l'échelle Tailwind n'est **pas** étendue. Aucun `--density`, aucune variable
  d'espacement maison.
- **Mouvement** : `accordion-down`/`accordion-up`, `fade-in` (0.2s ease-out). **Tout** est
  neutralisé par `prefers-reduced-motion: reduce`, qui écrase aussi les transitions à 0.01 ms.
- **Impression** : les navigateurs n'impriment pas les fonds de couleur par défaut — un bandeau
  brun sortirait blanc et son titre ivoire invisible. `print-color-adjust: exact` est donc forcé
  sur `.document-print` **seulement** (devis, avenant, contrat, rapport), jamais sur toute
  l'application ; marges `@page 14mm`.

---

## 3. Deux densités, un seul système

**Intention, non vérifiée.** Le brief (§4.3) demande une densité « outil de travail » côté
cabinet et « guidée » côté client, sans faire deux produits. Ce qui est implémenté :

| | Cabinet | Client |
|---|---|---|
| Corps de base | 16 px (défaut) | **`text-lg` = 18 px** sur la racine de la coquille |
| Cible tactile | **≥ 44 px** (`h-11`) | **≥ 48 px** (`h-12`, `min-h-16`) |
| Composants | les mêmes primitives, les mêmes jetons, le même vocabulaire | idem |

**Il n'existe aucun réglage de densité** : pas d'attribut `data-density`, pas de variante de
composant, pas de prop. La densité guidée tient à la classe posée sur la coquille
(`ClientShell.tsx`) et à des tailles écrites à la main dans les composants du portail client.
Comme l'échelle typographique est en `rem` absolus, ce `text-lg` **ne propage rien** à un enfant
qui écrit lui-même `text-sm`. Autrement dit : un écran client peut redevenir dense sans qu'aucun
test ne s'en aperçoive. C'est le premier candidat à transformer en règle vérifiée le jour où un
écran client sera repris. **Une exception depuis le 15/10/2026** : l'entrée de la barre latérale
du client est vérifiée (48 px et `text-lg` côté client, 44 px et `text-base` au cabinet,
`client-sidebar.test.ts`) — la barre latérale est le seul endroit où les deux densités se
côtoient à l'écran, donc le seul où une copie pouvait passer inaperçue.

Ce qui fait vraiment « un seul système » : mêmes primitives, mêmes jetons, même vocabulaire de
statuts, même contour de focus.

---

## 4. Coquilles, navigation, breakpoints

`RoleShell` choisit l'habillage selon le rôle, et **chaque coquille relit l'utilisateur par sa
propre garde** — masquer une entrée n'a jamais été un contrôle d'accès.

### 4.1 Cabinet

- Barre latérale `sticky top-0 h-screen`, `bg-soft`, **visible dès `lg` (1024 px)**,
  **264 px dépliée / 76 px repliée**, transition de largeur neutralisée en mouvement réduit. La
  préférence de repli est par poste (`localStorage`, clé `eoda-cabinet-sidebar`) ; les largeurs
  vivent dans `lib/design/sidebar-preference.ts`, pas dans la feuille de style.
- En-tête `sticky`, **64 px**, `border-b`, fond papier ; fil d'Ariane, bascule de thème, aide.
  Sur téléphone, seule la miette **parente** survit : trois miettes tronquées laissaient des
  liens de 3 px (audit du 14/10/2026).
- Contenu `mx-auto max-w-7xl` (1280 px), `tabIndex={-1}` pour recevoir le lien d'évitement.
- En dessous de `lg` : tiroir ouvert par un bouton de 44 px, `aria-haspopup="dialog"`.
- Navigation **données, pas JSX** : `lib/design/cabinet-navigation.ts` décrit entrées et
  sections, `CabinetNavList` les rend dans la barre **et** dans le tiroir. Une entrée de plus ne
  s'ajoute jamais à un seul des deux rendus.
- Sections repliables (`Réglages`) : l'ouverture suit la page courante et le choix explicite de
  l'utilisateur ; « jamais rien dit » (`null`) n'est pas « refermée » (`false`).

### 4.2 Client

- **Barre latérale** `sticky top-0 h-screen`, `bg-soft`, **visible dès `lg` (1024 px)** —
  mêmes largeurs que le cabinet (**264 px dépliée / 76 px repliée**,
  `lib/design/sidebar-preference.ts`), même bouton de repli, et repli **mémorisé par poste**
  sous **sa propre clé** (`eoda-client-sidebar` ; jamais celle du cabinet — deux coquilles, deux
  publics : replier l'une ne doit pas replier l'autre, et personne n'irait chercher la cause
  dans l'autre portail). Elle est montée par `ClientSidebar`.
- En tête de cette barre : la marque EODA, le nom de la structure, son logo quand elle en a
  déposé un, et son **palier** (`describeModeTag`) — ce dernier **seulement s'il est un fait de
  la mission** ; sans mission, rien n'est écrit, comme pour le bandeau de mode. Le palier ne
  change **rien d'autre** : un seul espace pour tous les paliers, la maquette du portail en
  autonomie l'écrit elle-même (« Même espace, mêmes écrans »). Ce qui se ferme selon l'offre est
  une **action** (`correctionRight`), et ça se refuse côté serveur.
- Elle rend **toutes** les entrées du portail à plat (onze) : la répartition « 4 principales +
  Plus » n'existe que dans la barre du bas, où la place manque. Une entrée rangée dans la barre
  latérale derrière un « Plus » n'aurait plus de menu pour l'accueillir.
- En-tête `sticky`, fond **carte** et non papier, **64 px**. La marque et le nom de la structure
  y sont **`lg:hidden`** (au-dessus, la barre latérale les porte déjà — les écrire deux fois
  ferait deux fois la même annonce) ; « ? Aide », le compte et le thème (dans le panneau du
  compte) restent à droite, à toute largeur.
- Barre du bas `fixed`, `lg:hidden`, entrées de **64 px**, respect de
  `env(safe-area-inset-bottom)`. Le contenu réserve `pb-28` pour ne jamais passer dessous. C'est
  le **seul** rendu sous `lg` : pas de tiroir — le bas couvre déjà toutes les entrées (4 +
  « Plus ») et le pouce l'atteint.
- **Une seule source** : `buildClientNav` est appelé **une fois**, dans `ClientShell` ; la même
  liste part à la barre latérale et à la barre du bas. La répartition principale / « Plus »
  (`splitClientNav`, `lib/design/client-navigation.ts`) ne s'applique qu'à la barre du bas ; les
  entrées masquées par le rôle remontent les suivantes.
- Bandeau de mode sous l'en-tête ; **il ne rend rien si le mode est inconnu** — un mode deviné
  annoncerait un niveau de relecture non acheté.
- Cibles **48 px**, texte **18 px** (§3) : l'entrée de la barre latérale mesure **48 px** contre
  **44 px** au cabinet.

### 4.3 Breakpoints réellement utilisés

`sm` 640 · **`lg` 1024** (les deux bascules majeures) · `xl` 1280. **`md` (768 px) n'est pas
utilisé** : ne pas en introduire sans raison. Largeurs de contenu : cabinet 1280, client 1200.

---

## 5. Statuts : un mot, un glyphe, un ton

`lib/design/status-vocabulary.ts` est la **source unique**. Avant lui, six composants de badge
écrivaient chacun leurs libellés et leurs couleurs : « à faire » était rouge ici, ambre là.

- `StatusPill` rend **toujours** glyphe + mot ; la couleur ne fait que renforcer (WCAG 1.4.1 —
  aucune information portée par la couleur seule). Le contrat est figé dans `primitives.test.ts`.
- Dix tons seulement : `todo`, `deposited`, `review`, `fix`, `ok`, `renew`, `progress`,
  `elsewhere`, `neutral`, `danger`. Un besoin nouveau se range dans un ton existant ou se
  discute ; il ne crée pas une couleur.
- Le vocabulaire couvre documents, quiz, devis, entonnoir commercial, rendez-vous.
- **Jamais un libellé d'étape recopié** : il se lit dans `lifecycle-service`. La pastille d'une
  fiche et la barre de l'entonnoir désignent une étape sous le même nom, parce qu'elles lisent
  la même source.
- « Validé » (relu par EODA) et « Accepté par vous » (geste de la structure) sont **deux entrées
  distinctes** : ils ne se confondent jamais.
- Le portail client garde ses statuts simples (call du 26/08) : les libellés stockés ne changent
  pas, seuls le glyphe et le ton s'alignent.

### 5.1 « Mes documents » — sept groupes de contenu

`content/documents/groupes.ts` range les types de document en sept groupes **d'affichage** :
Loi 2002-2 · Processus · Gestion des risques · Personne accompagnée · Registres · Ressources
humaines · Qualité.

- C'est un classement **de contenu**, jamais la catégorie réglementaire : l'enum
  `DocumentCategory` (LOI_2002_2 / FONCTIONNEMENT / QUALITE_RISQUES / RH) classe les pièces
  attendues au regard de la loi et ne s'invente pas. **Les deux ne se remplacent jamais.**
- Le rangement vit sur le **code** du type, pas sur son libellé : un libellé se réécrit.
- Un type dont le code n'est rangé nulle part (un administrateur peut en créer un en base)
  tombe dans un dernier groupe « Autres documents ». Perdre la ligne ferait disparaître du
  portail un document que la structure a déposé.
- L'avancement d'un groupe est **dérivé de l'état et du mode**, et suit le vocabulaire du
  portail : « 3 relus par EODA sur 9 » en accompagné, « 1 accepté par vous sur 3 » en autonomie,
  « Aucun relu par EODA sur N » quand rien n'est fait. **Jamais « validés »** tant qu'un humain
  n'a pas relu.
- Un groupe sans ligne visible n'est pas rendu ; le compte décrit la liste juste en dessous de
  lui, jamais un total qu'on ne voit pas.
- `groupes.test.ts` échoue si un type du référentiel n'a pas de groupe ou si un code rangé
  n'existe pas.

---

## 6. Voix et mots

### 6.1 Voix

Chaleureuse, précise, rassurante. On vouvoie. On parle comme la consultante à une directrice :
« On s'en occupe », « Il vous reste une étape ». Jamais d'alarmisme, jamais de jargon
(« upload » → « dépôt », « workflow » → « étapes », « dashboard » → « accueil »).

### 6.2 Mots imposés

« Auto-évaluation préparatoire », « diagnostic », « critère impératif », « élément
d'évaluation », « personne accompagnée » (jamais « usager » dans l'interface client), « SAD »,
« structure ».

### 6.3 Mots interdits

« Évaluation officielle », « certifié HAS », « automatiquement conforme », « score A/B/C/D » en
saisie. Le sigle **DIPEC**/**DPEC** est un contresens (le bon sigle est **DIPC**) et **fait
échouer** `content-guard.test.ts`, comme **toute donnée du client pilote** (nom, commune, FINESS)
et **tout second champ mot de passe** écrit à la main plutôt que par `PasswordInput`.

Depuis le 08/10/2026, « IA » **peut** être nommée — mais jamais sans sa réserve. Une sortie de
modèle reste une **proposition à vérifier**, avec les gestes Accepter / Corriger. En autonomie,
tout document produit porte la mention qu'il n'a pas été revérifié par un humain, à l'écran, dans
l'export **et** dans l'e-mail qui l'annonce. Jamais « validé », jamais « conforme » sans relecture.

---

## 7. Règles produit qui deviennent des choix visuels

Ces points viennent de décisions prises ailleurs (`CLAUDE.md` §7) et se traduisent ici en
exigences d'écran. Les enfreindre n'est pas une maladresse de style.

- **L'IA n'est jamais mise en avant** : pas de badge « IA », pas d'étincelle, pas de
  « généré par l'IA » dans une copie d'écran, un e-mail ou un export.
- **Le logo ne se redessine pas** : assets officiels servis par `EodaLogo`, jamais recréés.
- **Jamais « Relu par Sandrine »** — la mention est « Relu par EODA ». Une pré-cotation machine
  se dit « Proposé par la plateforme », pas « Proposé par EODA ».
- **Pas de pictogrammes ARASAAC ni SantéBD** (licences non commerciales) : icônes Lucide, ou
  pictogrammes propres à EODA. Pas d'émojis comme icônes. Pas d'icône sans libellé dans la
  navigation.
- **Pas de logo FALC européen** tant que les textes n'ont pas été relus par des personnes
  concernées.
- **Un état se dérive, il ne s'affiche pas d'un compteur** : un badge qui recalculerait l'état à
  sa façon finirait par contredire la fiche qu'il compte.
- **Les options payantes ne se « vendent » pas avec des cadenas partout** ; un client voit son
  contrat et les options non souscrites à leur prix « à partir de », sans artifice.

### 7.1 Anti-objectifs (repris du brief §11)

Ne pas : réinventer le logo, la palette ou la recolorer la cotation ; couvrir un tableau de bord
de jauges décoratives ; écrire du gris pâle ou du texte sous 14 px ; mettre des en-têtes de
colonne en diagonale ; illustrer avec une mascotte ou un ton infantilisant ; adopter un thème
sombre bleu nuit « façon cybersécurité » — EODA est chaud, terre et ivoire ; présenter un
pourcentage de conformité comme une garantie de résultat à l'évaluation.

---

## 8. Ce que la machine vérifie

Le tableau est le contrat : **ajouter une règle à ce document, c'est ajouter la ligne qui la
vérifie.**

| Règle | Contrôle | Seuil / portée |
|---|---|---|
| Texte jamais sous 14 px | `lib/design/ui-class-guard.test.ts` | toute taille arbitraire < 14 px, tout `apps/web/src/**/*.{ts,tsx}` hors tests, **zéro exception** ; `text-xs` = 14 px |
| Le focus ne se retire jamais | idem | `outline-none`, `outline-0`, nus ou sous variante, partout |
| Cinq teintes interdites en texte | idem | `gris-mid`, `muted`, `terre`, `ambre`, `vert-ok` — variantes et opacité comprises |
| Contraste ≥ 4.5:1 | `lib/design/theme-contrast.test.ts` | **28 paires** texte/fond, en clair **et** en sombre, recalculées depuis `globals.css` (aucune couleur recopiée) |
| Les deux voies du thème sombre sont identiques | idem | `prefers-color-scheme` **strictement égal** à `[data-theme="dark"]` |
| La raison des cinq teintes interdites est prouvée | idem | elles doivent être **< 4.5:1** sur le papier clair ; si l'une passait, le test échoue et la règle se relâche |
| Le fond doux ne se confond pas avec la carte | idem | `soft ≠ card` et `paper ≠ card` en sombre |
| Les couleurs de cotation ne sont pas des jetons de thème | idem + `rating-palette.test.ts` | `cot-*` littérales |
| Pas de sigle faux, pas de donnée du pilote, un seul champ mot de passe | `lib/design/content-guard.test.ts` | tout `src/**/*.{ts,tsx,md,json,csv}` + les deux seeds ; trois exceptions déclarées, jamais implicites |
| Aucun défilement horizontal parasite | `lib/design/scroll-container-rule.test.ts` | toute classe `overflow-x-auto` doit porter `relative` |
| Piège à focus et flèches d'onglets | `lib/design/keyboard-navigation.test.ts` | — |
| Cible tactile des boutons ≥ 44 px | `lib/design/primitives.test.ts` | les 4 tailles de `Button` |
| Contrat d'accessibilité des primitives | idem | `role`/`aria-*` de `StatusPill`, `ProgressBar`, `Tabs`, `FilterChip`, `DataTable`, `Toast` |
| Une seule source de navigation côté client, et la barre latérale rend la liste **entière** | `lib/design/client-sidebar.test.ts` | `buildClientNav` appelé une fois ; pas de `splitClientNav` ni de `slice(` dans `ClientNavList` ; barre du bas `lg:hidden` seul rendu sous `lg` |
| La densité du client survit à la copie de la barre latérale | idem | entrée client `h-12` **et** `text-lg`, entrée cabinet `h-11` — l'une ne se recopie jamais dans l'autre |
| Le repli d'une barre latérale ne replie pas l'autre | `lib/design/navigation.test.ts` | `CLIENT_SIDEBAR_KEY ≠ CABINET_SIDEBAR_KEY`, et clés passées en argument obligatoire |

**Dette déclarée — non vérifié à ce jour** : `eslint-plugin-jsx-a11y` en `error`, un passage
axe-core en CI sur les pages client, la hiérarchie de titres (un seul `h1` par page), et la
double densité (§3) **hors entrée de barre latérale**, qui est désormais vérifiée. Tant qu'ils ne
sont pas branchés, ce sont des points de revue obligatoires, pas des règles.

---

## 9. Écarts assumés par rapport aux maquettes

Quand une règle du dépôt contredit la maquette, **la règle gagne**, et l'écart s'écrit ici.

| Maquette | Dépôt | Pourquoi |
|---|---|---|
| Intertitres en 13 px | 14 px | plancher typographique, vérifié |
| « X validés sur N » | « X relus par EODA sur N » | « validé » est banni côté client sans relecture humaine |
| « C'est bon » / « Validé » avant acceptation client | « Accepté par vous » | deux gestes distincts (D6) |
| « Cabinet EODA · administratrice » | « Cabinet EODA · administration » | le libellé désigne le rôle, pas la personne |
| Chevrons et icônes propres | icônes Lucide | dépendance déjà en place, licences claires |
| Pas d'accordéon dans la barre latérale | section « Réglages » repliable | la barre retrouve la sobriété de la maquette sans perdre quatre entrées d'administration |
| « Journal » hors du groupe principal | conservé dans le groupe principal | c'est un écran de consultation quotidien, pas un réglage |
| Bouton de repli 15 px | cible de 44 px | cible tactile (WCAG 2.5.5) |
| En-tête à hamburger sur les écrans du client, tiroir sous 960 px | barre latérale dès `lg` (1024 px) **et** barre du bas en dessous | le tiroir refermait ce que le bas montrait déjà (4 entrées + « Plus »), et demandait deux gestes là où il en fallait un ; sous `lg`, le pouce atteint le bas sans rien ouvrir |
| Neuf à onze entrées, rangées par thème dans la barre latérale | liste à plat, sans section | onze entrées à 48 px tiennent dans une hauteur de bureau (528 px) ; un regroupement ne se justifiait que pour en cacher |
| Personnes accompagnées, GIR nominatif, « Exporter vers Ximi » dans l'espace du client | absent | hors périmètre V1 : l'export ERP n'existe pas, le GIR n'est pas un champ d'EODA et la liste nominative côté cabinet est fermée par l'ADR du 14/10/2026 (§6 de CLAUDE.md) — **signalé, non implémenté** |
| Rayons 14 px, tailles 15/17/19/21 px | échelle du dépôt : 12 px max, 14/16/18 px | l'échelle typographique et les rayons sont vérifiés ; une maquette n'impose pas une sixième taille |
| Statuts de document stockés | dérivés | un état stocké finit par mentir |
| Cotation avec couleurs de statut, ★ et RI oubliés, NC permis sur impératif | 1/2/3/4/★/NC/RI, NC refusé sur impératif | référentiel HAS |
| « 141 critères SAD » | 137 grilles Synaé / 157 manuel | les deux périmètres ne se confondent pas |
| Import Excel | CSV | `xlsx` est une dette réservée au seed |
| Textes en 11-13 px, capitales, cibles de 40 px, tableaux sans sémantique, modales sans piège à focus | corrigés | accessibilité et sémantique |
| Signature de devis en ligne | aucune route publique | décision produit non prise |
| « Marquer signé », « Nouvelle structure » | retirés | une fiche ne naît que de la signature d'un devis |

Principes de nommage et de contenu : jamais de prénom ni d'e-mail réels dans une maquette ou une
fixture (données du client pilote interdites dans le dépôt) ; les critères et questionnaires ne
s'écrivent jamais en dur dans un composant — ils se lisent en base ou dans un contenu versionné.

---

## 10. Écrire un nouvel écran, en dix lignes

1. L'habillage est déjà choisi : rendre son contenu dans la coquille de son rôle.
2. Écrire les **jetons de rôle** (`bg-paper`, `bg-card`, `text-ink`, `text-ink2`,
   `border-line`), jamais les teintes de charte en couleur de texte.
3. Un aplat garde sa teinte, un texte prend le `*-text` correspondant.
4. Un statut se rend par `<StatusPill pill={…} />` avec un `PillSpec` du vocabulaire — jamais un
   badge recoloré à la main.
5. Une action en ligne utilise `INLINE_ACTION_CLASS`, pas des classes recopiées.
6. Respecter 44 px (cabinet) / 48 px (client) et ne jamais retirer le contour de focus.
7. Les listes et tableaux passent par les primitives (`DataTable`, `EmptyState`, `Skeleton`) —
   elles portent déjà `caption`, `scope`, `role="region"` et l'état vide.
8. Le texte descend au minimum à 14 px ; ne jamais écrire de taille arbitraire.
9. Le français de l'interface suit le §6 : mots imposés, mots interdits, pas de jargon.
10. Si une règle nouvelle naît de cet écran, ajouter sa ligne de vérification dans le même
    commit — sinon elle n'existe pas.
