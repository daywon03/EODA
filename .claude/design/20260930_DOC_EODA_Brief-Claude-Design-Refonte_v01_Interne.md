# Brief de refonte — Plateforme EODA (portail cabinet + portail client + espace équipe)

> **À remettre tel quel à Claude Design.** Document autoportant : Claude Design n'a pas
> accès au dépôt de code. Rédigé le 30/09/2026 par Damon BA (développeur EODA) avec Claude
> Code, à partir du code en production, du cahier des charges du 20/08/2026, de l'offre
> commerciale v10, des réunions de septembre 2026 avec Sandrine Regina (fondatrice EODA) et
> d'une recherche concurrentielle et réglementaire sourcée
> (`.claude/context/09-vision-produit.md` dans le dépôt).
>
> **But** : obtenir un design complet, cohérent et accessible, présentable à Sandrine, puis
> réimplémenté par Damon dans le code existant (Next.js 14 App Router, Tailwind CSS,
> composants de type shadcn/ui, icônes Lucide).

---

## 0. Ce que j'attends de toi (livrables)

1. **Un système de design** : tokens (couleurs, typographie, espacements, rayons, ombres,
   mouvement), en clair **et** en sombre, et une bibliothèque de composants (§8).
2. **Les écrans listés au §7**, en desktop 1440 px pour le cabinet, et en desktop + tablette
   1024 px + mobile 390 px pour le client et l'espace équipe. Chaque écran principal avec
   ses états : vide, chargement, erreur, lecture seule, et le cas « beaucoup de données ».
3. **Trois parcours cliquables** pour la démonstration à Sandrine (§7.7).
4. **Une planche « vision »** séparée qui montre où vont les futurs modules métier (§7.6) —
   hors de la navigation du produit.
5. Pour la remise à Damon : les tokens sous forme de variables CSS **avec les noms existants**
   (§3.1), chaque composant nommé comme son équivalent shadcn (`Button`, `Badge`, `Card`,
   `Tabs`, `Table`, `Dialog`, `Sheet`, `Tooltip`, `Toast`…), et une note par écran : l'action
   principale, les données affichées, les états.

Toutes les données des maquettes sont **fictives et étiquetées comme telles** (§9.4).

---

## 1. Le produit en une page

**EODA conseil** est à la fois un **logiciel** et un **cabinet de conseil**. Il aide les
**Services Autonomie à Domicile (SAD)** — des structures d'aide à domicile pour personnes
âgées ou en situation de handicap — à préparer leur **évaluation qualité obligatoire par la
HAS** (Haute Autorité de Santé), puis à rester prêts entre deux évaluations (tous les 5 ans).

Le référentiel HAS compte **157 critères** en **3 chapitres** : 1 — la personne accompagnée,
2 — les professionnels, 3 — la structure. Un SAD doit en maîtriser parfaitement **16 (SAD
Aide) ou 17 (SAD Mixte)**, dits **critères impératifs**. Chaque critère se prouve par des
documents, des pratiques, des formations, des comptes rendus. D'après la HAS, seuls 10,5 %
des structures évaluées atteignent tous leurs critères impératifs ; les plus mal tenus sont
la gestion de crise, la prévention de la maltraitance et le traitement des plaintes.

La plateforme transforme ce référentiel en **une liste de choses à faire, prouvées et
suivies**. Elle dit à chacun : *ce qui manque, qui doit agir, ce qui est déjà prouvé.*

Le logiciel est le socle (abonnement). Par-dessus, la structure peut acheter un
**accompagnement humain** d'EODA quand elle n'a personne pour mettre les processus en place.

### Ce que le produit n'est PAS — à ne jamais écrire ni suggérer

- **Pas une évaluation HAS officielle.** Toujours « auto-évaluation préparatoire »,
  « diagnostic », « préparation ». EODA n'est pas un organisme évaluateur.
- **Pas un produit « IA ».** Aucun badge « IA », aucune étincelle ✨, aucun « propulsé par
  l'IA », aucune bannière d'assistant. Les automatismes existent mais restent en coulisse
  (§6.4). C'est un choix de positionnement face à des concurrents qui en font leur vitrine.
- **Pas une note A/B/C/D.** Qualiscope (lettres A à D) est l'affichage public de la HAS ; la
  seule cotation saisie dans l'outil est **1 / 2 / 3 / 4 / ★ / NC / RI** (§6.3).
- Pas un ERP (planning, paie, facturation) — ces modules viendront plus tard (§7.6).

---

## 2. Pour qui — les quatre personnes à garder en tête

| | Qui | Contexte | Ce qui compte pour elle |
|---|---|---|---|
| **Sandrine** (cabinet, admin) | Consultante qualité, fondatrice d'EODA | Ordinateur au bureau, tablette en visite, suit 5 à 15 structures | Voir d'un coup d'œil qui est en retard, valider vite, coter pendant un entretien, préparer un devis |
| **Un·e consultant·e partenaire** (cabinet, évaluateur) | Futur collaborateur | Même usage, **sans** accès au commercial | Même outil, rien de financier |
| **Nadia, directrice de SAD** (client) | Dirige une association de ~50 personnes accompagnées, pas de responsable qualité | Ordinateur de bureau ou tablette, entre deux urgences, peu à l'aise avec le numérique | Savoir où elle en est, déposer un document sans se tromper, être rassurée |
| **Fatou, aide à domicile** (équipe terrain) | AVS / ADVF, lit difficilement, français seconde langue, ou n'a pas été scolarisée | Téléphone personnel, entre deux interventions ; tablette de la structure chez une personne accompagnée | Réussir son quiz seule, comprendre une fiche, faire signer un document sans stress |

> **La règle d'or de ce brief : si Fatou ne peut pas le faire seule, le design n'est pas
> fini.** Damon le formule ainsi : *« même un enfant de 12 ans doit pouvoir utiliser la
> plateforme et faire les quiz ».* **Simple ne veut pas dire enfantin** : Fatou est une
> adulte et une professionnelle — pas d'illustrations pour enfants, pas de mascotte, pas de
> ton infantilisant (c'est aussi une règle FALC).

Les noms ci-dessus sont des personas fictives.

---

## 3. Identité visuelle — imposée, à respecter

La charte EODA **ne change pas** : couleurs, logo, signature. Ta liberté porte sur la
composition, les composants, la hiérarchie, la densité, le mouvement, et l'usage des
couleurs — pas sur la palette.

### 3.1 Palette officielle (noms de variables à conserver)

| Variable | Hex | Rôle dans la charte |
|---|---|---|
| `--brun-ancre` | `#3E2C26` | Ancrage, crédibilité — texte principal, en-têtes, fonds sombres |
| `--brun-moyen` | `#5C3D2E` | Éléments secondaires, navigation |
| `--terre` | `#B45A32` | Terre brûlée — accent actif, bouton principal, blocs KPI |
| `--ambre` | `#D69646` | Ambre doré — accents, tags, liserés, bienveillance |
| `--ivoire` | `#F0E8DC` | Fond doux, zones de contenu |
| `--ivoire-light` | `#FAF3EB` | Fond de page |
| `--surface` | `#FFFFFF` | Cartes, panneaux |
| `--gris-mid` | `#8A7B72` | Gris chaud |
| `--gris-light` | `#E8DDD6` | Bordures, fonds neutres |
| `--rouge-imp` | `#C0392B` | **Réservé** : alerte sur critère impératif |
| `--vert-ok` | `#27AE60` | **Réservé** : statut conforme |

**Couleurs de cotation HAS — réservées exclusivement à la cotation** (ne jamais les
réutiliser pour autre chose, sinon on confond un statut et une note) :

| Cotation | Hex |
|---|---|
| 1 — pas du tout satisfaisant | `#C0392B` |
| 2 — plutôt pas satisfaisant | `#E67E22` |
| 3 — plutôt satisfaisant | `#27AE60` |
| 4 — tout à fait satisfaisant | `#1A5276` |
| ★ — optimisé | `#D69646` |
| NC — non concerné | `#8A7B72` |
| RI — réponse inadaptée | `#8E44AD` |

Il existe un **mode sombre** (bascule manuelle clair / sombre / système, déjà en place). En
sombre, la charte s'inverse « encre ↔ papier » : fond brun très foncé, texte ivoire, terre
et ambre éclaircis. Dessine les deux thèmes ensemble, pas l'un déduit de l'autre.

### 3.2 Contraintes de contraste mesurées (WCAG 2.2 AA = 4,5:1 pour le texte courant)

Mesures faites sur la charte actuelle — elles dictent l'usage, pas la palette :

| Couleur en texte | sur blanc | sur `#FAF3EB` (fond de page) | Conséquence |
|---|---|---|---|
| `--brun-ancre` | 13,2 | 12,0 | Texte principal partout ✅ |
| `--brun-moyen` | 9,7 | 8,8 | **Texte secondaire** ✅ (remplace le gris) |
| `--terre` | 4,7 | **4,3** ❌ | Texte terre **uniquement sur surface blanche**, ou en gros titre (≥ 24 px, ou ≥ 19 px gras) |
| `--gris-mid` | **4,1** ❌ | **3,7** ❌ | **Jamais pour du texte à lire** : icônes décoratives, bordures, placeholders seulement |
| `--ambre` | 2,5 ❌ | 2,3 ❌ | Jamais en texte sur fond clair. OK en aplat avec texte brun-ancre (5,2) ou en texte sur brun-ancre (5,2) |
| `--vert-ok` / cot. 2 | 2,9 ❌ | 2,6 ❌ | Aplat + texte brun-ancre (4,6) ✅, ou pastille + icône + libellé en brun |
| `--rouge-imp` | 5,4 | 4,9 | Texte d'alerte ✅ |
| Blanc sur `--terre` | 4,7 | — | Bouton principal ✅ |

### 3.3 Logo

- Deux fichiers officiels, **jamais redessinés, recolorés ni approximés** :
  - **bloc complet** (rond + « EODA conseil » + signature + « Accompagnement qualité des
    ESSMS ») pour fonds clairs : écran de connexion, documents imprimés, e-mails ;
  - **le rond seul** (quartiers brun / terre / ambre sur ivoire, un viseur qui évoque la
    précision du diagnostic) pour fonds sombres et favicon.
- Wordmark : « EODA » en brun foncé, « conseil » en terre brûlée.
- Signature : *« Expliquer · Observer · Démontrer · Accompagner »*.
- Sur les documents produits pour un client, son logo s'affiche à côté de celui d'EODA ;
  sans logo, on écrit le **nom** de la structure — jamais un cadre vide.

### 3.4 Typographie

- Police de marque : **Trebuchet MS** (repli `'Segoe UI', Arial, sans-serif`), utilisée
  sur tous les livrables EODA. Elle reste la police de l'interface.
- Tu peux **proposer** une web font de substitution visuellement proche (humaniste, sans
  empattement, très lisible, chiffres tabulaires, bonne distinction I/l/1 et O/0) si tu juges
  la cohérence multi-appareils insuffisante — étiquetée « proposition à valider par
  Sandrine ». Ne l'impose pas dans les maquettes principales.
- Définis une **vraie échelle typographique** (aujourd'hui chaque titre est réglé à la main) :
  - texte courant **16 px minimum** côté cabinet, **18 px** côté client et espace équipe ;
  - interligne 1,5 minimum ; ligne de 60 à 75 caractères au plus ; texte aligné à gauche,
    jamais justifié ;
  - **rien sous 14 px**, même pour une mention (aujourd'hui il y a du 10–11 px : à supprimer) ;
  - pas d'italique pour du texte à lire, pas de mot entier en MAJUSCULES (les petits titres
    de section en capitales espacées actuels sont à remplacer) ;
  - chiffres tabulaires pour les montants, pourcentages, dates, compteurs.

### 3.5 Pictogrammes — attention aux licences
- Icônes d'interface : **Lucide** (déjà dans le code), trait uniforme.
- Pour les pictogrammes explicatifs (quiz, fiches, FALC) : **ne pas utiliser ARASAAC ni
  SantéBD** — leurs licences interdisent l'usage commercial. Propose un **jeu de
  pictogrammes propre à EODA** (trait, formes simples, adulte, dans la palette), ou des
  ressources sous licence compatible avec un usage commercial, à signaler comme telles.

---

## 4. Accessibilité — l'exigence qui prime sur l'esthétique

Référence : **WCAG 2.2 niveau AA** (socle du RGAA 4.1 français) + règles **FALC**
(« Facile à lire et à comprendre » — règles européennes « L'information pour tous »,
Inclusion Europe / Unapei).

### 4.1 Règles pour tout le produit
- Contraste AA partout (§3.2), états de focus visibles (anneau 2–3 px, jamais retiré).
- Cibles tactiles **48 × 48 px** minimum côté client et équipe (44 côté cabinet), 8 px
  d'écart entre deux cibles.
- **Aucune information portée par la couleur seule** : chaque statut = icône + mot + couleur.
- Chaque icône a un libellé visible (pas d'icône seule dans une navigation ou une action).
- Messages d'erreur à côté du champ, qui disent **quoi faire** (« Ajoutez le fichier du
  livret d'accueil »), jamais « Entrée invalide ».
- Aide toujours au même endroit sur tous les écrans (WCAG 3.2.6).
- Pas de saisie redondante : ce qui a déjà été saisi est pré-rempli (WCAG 3.3.7).
- Connexion sans épreuve de mémoire : coller un mot de passe et le gestionnaire du
  navigateur fonctionnent ; lien magique ou QR code pour l'espace équipe (WCAG 3.3.8).
- Mouvement court (150–250 ms), jamais indispensable, désactivé si `prefers-reduced-motion`.
  Aucune animation côté espace équipe au-delà du retour de réponse.
- Zoom 200 % sans perte, aucune barre de défilement horizontale à 390 px.

### 4.2 Règles FALC pour le portail client et l'espace équipe
- **Une idée par phrase. Phrases courtes**, qui tiennent sur une ligne quand c'est possible.
  Voix active, phrases positives, « vous ».
- Mots du quotidien : « Déposer » (pas « téléverser »), « Il manque 3 documents » (pas
  « 3 pièces en statut MISSING »), « C'est bon » / « À refaire » / « En cours ».
- Pas d'abréviations (« etc. », « ex. »), pas de caractères spéciaux (& § #), pas de
  numérotation du type 1.2.1 dans le texte à lire côté équipe.
- **Côté espace équipe, pas de pourcentages** : « Presque fini », « Plus de la moitié »,
  accompagné d'un visuel. Côté direction, le chiffre est permis s'il est doublé d'une phrase.
- Tout sigle HAS est expliqué la première fois, avec une bulle d'aide (« DIPC : le document
  signé avec la personne accompagnée, qui dit ce que le service fait pour elle »).
- **Pictogramme + texte**, toujours ensemble (§3.5).
- Une action principale par écran, en gros ; boutons « Suivant » / « Retour » / « Accueil »
  larges ; un seul geste pour revenir à l'accueil.
- Des étapes numérotées pour tout parcours à plusieurs temps (« Étape 2 sur 3 »).
- Confirmation avant tout geste définitif ; retour en arrière toujours possible.
- Prévoir la **lecture à voix haute** (bouton « Écouter » sur les quiz et les fiches) — à
  dessiner comme emplacement, la technique sera décidée ensuite.
- **Ne pas apposer le logo FALC européen** : son usage exige une relecture des textes par des
  personnes concernées, qui n'a pas encore eu lieu.

### 4.3 Deux densités, un seul système
- **Cabinet** : densité « outil de travail » — tableaux, filtres, raccourcis, beaucoup
  d'information, mais la même grammaire de statuts et de composants.
- **Client et équipe** : densité « guidée » — plus grand, plus aéré, moins de choix par
  écran, mêmes composants en variante confortable.
Pas deux produits : un seul système avec deux réglages de densité.

---

## 5. Direction de conception — la thèse

### 5.1 L'idée
**« Le dossier de preuves. »** Chaque critère HAS est un dossier qui se remplit : des
documents, des formations, des comptes rendus, une cotation. La plateforme montre en
permanence **ce qui manque, qui doit agir, et ce qui est prouvé** — avant de montrer des
pourcentages. La progression rassure, mais c'est la **prochaine action** qui guide.

Elle refuse l'arrangement par défaut des logiciels qualité : tableau de bord couvert de
jauges, menus à vingt entrées, et le client laissé seul devant 157 lignes.

### 5.2 Références de structure (pas de style)
Damon a montré une application de conformité logicielle (type Vanta / Drata / Bastion) dont
il aime la **structure** — à transposer au référentiel HAS, **sans** en reprendre le thème
sombre bleu ni les codes « tech » :

| Motif observé | Transposition EODA |
|---|---|
| Barre latérale sobre : Accueil, Intégrations, puis sections dépliables | Navigation latérale cabinet (§7.1) |
| « Bonjour Danny » + aperçu de conformité + tâches | Accueil « Bonjour Sandrine » : structures à surveiller + ses tâches du jour |
| Un cadre par référentiel avec % et « 11 jours avant l'audit » | Un cadre par **périmètre** : Impératifs (x/16), Chapitre 1, 2, 3, Documents loi 2002-2 (x/7) + « Évaluation dans 94 jours » |
| Onglets avec compteurs : À faire · Bientôt dû · Revue IA · Revue humaine · Prêt pour l'audit · Exclu | Onglets : **À faire · Bientôt à renouveler · À relire par EODA · Validé · Non concerné** (jamais « IA ») |
| Tableau : test, statut, type, catégorie, responsable | Tableau des critères : critère, statut, preuves (3/5), chapitre, responsable |
| Pastilles « Change requested », « Needs evidence » | « À corriger », « Preuve manquante » |
| Frise d'audit : Préparation → Audit interne → Revue de direction, avec dates et barre | Frise de mission : Diagnostic → Mise en conformité → Suivi → Préparation finale |
| Matrice salariés × formations avec coches | Matrice **équipe × quiz / fiches** (preuve de sensibilisation) — **sans en-têtes en diagonale** (illisibles) |
| Tableau salariés : politiques 1/35 ⚠, formations 0 ✓ | Liste de l'équipe : procédures lues x/12, quiz réussis, dernier passage |
| Documents avec date de renouvellement et relance avant échéance | Échéancier documentaire (DIPC chaque année, projet de service tous les 5 ans) |
| État vide illustré « No result » | États vides illustrés, avec l'action qui les remplit |
| « Send task reminder » en haut d'une liste | « Relancer » en haut de la liste des pièces manquantes |
| Expert humain inclus dans l'abonnement | Sandrine visible : « Votre consultante », « Relu par Sandrine » |

Autre référence fonctionnelle citée en réunion (25/09) : **Digiforma** (logiciel des
organismes de formation) — calendrier des sessions, émargement numérique, génération
automatique des documents, relances datées et traçables (utile comme preuve d'audit), suivi
des recyclages. Leçon à retenir : **la preuve se produit au passage, par le geste du
quotidien**, pas en ressaisissant après coup.

### 5.3 Ce qui rendra EODA reconnaissable (sans toucher à la palette)
- Le **viseur** du logo comme motif discret de progression : les quatre quartiers qui se
  remplissent (Chapitre 1, 2, 3, Documents) — pour l'anneau d'avancement client.
- La signature « Expliquer · Observer · Démontrer · Accompagner » comme structure des
  écrans d'aide et des étapes de mission, pas seulement comme slogan d'en-tête.
- Une chaleur « papier et terre » : fonds ivoire, cartes blanches, brun pour le texte,
  terre pour l'action — sérieux, humain, pas clinique, pas « start-up ».
- Une présence humaine : la consultante a un visage et un nom dans le portail client.

---

## 6. Règles métier que le design doit rendre visibles

### 6.1 Deux portails qui ne regardent pas la même chose
- Le cabinet voit le **parcours complet** d'un document : déposé → analysé → mis en
  conformité → restitué → validé.
- Le client voit **trois états simples** : **À déposer** · **Reçu, en cours** · **C'est bon**
  (+ « Non concerné »). Jamais les étapes internes.

### 6.2 La validation humaine est un moment fort
Pour une structure **accompagnée**, aucune analyse automatique ne lui parvient sans que
Sandrine l'ait **relue et validée**. Côté cabinet, « À relire » est une file prioritaire avec
un geste clair « Valider pour le client ». Côté client, ce qui arrive porte une mention
humaine : « Relu par Sandrine, le 28/09 ». C'est l'argument de confiance d'EODA face aux
concurrents : rends-le visible et chaleureux.

Pour une structure **seule** (Diagnostic, Mise en conformité — §7.4 bis), c'est **elle** qui
valide : chaque production porte « À vérifier par vous · non relu par EODA » et un bouton
« Je valide ». Les deux mentions ne se ressemblent jamais : « Relu par Sandrine » est un
engagement d'EODA, « À vérifier par vous » n'en est pas un.

### 6.3 La cotation HAS (écran d'auto-évaluation)
- Valeurs : **1, 2, 3, 4, ★, NC, RI** — couleurs réservées du §3.1, chaque bouton avec son
  chiffre **et** son libellé court (« 3 — plutôt satisfaisant »).
- **RI** n'existe qu'au **chapitre 1**. Ne l'affiche jamais aux chapitres 2 et 3.
- **NC sur un critère impératif** : avertissement pédagogique (pas un blocage), qui rappelle
  les 4 questions à se poser.
- ★ compte comme 4. Les critères impératifs sont repérés partout (pictogramme + mot
  « Impératif » + liseré rouge-imp).
- Une session clôturée est une **photo** : lecture seule, horodatée, comparable à la
  suivante (écran de comparaison : progression / recul / non comparable).
- Toujours préciser le périmètre : « 137 critères sur le périmètre SAD » ≠ « 157 critères du
  manuel ».

### 6.4 Les automatismes : présents, jamais mis en avant
Ce que la machine fait (lecture d'un document déposé, repérage des critères qu'il couvre,
champs à compléter, proposition de cotation, questions de quiz tirées des procédures) est
toujours présenté comme **une proposition à vérifier** :
- vocabulaire : « Proposition », « À vérifier », « Suggestion » — jamais « IA » ;
- visuel : discret (liseré ambre, icône de brouillon), avec les deux gestes **Accepter** /
  **Corriger**, et « Tout accepter » quand il y a plusieurs propositions ;
- une proposition n'a jamais l'air d'une décision ; pour une structure accompagnée, elle
  n'est visible du client qu'après la relecture de Sandrine ; pour une structure seule, elle
  lui arrive comme un brouillon « À vérifier par vous ».

### 6.5 Contrat, prix, offres
- Le client voit **son** contrat : offre souscrite, options, montant signé, acompte, solde.
  Il voit aussi les options non souscrites avec un prix « **à partir de** ».
- Deux natures de prix, jamais rendues pareil : **ferme** (devis signé) et **« à partir
  de »** (catalogue). Le client **demande** une option ; c'est Sandrine qui l'active.
- Le pipeline commercial, le catalogue complet et les indicateurs commerciaux sont
  **réservés à l'administratrice** du cabinet — invisibles pour un consultant et pour un
  client.
- Les montants de la nouvelle offre SaaS ne sont **pas arrêtés** : dans les maquettes,
  utilise des emplacements « xx € / mois » plutôt que des chiffres.

### 6.6 Fin de mission
Trois états d'accès client : **Actif** · **Bibliothèque** (lecture seule, documents
conservés) · **Accès fermé**. Dessine les bandeaux correspondants, calmes, jamais alarmants.

### 6.7 Données sensibles
Les documents peuvent concerner des personnes accompagnées. Les notifications par e-mail ne
contiennent jamais le contenu d'un message. Aucune maquette ne montre de vrai nom (§9.4).

---

## 7. Architecture et écrans

### 7.1 Portail cabinet — navigation

Passage d'onglets horizontaux à une **barre latérale** repliable (desktop), avec recherche
globale (⌘K) en tête :

```
[Rond EODA] EODA conseil
Rechercher…                             ⌘K
─────────────────────────
Accueil
Structures              (liste + fiches)
À relire           [3]  (file de validation)
Agenda
Bibliothèque            (modèles et références)
─────────────────────────
Commercial ▸            (admin uniquement)
   Vue d'ensemble · Prospects · Devis · Catalogue
─────────────────────────
Journal d'audit
Aide
─────────────────────────
[Avatar] Sandrine · Cabinet EODA   ▾  (profil, thème, déconnexion)
```

- Un consultant (non admin) ne voit **pas** la section Commercial — et aucun bouton ne l'y
  envoie (aujourd'hui le tableau de bord lui propose « Nouveau prospect », qui le renvoie
  en silence : à supprimer).
- Fil d'Ariane en haut de chaque page profonde (Structures › SAD Les Glycines › Chapitre 2).
- Tablette : barre latérale en icônes + libellés courts ; mobile cabinet : non prioritaire.

### 7.2 Portail cabinet — écrans

| Écran | Aujourd'hui | Intention de la refonte | Action principale |
|---|---|---|---|
| **Accueil** | 4 KPI + grille de cartes établissements | « Bonjour Sandrine » · **À surveiller** (structures en retard, échéances HAS < 6 mois, pièces en attente de relecture) · **Mes tâches du jour** · prochains rendez-vous. KPI réduits à 3–4, cliquables. | Ouvrir la file « À relire » |
| **Structures (liste)** | Cartes | Tableau filtrable : structure, type (SAD Aide/Mixte), offre, étape (dérivée), avancement, impératifs x/16, échéance HAS, dernière activité. Tri « le plus urgent » par défaut. Vue cartes en option. | Ouvrir une fiche |
| **Fiche structure** | Une page de 12 ancres, 10 cartes, 15+ actions (Sandrine : « trop hangar ») | **En-tête fixe** (nom, type, offre, étape, échéance, 1 action principale + menu « … ») et **onglets** : Vue d'ensemble · Documents · Critères · Auto-évaluation · Plan d'action · Équipe & formations · Mission · Échanges · Réglages. La vue d'ensemble montre les cadres de conformité (§5.2) et les 5 prochaines actions. | Selon l'onglet |
| **Documents** (onglet) | Checklist longue, ligne très chargée | Tableau par catégorie (Loi 2002-2, Fonctionnement, Qualité & risques, RH) avec onglets-compteurs (À faire · À relire · Validé · À renouveler · Non concerné). Ligne sobre : nom, statut, version, date, critères couverts. **Panneau latéral** au clic : aperçu, historique des versions, analyse à relire, propositions, **journal des modifications** (qui a changé quoi, quels critères sont concernés). | Relire / Valider |
| **Critères** (onglet, nouveau) | N'existe pas | Tableau des critères du périmètre avec statut, preuves (3/5), chapitre, impératif, responsable. **Fiche critère** en panneau : intitulé, éléments d'évaluation reformulés, preuves rattachées (documents, quiz, CR, émargements), dernière cotation, actions ouvertes. Un document peut couvrir de 2 à 10 critères, un critère demande de 3 à 7 preuves. | Rattacher une preuve |
| **Auto-évaluation** | Grille de chapitres, cotation par chapitre, chronomètre | Conserver la structure (chapitre → thème → critère → élément) en l'allégeant ; **mode entretien** plein écran pour tablette (grosses touches de cotation, question reformulée en gros, prise de notes), barre de progression du chapitre, résultats en fin de chapitre. Comparaison de deux sessions. | Coter |
| **Plan d'action** (nouveau) | Non construit | Tableau des actions : issue d'un critère coté < 4 (les impératifs en tête, étiquette « Critique »), responsable, échéance, statut, preuve attendue. Chaque ligne indique si elle est **comprise** dans l'offre ou **en option** (« Demander un devis »). | Assigner / clôturer |
| **Équipe & formations** (nouveau) | N'existe pas | Liste de l'équipe de la structure (importée d'un tableur ou saisie), matrice **personnes × quiz / fiches / procédures lues** (réussi / à refaire / pas encore), date du dernier passage, rappel tous les 6 mois, remise à zéro propre quand une personne quitte la structure (fort turnover). Génération d'un **QR code** par quiz. Export de preuve (émargement numérique daté). | Envoyer un quiz |
| **Mission** | Page très longue | Frise horizontale des phases (Diagnostic → Mise en conformité → Suivi → Préparation finale) avec dates et barre ; sous la frise, la checklist de la phase en cours seulement ; périmètre contractuel et avenants dans un panneau à part ; clôture en bas, isolée. | Cocher l'étape suivante |
| **Échanges** | Fil de messages | Fil clair, lu / non lu, pas de pièce jointe (les documents passent par le dépôt). | Répondre |
| **À relire** (file, nouveau) | Dispersé dans les fiches | Toutes les analyses et propositions en attente de validation, toutes structures confondues, triées par ancienneté ; relecture côte à côte (document à gauche, analyse à droite). | Valider pour le client |
| **Agenda** | Grille mensuelle + liste | Vue mois / semaine, rendez-vous par structure, **commentaires** sur une date (demande de Sandrine du 22/09), visibles aussi côté client. | Ajouter un rendez-vous |
| **Bibliothèque** | Dossiers de modèles | Deux espaces nets : **Documents de référence** (manuel HAS, textes — sans version) et **Gabarits EODA** (deux états : vierge → final). Filtre par critère HAS. Dans un gabarit, les **champs à compléter** par le client (logo, nom, SIRET, FINESS) sont repérés par une couleur dédiée. Import de dossier : tableau de propositions à corriger avant enregistrement. | Déposer un modèle |
| **Commercial** (admin) | 4 sous-onglets | Garder : vue d'ensemble (entonnoir unique, CA signé), prospects en kanban, devis, catalogue. Harmoniser avec le système (cartes, pastilles, tableaux). Une seule notion de « statut » visible par prospect (aujourd'hui trois). | Nouveau prospect |
| **Fiche prospect / devis / signature** | Sections repliables | Frise d'étapes en tête + « Étape suivante » mise en avant ; découverte, devis, rendez-vous, historique en onglets. Écran de signature en étapes numérotées. | Passer à l'étape suivante |
| **Journal d'audit** | Tableau + filtres | Tableau paginé, filtres, export. Accessible depuis la barre latérale. | Filtrer |
| **Connexion / mot de passe / profil / aide** | Écran en deux colonnes | Garder le principe (panneau brun + logo). Aide : centre d'aide avec recherche, articles par rôle, vidéos courtes. | Se connecter |

### 7.3 Portail client — navigation

Pour Nadia : **cinq entrées au plus**, pictogramme + mot, en haut sur desktop, **barre du
bas sur mobile**. La barre ne change jamais de place.

```
Accueil · Mes documents · Mon équipe · Mes rendez-vous · Messages
(profil, contrat, aide dans le menu du compte ; bouton d'aide toujours visible)
```

### 7.4 Portail client — écrans

| Écran | Intention | Action principale |
|---|---|---|
| **Accueil** (nouveau, remplace « Mes documents » comme porte d'entrée) | Une phrase qui dit où on en est (« Plus de la moitié est faite. Il reste 4 documents à déposer. »), l'**anneau-viseur** d'avancement, **la prochaine chose à faire** en gros, le prochain rendez-vous, le dernier message et le visage de la consultante, les nouveautés relues par Sandrine. | Faire la prochaine action |
| **Mes documents** | Liste par catégorie en langage simple, trois états (§6.1), bouton « Déposer » par ligne, **modèle vierge téléchargeable** quand il existe, glisser-déposer + appareil photo sur tablette. Parcours de dépôt en 3 étapes : choisir → vérifier → envoyer, avec confirmation claire. | Déposer |
| **Mes livrables** | Documents remis et validés par EODA, avec « Relu par Sandrine le… », aperçu et téléchargement ; récapitulatif d'une page « ce qui a changé » par document. | Télécharger |
| **Mon suivi** | La frise de l'accompagnement (où on en est, ce qui vient), ce que la structure doit fournir. | — |
| **Mon équipe** (nouveau) | Qui a fait quel quiz, qui doit le refaire, QR codes à afficher en réunion, fiches de sensibilisation, bibliothèque d'auto-formation. | Lancer un quiz |
| **Mes rendez-vous** | Liste + calendrier, possibilité d'ajouter un commentaire sur une date. | Commenter |
| **Messages** | Fil avec EODA, gros champ de réponse. | Écrire |
| **Mon contrat** | Offre, options souscrites, montants fermes vs « à partir de », options disponibles → « Demander », documents contractuels imprimables. | Demander une option |
| **Rappel annuel** (nouveau) | Une fois par an, une fenêtre douce : « Vos procédures sont-elles toujours à jour ? » + liste des documents à revoir (DIPC chaque année, projet de service tous les 5 ans…). | Vérifier |
| **Bandeaux d'état** | Bêta-test gratuit · Bibliothèque (lecture seule) · Accès fermé · Pas encore de structure rattachée. | — |

### 7.4 bis Trois façons d'utiliser le même portail : Diagnostic, Mise en conformité, Accompagné

> Décision Damon du 30/09/2026 ; montants et détails à valider avec Sandrine. **C'est le même
> portail** — mêmes écrans, même navigation. Seuls certains blocs changent selon le mode.
> Rien n'y est présenté comme « IA » : on parle de ce que la plateforme **fait**.

| | **1. Diagnostic** (seul) | **2. Mise en conformité** (seul) | **3. Accompagné** (avec EODA) |
|---|---|---|---|
| Ce que c'est | **Le contenu de l'offre Essentiel, en autonomie** : les 16 (ou 17) critères impératifs + les 7 documents loi 2002-2 | Tout le Diagnostic, **sur tout le référentiel**, et la plateforme corrige les documents | Le Diagnostic ou la Mise en conformité **+ Sandrine** (Performance, Excellence, prestations à la carte) |
| Documents | La structure dépose ; la plateforme les analyse et dit ce qui manque | + bouton **« Mettre en conformité »** sur chaque document → une version corrigée à relire ; + **« Créer ce document »** à partir d'un modèle EODA quand il manque | Idem, **relu et validé par Sandrine** avant de revenir au client |
| Pratiques (§7.4 ter) | Questions sur les 16 impératifs | Questions sur tous les critères | Posées avec Sandrine en entretien |
| Résultat | **Rapport de diagnostic + plan d'action** générés, à appliquer seul | + documents mis en conformité, plan d'action suivi | + visite, ateliers, suivi hebdomadaire selon l'offre |
| Qui valide | **La structure elle-même** — chaque production porte « À vérifier par vous · non relu par EODA » et un bouton « Je valide » | Idem | **Sandrine** (« Relu par Sandrine le… ») puis la structure accepte |
| Messages, rendez-vous | « Aide » + « Être accompagné » | Idem | Fil avec EODA, agenda partagé, visage et nom de la consultante |
| Équipe (quiz, fiches) | Inclus | Inclus | Inclus |

**Le bouton « Mettre en conformité »** (mode 2 et 3) :
- visible sur la ligne d'un document analysé qui a des manques ;
- ouvre une vue côte à côte : à gauche le document d'origine, à droite la version proposée,
  **les ajouts surlignés** ; chaque ajout indique le critère qu'il sert ;
- les champs propres à la structure (nom, SIRET, FINESS, logo, dates) apparaissent dans une
  couleur dédiée « à compléter » ;
- gestes : **Accepter tout** · **Accepter / refuser ajout par ajout** · **Télécharger en Word** ;
- la version acceptée devient une nouvelle version du document (l'ancienne est conservée).

**Passer à l'accompagnement** : encart discret là où la structure bloque (« Ce document est
difficile ? Sandrine peut s'en occuper. ») + « Être accompagné » dans le menu du compte →
demande → confirmation → côté cabinet, la demande arrive dans la file → Sandrine prépare le
devis. Le client **demande**, Sandrine **déclenche**. Après signature, le portail bascule
**sans rien perdre** et un bandeau l'annonce.

**Côté cabinet — voir d'un coup d'œil qui est seul et qui est accompagné :**
- une **étiquette de mode** sur chaque structure, partout où elle apparaît (liste, accueil,
  fiche) : « Diagnostic · seul », « Mise en conformité · seul », « Accompagné · Performance »… ;
- un **filtre** et un **compteur** par mode dans la liste des structures et sur l'accueil ;
- pour une structure **seule** : la fiche montre le compte, l'abonnement, l'avancement
  global et la date de dernière activité — **pas le contenu de ses documents ni ses
  réponses** (confidentialité) ; dessine cet état « fiche en autonomie » ;
- pour une structure **accompagnée** : la fiche complète (§7.2) et la file « À relire » ;
- les demandes « Être accompagné » remontent dans l'accueil de Sandrine (« À surveiller »).

### 7.4 ter Les pratiques, pas seulement les documents

Un critère HAS ne se prouve pas qu'avec des papiers : l'évaluateur vérifie aussi que **les
processus sont appliqués**. Le portail pose donc, critère par critère ou thématique par
thématique, des questions sur les pratiques. Elles reprennent la structure des grilles Synaé
(une ligne par élément d'évaluation, avec « éléments de preuve consultés » et
« commentaires ») et du classeur de suivi de Sandrine (preuves, statut « Documenté » /
« Partiel — action à prévoir », action prioritaire ; pour les impératifs : écart constaté,
corrections apportées, reste à traiter, pilote, échéance).

- Une question à la fois, en langage simple : « Quand une personne se plaint, que se
  passe-t-il ? Racontez-nous. » ; « Est-ce que ce processus est en place ? » (Oui / En
  partie / Pas encore / Je ne sais pas).
- **Réponse écrite ou dictée** : un gros bouton micro « Expliquer à voix haute », le texte
  transcrit s'affiche et se corrige avant d'être enregistré.
- La plateforme relie la réponse aux documents déjà déposés et propose, s'il manque une
  preuve, ce qu'il faudrait fournir (« une feuille d'émargement de la dernière réunion »).
- Les réponses alimentent le rapport de diagnostic et le plan d'action ; en mode Accompagné,
  Sandrine les relit.
- Rappel en tête de chaque questionnaire : « Ne citez aucun nom de personne accompagnée. »

À dessiner : l'accueil client dans les trois modes, la vue « Mettre en conformité »
côte à côte, un questionnaire de pratiques avec la dictée, l'encart « Être accompagné », le
bandeau de bascule, et côté cabinet la liste filtrée par mode + la fiche « en autonomie ».

### 7.5 Espace équipe (AVS / ADVF) — nouveau, mobile d'abord

Accès par **QR code** (affiché en réunion, imprimé, envoyé par SMS). Décision ouverte :
compte personnel ou simple choix de son nom dans la liste de l'équipe + code court — dessine
la variante « choisir son nom » en priorité (la plus simple).

| Écran | Intention |
|---|---|
| **Bienvenue** | Logo de la structure + EODA, « Bonjour ! Choisissez votre nom. », gros boutons. |
| **Quiz** | Une question par écran, **très gros texte**, pictogramme ou photo réaliste, 2 à 4 réponses en gros boutons, bouton « Écouter la question », « Question 3 sur 8 ». Réponse : retour immédiat simple (✓ « Bonne réponse » / « Pas tout à fait : voici pourquoi »). Pas de chronomètre, pas de classement public, pas de score humiliant. |
| **Résultat** | « C'est réussi ! » ou « Vous pourrez le refaire », ce qu'il faut retenir en 3 phrases, prochaine date. |
| **Fiches** | Fiches de sensibilisation courtes (douleur, bientraitance, risque infectieux, isolement…), une idée par carte, lecture à voix haute. |
| **Signature sur tablette** ⚠️ | Parcours en visite : choisir la personne accompagnée → choisir le document (ex. DIPC) → **résumé en 3 points lus à voix haute** → la personne **ou son représentant légal** signe au doigt → « C'est signé, merci » → le document part dans le dossier. Une **feuille de réception unique** pour plusieurs documents (demande du 22/09 : signer 6 documents un par un prend 40 min). Grands caractères, contraste fort, mode paysage. **Module conditionné** à une décision d'hébergement (données de santé, §6.7) : dessine-le, il ne sera pas construit tout de suite. |
| **Enquête de satisfaction** | Version en ligne (une question par écran, échelle de visages + mots) + maquette de la **version papier** et de l'écran « photographier les réponses papier ». |

### 7.6 Planche « vision » (hors navigation)
Montrer, sur une seule planche, comment la plateforme **s'étendra après la conformité** :
registres EI / plaintes, KPI qualité, puis planning des intervenants, tournées, dossiers
des personnes accompagnées, RH et habilitations, facturation. Style « à venir »,
schématique. **Ne pas** placer ces modules verrouillés dans la navigation client : un menu
plein de cadenas perd les personnes les moins à l'aise.

### 7.7 Parcours à rendre cliquables pour la démonstration
1. **Nadia dépose un document** : Accueil → « Il manque le livret d'accueil » → Déposer →
   confirmation → statut « Reçu, en cours ».
2. **Sandrine le valide** : Accueil cabinet → À relire → relecture côte à côte → corrige
   une proposition → « Valider pour le client » → côté client : « C'est bon · Relu par
   Sandrine ».
3. **Fatou fait un quiz** : scan du QR → choisir son nom → 5 questions → résultat → côté
   client, la matrice de l'équipe se met à jour.

---

## 8. Composants à concevoir (un seul système)

- **Statuts** : une seule pastille `StatusPill` (icône + mot + couleur), vocabulaire unifié :
  - client : À déposer · Reçu, en cours · C'est bon · Non concerné · À renouveler ;
  - cabinet : Manquant · Déposé · À relire · À corriger · Validé · Périmé · Non concerné.
  Aujourd'hui six composants de badge différents coexistent : un seul, des variantes.
- **Progression** : barre avec libellé et valeur, anneau-viseur à 4 quartiers, compteur de
  preuves « 3/5 », cadre de périmètre (Impératifs, Chapitres, Loi 2002-2) avec échéance.
- **Onglets avec compteurs**, **tableau de données** (tri, filtres en listes déroulantes,
  sélection, pagination « Afficher 20 », export), **panneau latéral** (`Sheet`) pour le
  détail sans quitter la liste.
- **Frise de phases** (mission, prospect, signature) et **stepper** numéroté.
- **Cartes** : KPI (chiffre + libellé + tendance, cliquable), structure, prospect, devis.
- **Cotation** : groupe de boutons 1/2/3/4/★/NC/RI (variantes normal / mode entretien
  tablette), marque « Impératif », avertissement NC.
- **Proposition automatique** : bloc « Proposition à vérifier » avec Accepter / Corriger /
  Tout accepter (§6.4).
- **États vides** illustrés (un composant, pas quinze copies), **encarts** d'information /
  alerte / succès (un composant `Callout`), **toasts**, **dialogue de confirmation**
  (jamais la boîte native du navigateur), **squelettes de chargement** qui réservent la place.
- **Quiz** : carte question, bouton-réponse géant, retour correct / incorrect, écran
  résultat. **Signature** : zone de signature, récapitulatif, confirmation.
- **Navigation** : barre latérale cabinet, barre haute + barre du bas client, fil d'Ariane,
  menu du compte, sélecteur de thème (clair / sombre / système), bouton d'aide constant.
- **Formulaires** : libellé toujours visible, aide sous le champ, erreur sous le champ,
  champs obligatoires marqués, grands champs (48 px) côté client.

---

## 9. Contenu et ton

### 9.1 Voix
Chaleureuse, précise, rassurante. On vouvoie. On parle comme Sandrine à une directrice :
« On s'en occupe », « Il vous reste une étape ». Jamais d'alarmisme, jamais de jargon
technique (« upload », « workflow », « dashboard » → « dépôt », « étapes », « accueil »).

### 9.2 Mots imposés
« Auto-évaluation préparatoire », « diagnostic », « critère impératif », « élément
d'évaluation », « personne accompagnée » (pas « usager » dans l'interface client), « SAD »,
« structure ».

### 9.3 Mots interdits
« Évaluation officielle », « certifié HAS », « IA », « intelligence artificielle »,
« automatiquement conforme », « score A/B/C/D » en saisie.

### 9.4 Données de démonstration
Structure fictive : **« SAD Les Glycines (fictif) »**, SAD Aide, 48 personnes accompagnées,
évaluation dans 94 jours, offre Performance. Équipe fictive de 12 personnes aux prénoms
variés. Critères et documents : réels (contenus publics du référentiel HAS) — exemples :
3.12.1 « Recueil et traitement des plaintes et réclamations », livret d'accueil, DIPC,
règlement de fonctionnement, plan de continuité d'activité. **Ne jamais utiliser le nom du
client pilote réel ni de vraies personnes.** Prix de l'abonnement : « xx € / mois ».

---

## 10. Responsive

| Surface | Cible principale | À vérifier aussi |
|---|---|---|
| Cabinet | Desktop 1280–1600 | Tablette 1024 (mode entretien, visite) |
| Client | Desktop 1280 et tablette 1024 | Mobile 390 (consultation, message) |
| Espace équipe | Mobile 390 (quiz) | Tablette paysage 1024 (signature) |

---

## 11. Ce qu'il ne faut pas faire (anti-objectifs)

- Réinventer le logo, changer la palette, recolorer la cotation.
- Mettre l'IA en avant d'une façon ou d'une autre.
- Un tableau de bord couvert de jauges et de graphiques décoratifs.
- Du texte gris pâle, des tailles sous 14 px, des en-têtes de colonnes en diagonale.
- Des icônes sans libellé dans la navigation, des émojis comme icônes.
- Des illustrations enfantines, une mascotte, un ton infantilisant.
- Des cadenas partout pour « vendre » des options au client.
- Un thème sombre bleu nuit façon outil de cybersécurité : EODA est chaud, terre et ivoire.
- Présenter un pourcentage de conformité comme une garantie de résultat à l'évaluation.
- Des pictogrammes ARASAAC ou SantéBD (licences non commerciales).

---

## 12. Questions ouvertes à présenter à Sandrine avec les maquettes

1. L'espace équipe : compte personnel ou « choisir son nom » + code ?
2. La web font de substitution à Trebuchet MS : oui / non ?
3. Les options du plan d'action visibles du client (« Demander un devis ») : oui / non ?
4. La lecture à voix haute : sur les quiz seulement, ou aussi sur les documents client ?
5. La matrice de l'équipe : visible de la direction seulement, ou aussi des salariés ?
6. Faire relire les écrans « équipe » par des aides à domicile de la structure pilote avant
   de les construire ?
7. Client seul (Diagnostic, Mise en conformité) : c'est la structure qui valide ce que la
   plateforme produit, avec la mention « non relu par EODA » — d'accord ? Et le contenu de
   ses documents reste fermé côté cabinet tant qu'aucun accompagnement n'est signé ?
8. La dictée vocale des réponses : oui pour tous, ou seulement sur tablette et mobile ?
