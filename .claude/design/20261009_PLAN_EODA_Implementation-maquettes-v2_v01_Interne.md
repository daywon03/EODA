# Plan d'implémentation des maquettes v2 (Claude Design, 09/10/2026)

> Source : paquet de remise `Portail client EODA v2-handoff.zip` (hors dépôt, ignoré) —
> `Portail Cabinet v2`, `Portail Client v2`, `Espace ASSAD Benoit`, `Tablette terrain`
> (+ `Portail Client` v1, remplacé). Les maquettes sont des prototypes HTML : on reproduit le
> rendu, pas leur structure interne. **Elles ne se versionnent pas telles quelles** : deux
> d'entre elles portent le nom du pilote, les prénoms réels de ses salariés et l'e-mail de
> Sandrine. Les 8 captures du 26/09 sont des inspirations (une plateforme de conformité
> anglophone), pas l'application EODA.
>
> Ce plan s'ajoute au bilan (`specs/05-bilan-2026-10.md`) et le remplace pour l'ordre de
> construction des écrans. Il respecte CLAUDE.md : quand une maquette contredit une règle
> écrite, **la règle gagne** et l'écart est listé au §4.

## 1. Ce que montrent les maquettes

| Maquette | Pour qui | Lots |
|---|---|---|
| Portail Cabinet v2 | Sandrine et l'équipe EODA | A (refonte, À relire, critères, PAC), D (commercial, libre-service), rôles cabinet |
| Portail Client v2 | Structure en **autonomie** (Essentiel, Performance) + landing et inscription | A, D |
| Espace ASSAD Benoit | Structure **accompagnée** (Excellence), direction, avec vue cabinet | A, B (équipe, quiz), C (personnes, DIPC, enquêtes), E (rôles client, tâches) |
| Tablette terrain | Intervenant sur tablette | C (enquête d'abord, puis dossier et signature) |

Design system commun : tokens de rôle (`--paper`, `--card`, `--soft`, `--line`, `--ink`,
`--ink2`, `--accent-text`…), clair + sombre, Trebuchet MS, corps 16 px côté cabinet et 18 px
côté client, cibles de 44 à 72 px, focus ambre de 3 px, pastilles glyphe + mot (jamais la
couleur seule), panneau latéral de 480 px, file « À relire » en trois colonnes.

## 2. Ordre de construction

### Socle — à faire d'abord, ne dépend d'aucune décision
| # | Tranche | Taille |
|---|---|---|
| S1 | **Tokens** : noms de rôle de la maquette **en alias** des variables de charte (`globals.css`, canaux RGB pour garder les opacités Tailwind) ; corriger le sombre (`ivoire` ≠ `surface`) ; séparer aplat et texte pour terre / ambre / vert ; rayon de carte 12 px ; échelle typo, minimum 14 px ; focus 3 px sur tout élément focalisable ; `cot-*` inchangés. **Contrôle mécanique** (Règle zéro) : test qui refuse `text-[10px|11px|13px]` — solde la dette d'accessibilité de CLAUDE.md §6 | M |
| S2 | **Primitives** : `StatusPill` (remplace les six badges actuels), `ProgressBar` (ARIA), `TabsWithCount`, `FilterChip`, `DataTable` (vrai `<table>`), `Sheet` et `Modal` (piège à focus, Échap, `aria-labelledby`), `Toast`, `EmptyState`, `Callout`, `KpiCard`, `ScopeCard`, `PhaseTimeline`, `ModeTag` ; boutons ≥ 44 px | L |
| S3 | **Coquille cabinet** : barre latérale repliable (icônes Lucide + libellés), en-tête avec fil d'Ariane, compteur À relire ; Commercial et Équipe réservés à l'admin **par garde serveur** | M |
| S4 | **Coquille client** : navigation Accueil · Mes documents · Mon diagnostic · Mon équipe · Messages, barre du bas sur mobile, menu compte, bandeau de mode | M |

### Refontes d'écrans existants — sans schéma
| # | Tranche | Taille |
|---|---|---|
| R1 | **File À relire** (`/dashboard/cabinet/a-relire`) : toutes structures, garde tenant, gestes existants (`setAnalysisReviewed`, suggestions de critères) ; « relu » et « validé » restent deux faits | M |
| R2 | **Fiche structure** en onglets (routes enfants) : vue d'ensemble, documents + panneau, mission, échanges, réglages | L |
| R3 | **Structures** en tableau trié par urgence ; **Accueil cabinet** (KPI, à surveiller, rendez-vous) | M |
| R4 | **Auto-évaluation** habillée : 1-4, ★, NC, RI (chapitre 1 seulement), couleurs `cot-*`, avertissement NC sur impératif | M |
| R5 | **Commercial** : devis, catalogue, vue d'ensemble — sans « Marquer signé » (la signature passe par `convertDevisToClient`) | M |
| R6 | **Portail client** : accueil, mes documents (dépôt en 3 étapes, avertissement nominatif, caméra), journal par structure | M |

### Fonctionnalités avec schéma
| # | Tranche | Bloqué par | Taille |
|---|---|---|---|
| N1 | **Mode seul / accompagné** (`Mission.supportMode`) → `analysisVisibleTo(audience, mode…)`, service unique des mentions (réserve « non revérifié par un humain… à relire absolument » / « Relu par EODA le… »), garde `correctionScope` dans `generateDocumentDraft` | Q2 | M |
| N2 | **Acceptation client** (D6) : `Document.clientAcceptedAt/ByUserId`, action client ; états « À rédiger · EODA » et « Chez la structure » **dérivés** | — | M |
| N3 | **« Je ne l'ai pas »** : plus de `NOT_APPLICABLE` sur cette réponse ; liste de travail dérivée | — | S |
| N4 | **Critères & preuves** : charger `DocumentTypeCriterion` (`specs/data/`, 207 rattachements) par écran de validation ; seed SAD mixte (13 critères, 3.6.2) ; impératifs prouvés x/16 ou x/17 | validation de Sandrine | L |
| N5 | **Tâches = PAC** : un seul modèle `ActionItem` (responsable, échéance, source, objet lié), « en retard » dérivé | — | M/L |
| N6 | **Mon diagnostic** (client) : Prouvé / En partie / Sans preuve dérivé, 3 priorités, validation en deux gestes, export | N2, N4 | L |
| N7 | **Pratiques** (questions par impératif, contenu versionné) | N6 | M |
| N8 | **Mettre en conformité côte à côte** : prompt à ajouts structurés, décision par ajout, v2 liée, export Word avec réserve | N1, D13 | L |
| N9 | **Rôles** : client (Direction, Responsable qualité, Administratif, Intervenant — capacités dans `guards.ts`) et cabinet (Commercial, Lecture seule, affectation consultante ↔ structures) | Q5 | L |
| N10 | **Équipe et quiz** (lot B) : `StaffMember`, quiz en contenu versionné, tentatives append-only, retest 6 mois dérivé + alerte automatique, QR code | N9 | L |
| N11 | **Libre-service** : landing, inscription → **prospect** (D5), demande « Être accompagné » | Q1, D4 | L |
| N12 | **Devis par abonnement** (engagement, prix mensuel, validité 15/30 j calculée, relance) | D4 | M/L |
| N13 | **Lot C** — port de persistance « données usager » **verrouillé** (refuse toute écriture sur l'infrastructure actuelle, vérifié par un test) ; puis enquête (moteur, stats, actions PAC), tablette, dossier, signature + dossier de preuve | migration HDS | L |

## 3. Questions — chacune avec la réponse par défaut si tu ne tranches pas

1. **Où vit le travail d'une structure inscrite seule, avant toute signature ?** D5 en fait un
   prospect, mais documents et diagnostic sont rattachés à une fiche structure.
   *Défaut* : une souscription en ligne **signée** crée la fiche, comme un devis signé ; avant,
   le prospect n'a qu'un compte et son diagnostic.
2. **Paliers** : la maquette fait d'Excellence une offre forcément accompagnée et n'a plus de
   « Pilotage seul ». *Défaut* : on suit la maquette — Essentiel et Performance seuls,
   Excellence accompagnée ; l'accompagnement reste achetable en option sur les deux premiers.
3. **Phases de mission** : Diagnostic / Mise en conformité / Suivi / Préparation finale
   (maquette) au lieu de Fondations / Déploiement / Consolidation / Préparation finale.
   *Défaut* : on adopte celles de la maquette.
4. **Cotation** : la maquette cote par critère ; la HAS et Synaé cotent par élément
   d'évaluation. *Défaut* : on garde l'élément d'évaluation (export Synaé), affiché regroupé
   par critère.
5. **Rôles cabinet** « Commercial » et « Lecture seule » : le commercial est aujourd'hui
   réservé à l'admin. *Défaut* : on les crée, le Commercial voit le pipeline mais pas
   l'équipe EODA ; une consultante ne voit pas les montants.
6. **Signature** : DIPC entier signé à deux (Espace ASSAD) ou feuille de réception unique,
   DIPC remis sous 15 jours (Tablette) ? *Défaut* : feuille de réception unique (choix de
   Sandrine, mode opératoire), DIPC signé en option.
7. **Intervenants sur tablette** : compte avec e-mail, ou fiche salarié + code sur appareil
   enregistré ? *Défaut* : fiche salarié + appareil enregistré + code, avec blocage après
   5 échecs — jamais un code seul.
8. **Quiz** : QR code ou lien SMS ? *Défaut* : QR code d'abord (pas de fournisseur SMS) ;
   SMS plus tard.
9. **DIPC ou DIPEC** ? *Défaut* : **DIPC** (glossaire, checklist, sigle du CASF).
10. **Thème sombre** : la maquette assombrit les aplats, le code les éclaircit.
    *Défaut* : la maquette (aplat fixe, texte éclairci), contrastes remesurés.
11. **Prix sur la landing publique** : *défaut* « à partir de xx € » tant que D4 n'est pas
    tranché.
12. **Fournisseur HDS cible** et date de migration : nécessaire avant toute donnée nominative
    en production. Pas de défaut.

## 4. Écarts maquette → règles du dépôt (corrigés à l'implémentation)

- Nom du pilote, prénoms réels, e-mail de Sandrine dans deux maquettes → jamais dans le code.
- « Relu par Sandrine », « Proposé par Sandrine » → « EODA » (D7) ; « Proposé par EODA » sur
  une pré-cotation machine → « Proposé par la plateforme ».
- « C'est bon » / « Validé » avant l'acceptation du client → interdit (D6).
- Réserve d'autonomie incomplète → mention complète partout (CLAUDE.md §7).
- « Marquer signé », « Nouvelle structure » → retirés (une fiche ne naît que de la signature).
- Signature de devis en ligne → pas de route publique sans décision.
- Structures en libre-service listées comme fiches → ce sont des prospects (D5).
- Cotation sans ★ ni RI, NC permis sur impératif, couleurs de statut sur la cotation → corrigés.
- « 141 critères sur le périmètre SAD aide » → dire le bon périmètre (137 Synaé / 157 manuel).
- Statuts de documents stockés → dérivés.
- Journal en texte libre nominatif → rendu depuis `AuditAction`, jamais de donnée personnelle.
- Critères et questionnaires écrits en dur → lus en base / en contenu versionné.
- Contrat DIPC écrit en dur → rendu depuis le gabarit FINALE de la structure.
- Import Excel → pas avec `xlsx` (dette réservée au seed) : CSV.
- Textes en 11-13 px, intertitres en capitales, cibles de 40 px, tableaux sans sémantique,
  modales sans piège à focus → corrigés.
