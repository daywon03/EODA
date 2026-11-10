# ADR 20261110 — Documents à accès restreint (le tampon de la structure)

- **Statut** : proposé (call du 09/11/2026, Lot D du plan
  `20261109_PLAN_EODA_Retours-Sandrine-et-call-09-11_v01_Interne.md`). À confirmer par Damon
  et Sandrine.
- **Date** : 10/11/2026
- **Portée** : toute porte qui sert les octets ou le texte d'une version de document
  (`DocumentVersion`), l'analyse IA, la tablette, l'interface cabinet et portail.

## Contexte

Le tampon de la structure (ligne `DEPARTEMENT_TAMPON`) est déposé pour que la tablette le
pose dans la case « SAD » du formulaire du Département. Jusqu'ici, il s'ouvrait comme
n'importe quel document : tout le cabinet, et chaque rôle de la structure qui lit les
documents (direction, responsable qualité, administratif). Sandrine : « C'est comme si
quelqu'un avait accès à la signature EODA pour signer des chèques. […] que même nous on n'y
ait pas accès […], le donner accès qu'à [la direction de la structure]. » Le portail sert
aussi de preuve devant l'évaluateur : il ne doit rien montrer d'inexplicable.

## Décision

1. **La liste des types restreints est une CONFIGURATION versionnée**,
   `apps/web/src/content/documents/acces-restreint.ts` (`RESTRICTED_DOCUMENT_TYPE_CODES =
   ["DEPARTEMENT_TAMPON"]`), et non une colonne : aucune migration, et la décision se lit dans
   le dépôt (revue de code, historique). `acces-restreint.test.ts` échoue si un code listé
   n'est pas un type du référentiel (`DOCUMENT_TYPE_SEEDS`).
2. **Une règle pure, une seule** : `canOpenDocumentFile(opener, facts)`
   (`lib/auth/document-file-access.ts`), testée case par case (4 rôles cabinet × 4 rôles
   client × tablette × restreint / non restreint). `opener` se dérive du contexte rendu par la
   garde (`tryEstablishmentAccess`) — l'établissement est déjà vérifié par `guards.ts`, la
   règle ne décide que du FICHIER :

   | Qui | Document ordinaire | Document restreint |
   |---|---|---|
   | Cabinet (tous rôles, administration comprise) | oui (garde existante) | **non** — voit la ligne et son état, jamais le contenu |
   | Structure — `DIRECTION`, lien actif | oui, sauf brouillon d'EODA non validé | **oui**, toutes les versions (dépôt d'EODA compris : c'est un dépôt pour son compte) |
   | Structure — responsable qualité, administratif, intervenant | oui, sauf brouillon d'EODA non validé | **non** |
   | Tablette enregistrée de la structure | — | **oui**, la dernière version, pour la pose du tampon |

   Le nom est `canOpenDocumentFile` plutôt que `canOpenRestrictedDocument` : la fonction
   répond pour TOUT document (elle absorbe la règle de restitution
   `isVersionVisibleToClient`), ce qui retire la règle recopiée dans trois portes.
3. **Portes couvertes** (refus = `notFound()` / `null`, jamais un message qui confirmerait
   l'existence) : `getAuthorizedDocumentVersion` (et donc `getDocumentDownloadUrl`,
   `getDocumentPreviewData`, `getExtractedText`), `/api/documents/[versionId]/pdf` (y compris
   `?prepare=1` : aucun rendu préparé), `/original`, `/draft-docx`,
   `/api/local-storage/[...key]` (développement), la file « À relire » (exclue, entrée
   introuvable), la mise en conformité (`openCorrectionContext`, donc ses exports
   `/api/documents/proposals/...`), la réanalyse et le laboratoire (`readAnalysisTarget`).
4. **Aucune IA** : `ingestDocumentVersion` n'enregistre ni texte extrait ni image et n'appelle
   pas le modèle pour un type restreint ; `uploadDocument` n'extrait pas le texte quand le
   type est connu et restreint, et la détection automatique de type ne propose jamais un type
   restreint (il se choisit). `checklist.ts` ne restitue ni analyse ni suggestion d'une ligne
   restreinte, même ancienne.
5. **Dépôt** : la direction de la structure dépose ; le cabinet peut déposer pour elle (Damon
   détient le scan) mais ne peut plus le relire — l'écran le dit avant l'envoi. Les autres
   rôles de la structure ne déposent pas sur une ligne restreinte. Le dépôt du cabinet ne
   vaut jamais validation (« version finale d'EODA » ignorée), et `setDocumentValidated`
   refuse un type restreint : valider supposerait de regarder.
6. **Tablette** : `selectTabletStructureDocuments` prend, pour un type restreint, la
   **dernière version déposée** sans exiger de validation ; les autres documents de la
   tablette gardent la règle `pickValidatedVersion`.
7. **Reclassement** : `changeDocumentType` refuse de faire entrer un document dans une ligne
   restreinte ou de l'en sortir (en sortir le rendrait lisible par le cabinet).
8. **Journalisation** : chaque porte journalise déjà l'accès (`DOCUMENT_PREVIEWED` /
   `DOCUMENT_DOWNLOADED`, code du type, sans donnée de personne). Les refus ne sont pas
   journalisés (comme partout : un refus est un `notFound()`).
9. **Interface** : ligne marquée d'un cadenas et de « Accès réservé à la direction de la
   structure », côté cabinet et côté structure pour les rôles qui n'y ont pas droit ; Voir,
   Télécharger, PDF, Analyser, Mettre en conformité absents — et refusés côté serveur.

## Alternatives écartées

- **Colonne `DocumentType.restrictedAccess`** : réglable à l'écran, donc par un compte cabinet
  qui pourrait lever la restriction pour lire le tampon. Une configuration dans le code passe
  par une revue.
- **Liste nominative de comptes autorisés** (« Julien et Tania ») : un nom codé devient faux au
  premier départ ; le rôle `DIRECTION`, posé par la direction elle-même, suit les personnes.
- **Chiffrement côté client** : le serveur doit lire le fichier pour le servir à la tablette ;
  hors de portée sans gestion de clés par appareil.

## Conséquences et limites

- Un administrateur de base de données ou du stockage lit toujours le fichier : la restriction
  est applicative, pas cryptographique.
- Les textes et analyses **déjà** enregistrés pour un tampon avant ce changement restent en
  base, masqués à toutes les portes. Leur purge est une écriture sur la base partagée avec la
  production : **à décider par Damon** (script ou migration de données).
- Le tampon n'est jamais « validé par EODA » : il n'entre pas dans le compteur « Validés par
  EODA » et n'est jamais un livrable.
