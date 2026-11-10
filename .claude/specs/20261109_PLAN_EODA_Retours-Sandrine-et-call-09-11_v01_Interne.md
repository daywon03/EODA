# Plan — retours de Sandrine (mails #1 à #6, 08-09/11/2026) et call du 09/11/2026

> Sources : six mails « Agenda pour point de demain / de ce jour » (08/11 20h16 → 09/11 18h01,
> 25 captures) et la transcription du call du 09/11 (18h, Granola). Code relu le 09/11.
> Fil conducteur demandé par Damon : **la plateforme doit être simple à comprendre, facile à
> utiliser, et on doit comprendre ce qu'on fait.** Sandrine, au call : « il faut que je puisse
> faire la même chose depuis plusieurs menus » ; « il manque des poubelles » ; « je me perds ».
>
> Règles qui ne bougent pas : `CLAUDE.md` (dont le tableau « contrat mécanique » §0), `DESIGN.md`,
> `PRODUCT.md`, conventions `engineering-conventions` (S1-S10, D7 : un bug commence par un test
> qui échoue). Hors périmètre de ce plan : les actions humaines (prospection, grilles Synaé, KPI
> de mise en pratique, rendez-vous France Travail).

## 0. Diagnostic en une phrase par sujet

| # | Ce que Sandrine a vu | Cause dans le code (relu le 09/11) | Nature |
|---|---|---|---|
| 1 | « Je ne peux pas rattacher le FAMO au critère 2.8.2 depuis le document » | Aucun sélecteur de critères n'a jamais existé dans la fiche document : les seuls contrôles de critères sont dans `DocumentAnalysisPanel` (replié, et seulement si une analyse existe). Rattacher à la main n'existe que sur `/dashboard/cabinet/criteres` (`ManualMatrixLink`) | manque |
| 2 | « Je ne peux pas détacher un critère » | `removeManualMatrixLink` existe mais **refuse** un rattachement proposé (`manualUnlinkError`, `criterion-matrix-service.ts:303`) et n'est que sur la page Matrice | manque + règle trop dure |
| 3 | « Il manque des poubelles » (document, ligne, critère) | Aucune action « supprimer un type de document » ; seules les versions se suppriment | manque |
| 4 | « (Objectif 3.13) » dans les titres | Intitulés saisis avec le libellé d'objectif | données |
| 5 | « Pas déposé(e) » alors que je viens de l'ajouter / absent du dossier | Fichier déposé sur une **autre ligne** que celle rattachée au critère (doublons de lignes) ; « N autres dans Validé » **déjà corrigé** par `ad9c6bd` | données + UX |
| 6 | « Que génère "! À corriger" ? » | statut `INCOMPLETE` **posé par l'IA** affiché comme un jugement (`structure-documents-service.ts:123`, `document-status-service.ts:7-10`) — contraire à « jamais un statut posé par l'IA » | règle enfreinte |
| 7 | « Pourquoi 3 structures prévenues ? » | `announceToStructures` écrit à toutes les structures actives du cabinet (`document-type-creation.ts:162-204`) : **7 e-mails réellement partis** vers d'autres comptes | défaut |
| 8 | « Critère inconnu du référentiel : 2.4.1 » | 2.4.1 est **hors périmètre SAD** (champ « Établissement »), absent de la base Synaé SAD ; le message dit « inconnu » — `document-type-creation.ts:97-106`, `criterion-matrix.ts:299`, `document-type-import-service.ts:132` | message faux |
| 9 | 22 fiches validées : 20 visibles côté client, **2 rangées en « Ressources humaines »** | rangement par code (`content/documents/groupes.ts`) d'une ligne `EODA_…` | bogue |
| 10 | « Mise en conformité 100 % » alors que global 71 % | `computeMissionProgress` compte des **cases cochées**, pas des preuves (`mission-progress-service.ts:104-130`) | calcul faux pour le métier |
| 11 | Le diagnostic n'est relié ni à l'auto-évaluation ni au rapport Word du 08/04 | « Mon diagnostic » se dérive des seuls critères & preuves ; pas de filtre par offre | manque |
| 12 | Stats incohérentes (captures 13 à 17) | cartes = impératifs, liste = tout le périmètre : **déjà nommé** par `ad9c6bd` ; la carte « Documents du portail client » n'explique pas ses 4 compteurs | UX |
| 13 | La structure voit « éléments attendus non retrouvés » | garanti côté client depuis `ad9c6bd` (`analysis-view-service.ts:113-121`) — **à revérifier à l'écran** | vérif |
| 19 | « Ajouter un document à ce critère » | ne sait que **créer** une ligne (`criteres/page.tsx:172-178`), jamais choisir une existante | manque |
| 20 | Page « Rapport de diagnostic » : que faire d'ici ? | page d'impression sans navigation (`app/imprimer/diagnostic/[id]`) | UX |
| 14 | Côté client, « Mes documents » : « 13 acceptés, 1 déposé, 76 à déposer, 19 à produire, reçu en cours — je comprends rien » | Deux rangées de bulles (5 états + 8 rubriques) + recherche + tri = 15 commandes avant le premier document ; « Accepté » / « Accepté par vous », « À produire » non expliqué | refonte |
| 15 | Mise en conformité : date et version non mises à jour, couleurs du client perdues, critères HAS dans le corps du document | règle « l'IA ne touche jamais une version ni une date » ; aucune charte par client | évolution |
| 16 | Champ manquant (« coordonnées du DAC 93 ») à faire remplir par la structure | aucun geste « demander à la structure » depuis l'analyse | manque |
| 17 | Le tampon de la structure accessible à tous | `DEPARTEMENT_TAMPON` est une ligne de document ordinaire | sécurité / juridique |
| 18 | Panneau de droite trop chargé, « Mettre en conformité » invisible | 9 sections empilées (`DocumentSheetBody.tsx`) | refonte |

## 1. Lots, ordre et agents

Chaque lot = **un agent, un worktree, une branche, une PR vers `develop`**. Les fichiers
touchés par deux lots sont listés pour éviter les conflits ; l'intégrateur (session principale)
fusionne dans l'ordre 0 → A → B → C → D.

### Lot 0 — Bogues signalés (agent « chasseur de bogues », TDD strict) — vague 1

- 0.1 Message « critère inconnu » (#8) : distinguer « hors périmètre SAD » (code du manuel absent
  de la base Synaé) de « inconnu » ; une seule fonction de message pour création, import et matrice.
- 0.2 Fiches validées absentes du portail client + 2 fiches en « Ressources humaines » (#9) :
  tracer `getClientChecklist` → `client-documents-view-service` → `groupes.ts`
  (rangement par **code** : un type `EODA_…` créé par le cabinet tombe-t-il dans le mauvais
  groupe ?). Test rouge, correction.
- 0.3 Carte « Documents du portail client » (#12) : une ligne d'explication par compteur.
- 0.6 « À corriger » (#6) n'est plus un statut de l'IA présenté comme un jugement :
  « Analyse : éléments à vérifier » (ton `review`), et l'écran dit d'où il vient.
- 0.4 « 3 structures prévenues » (#7) : la case « prévenir les structures » est **décochée par
  défaut** et, cochée, **nomme** les structures qui recevront l'annonce avant l'envoi.
- 0.5 Titres « (Objectif 3.13) » (#4) : script **idempotent, en essai à blanc par défaut**,
  qui propose le nouveau titre pour chaque ligne et n'écrit qu'avec `--apply` (journal
  `DOCUMENT_TYPE_RENAMED`). Base partagée avec la production : **Damon lance `--apply`**.

Fichiers : services de documents, `groupes.ts`, actions `document-type-creation`, un script
sous `packages/database/scripts/`. **Ne touche pas** `DocumentSheetBody.tsx` ni la page client.

### Lot A — Fiche document du cabinet : critères, poubelles, panneau lisible — vague 1

- A1 **Composant unique `CriterionLinker`** : liste des critères rattachés au type (matrice +
  rattachements à la main), recherche par code **ou** par libellé, case à cocher pour
  rattacher, croix pour détacher. Plus jamais de code à recopier.
  Monté au **même endroit dans trois écrans** : fiche document (section « Critères HAS »
  toujours visible, hors du panneau d'analyse), page Matrice, page Critères d'une structure
  (« Ajouter / retirer un document de ce critère »).
- A2 **Détacher partout**, y compris un rattachement proposé : détacher un critère proposé =
  le **refuser** sur la carte du type (même fait que `planMatrixDecision`), dans une seule
  action serveur. `manualUnlinkError` ne refuse plus que ce qui n'existe pas.
  CABINET_ADMIN, journalisé, tests de refus (non connecté, consultante, autre tenant).
- A3 **Poubelles** : « Retirer cette ligne » sur un type créé par le cabinet (`EODA_…`).
  Sans version déposée : suppression. Avec versions : **archivage** (ligne masquée,
  historique gardé — jamais de suppression d'une pièce, règle `canDeleteVersion`). Loi 2002-2
  et lignes du référentiel : refusé. Confirmation par `ConfirmActionButton`.
- A4 **Panneau de droite en trois onglets** : « Le document » (versions, voir, déposer,
  valider), « Critères HAS » (A1), « Analyse » (résultats, commentaire, **bouton « Mettre en
  conformité » en évidence**). Rien n'est supprimé, tout est rangé.
- A5 « À corriger » expliqué : une ligne sous la pastille « L'analyse a trouvé des éléments
  manquants : ouvrez l'onglet Analyse ».
- A6 Après un ajout ou un changement d'étape, l'écran **dit où est parti le document**
  (« Rangé dans Validé — voir ») ; un dossier affiche **tous** ses documents avec leur
  pastille d'étape, pas seulement ceux de l'onglet ouvert.
- A7 « Demander à la structure » (#16) depuis un élément manquant de l'analyse : crée une
  tâche `ActionItem` confiée à la structure (source DOCUMENT) + message dans le fil + e-mail
  (`notifyStructureActivity` inverse existant : `notifyDocumentAvailable`-like). Le texte
  envoyé est saisi/relu par la consultante, jamais l'analyse brute.

Fichiers : `components/structure/DocumentSheetBody.tsx`, `components/checklist/*`,
`components/criteres/*`, `lib/actions/criterion-matrix.ts`, `criterion-matrix-service.ts`,
pages `cabinet/criteres` et `etablissements/[id]/criteres`.

### Lot B — « Mes documents » côté client, refonte (agent « design client », impeccable) — vague 1

Constat (#14) : 15 commandes avant le premier document, deux rangées de bulles, vocabulaire des
filtres différent de celui des pastilles.

- B1 **Trois onglets à la place des cinq bulles d'état**, grands (48 px), pictogramme + mot +
  nombre, l'état vit dans l'URL (`?vue=`) :
  « **À faire par vous** » (à déposer, à renouveler, à accepter / à vérifier) — onglet par
  défaut ; « **EODA s'en occupe** » (à produire par EODA, reçu en cours) ; « **C'est fait** »
  (acceptés, non concernés). Chaque onglet dit en une phrase ce qu'il contient.
- B2 **Les rubriques ne sont plus des bulles** : elles restent les titres de section ; un
  sommaire « Aller à » (liens d'ancre, sans JavaScript) en tête sur grand écran, un
  `<select>` dans un formulaire GET sur petit écran.
- B3 Recherche gardée ; tri A→Z retiré (l'ordre alphabétique dans chaque rubrique est le
  défaut).
- B4 Chaque carte : **une** action principale selon l'état (Déposer / Accepter / Voir).
- B5 Phrase d'en-tête qui répond à « que dois-je faire ? » : « Vous avez 3 documents à
  déposer et 21 à accepter. EODA prépare 19 documents. »
- B6 Vocabulaire aligné sur `status-vocabulary.ts` (« Accepté par vous » partout), FALC,
  ≥ 18 px, cibles ≥ 48 px, jamais la couleur seule.

Fichiers : `app/dashboard/client/documents/page.tsx`, `components/client/documents/*`,
`lib/services/client-documents-view-service.ts` (+ tests). Ne touche pas les composants cabinet.

### Lot C — Mission et diagnostic qui disent la vérité — vague 2

- C1 « Mise en conformité » = part des **documents attendus prouvés** (`isDocumentProven`)
  sur le périmètre de l'offre, plus les cases cochées. L'explication à l'écran dit le calcul
  avec les nombres réels (« 41 documents prouvés sur 76 »).
- C2 Les étapes de la frise sont **cliquables** : Diagnostic → auto-évaluation + rapport de
  diagnostic déposé ; Mise en conformité → Documents ; Suivi → Tâches ; Préparation finale →
  checklist de la phase.
- C3 « Rapport de diagnostic » filtré **par offre** : Essentiel = les impératifs seulement ;
  Performance et Excellence = tous les critères du périmètre ; titre qui nomme l'offre ;
  Prouvé / En partie / Sans preuve pour chaque critère ; la phrase « Aucun critère impératif
  n'est sans preuve » est retirée.

### Lot D — Tampon de la structure en accès restreint (#17) — vague 2, revue sécurité obligatoire

Une pièce marquée « accès restreint » n'est servie qu'aux comptes nommés de la structure (par
défaut : sa direction) et à la tablette pour l'usage prévu ; le cabinet voit la ligne, pas le
fichier. Garde dans `guards.ts`, test « chaque point d'entrée gardé » à jour, journalisé.

### Lot E — Mise en conformité fidèle au document (#15) — vague 3, à préciser avant de coder

- E1 Charte par client (couleurs + logo déjà présent) stockée sur la fiche, appliquée à l'export
  Word de la mise en conformité.
- E2 « Page de garde EODA » détachable : les critères couverts et leurs objectifs sur une page
  séparée, **retirés du corps** du document livré.
- E3 Version et date : à l'enregistrement de la version N+1, **la plateforme** (jamais l'IA)
  écrit la version incrémentée et la date du jour dans l'en-tête — la règle
  « l'IA ne touche jamais une version ni une date » reste vraie et testée.
- E4 Règle de gabarit (version, date, emplacement d'archivage, prochaine révision) ajoutée au
  cahier de style `content/regles-redaction/` en **provisoire, à valider par Sandrine**.

### Lot F — Assistant dans la fiche document — après A, spécification seulement

Remplacer la partie « Analyse » du panneau par un fil de discussion avec le modèle (même port
`getLLMAnalysisPort`, même garde d'écriture, mémoire = commentaires « pris en compte par l'IA »).
Doctrine IA inchangée : proposition, jamais verdict.

## 2. Équipe d'agents

| Agent | Rôle | Lot | Outils / skills | Livrable |
|---|---|---|---|---|
| Chasseur de bogues | reproduit, test rouge, corrige | 0 | tdd-workflow, click-path-audit, prisma-patterns | PR + liste cause → correctif |
| Fiche document cabinet | composant critères, poubelles, panneau à onglets | A | tdd-workflow, impeccable (craft-floor), react-review | PR |
| Design client | refonte « Mes documents » | B | impeccable, ui-ux-pro-max, tdd-workflow | PR + captures |
| Relecteur | relit chaque PR (sécurité, règles CLAUDE.md, a11y) | tous | code-reviewer, security-reviewer, a11y-architect | commentaires bloquants / non bloquants |
| QA navigateur | parcours réels à l'écran, clair + sombre, 375 / 1280 px | tous | Chrome (Puppeteer ou extension) | captures + verdict |

## 3. Définition de « fini » pour chaque lot

`pnpm typecheck`, `pnpm lint`, `pnpm test` (seuils de couverture) verts ; un test qui échouait
avant chaque correctif de bogue ; aucune migration écrite sans le test `migration-table-names`
vert ; `DESIGN.md` / `CLAUDE.md` mis à jour si une règle change (et la ligne du tableau §0 qui
la vérifie) ; parcours vérifié à l'écran.

## 4. Décisions prises par défaut (à confirmer par Damon, le code suit ces choix)

1. Retirer une ligne avec versions = **archiver**, jamais supprimer (A3).
2. Détacher un critère proposé = le refuser sur la carte du type (A2).
3. Annonce d'une nouvelle ligne : **décochée** par défaut (0.4).
4. Version et date écrites par la plateforme, pas par l'IA (E3).
5. Le renommage en masse des titres ne s'applique en base que sur ta commande (`--apply`).

## 5. État au 10/11/2026 et reste à faire (call relu le 10/11)

Fusionné dans `develop` (PR #65, #68) : lots 0, A, B, C, D, E — critères cochables depuis trois
menus, poubelles, onglets du panneau, « Demander à la structure », « Mes documents » refait,
avancement par les preuves, diagnostic par offre, tampon en accès restreint (et contenu dérivé
fermé), dépôt confirmé et annulable, version et date par la plateforme, page de garde EODA,
charte couleur de la structure.

Fait le 10/11 (cette PR) :
- « Mettre en conformité » est un vrai bouton plein dans la rangée d'actions de la version
  (`CorrectedDraftPanel`), « Document corrigé » un bouton à contour — Sandrine ne l'avait
  jamais vu sous le document (call du 09/11).
- Page Critères d'une structure : « Rattacher un document existant » (bouton plein) et
  « Créer un nouveau document pour ce critère » (bouton à contour) ne sont plus des textes.
- A6 : le récapitulatif de dépôt du cabinet nomme l'onglet d'arrivée (« Vous le retrouverez
  dans l'onglet « À relire » / « Validé » »), libellés lus dans `DOCUMENT_BUCKET_LABELS`.

### Reste à faire — code

| # | Sujet | État | Prochaine étape |
|---|---|---|---|
| R1 | **Assistant dans la fiche document (lot F)** | spécification seulement (`20261110_SPEC_…Assistant-fiche-document`) | trois décisions de Damon (§5 de la spec : plafond de coût, autonomie, conservation du fil), puis F1 « Expliquer ce point » — sans table ni mémoire |
| R2 | Refus d'un critère proposé non mémorisé | « Charger toute la proposition » rajoute un critère refusé (⚠️ CLAUDE.md §7) | table ou colonne de refus, lue par `planMatrixDecision` ; test rouge d'abord |
| R3 | Recette à l'écran de tous les lots | non faite (plan §2, « QA navigateur ») | parcours cabinet et structure, 375 / 1280 px, clair et sombre ; dont #13 : la structure accompagnée ne voit aucune analyse |
| R4 | Diagnostic rapide vendable aux SAD qui ont une évaluation proche (« 0/16 ») | le diagnostic déclaratif du libre-service existe (`/espace`) ; aucune offre « diagnostic seul » au catalogue | dépend des prix (lot D SaaS) : ne pas inventer de montant |
| R5 | Preuve de mise en pratique (KPI) | quiz et enquêtes existent ; visite d'observation terrain non modélisée | attendre le retour sur la faisabilité avant de concevoir |

### Reste à faire — commandes à lancer par Damon (base partagée avec la production)

- `pnpm --filter @eoda/database labels:strip-objectives` avec `--apply` (titres « (Objectif 3.13) »).
- `pnpm --filter @eoda/database documents:purge-restricted-content` avec `--apply`.
- Relire l'essai à blanc de chacun avant.
