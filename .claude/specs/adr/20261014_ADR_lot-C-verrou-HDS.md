# ADR 20261014 — Lot C : construire le terrain, verrouiller les données de santé

- **Statut** : accepté (Damon, décision HDS du 08/10/2026 — `context/09-vision-produit.md` §8, option b)
- **Date** : 14/10/2026
- **Portée** : personnes accompagnées, feuille de réception signée sur tablette, journal du
  dossier, réponses d'enquête de satisfaction nominatives, fichiers signés.

## Contexte

Le lot C (terrain) est demandé : enquête de satisfaction avant l'évaluation de janvier,
feuille de réception signée sur tablette, dossier de la personne. Ces données révèlent la
dépendance d'une personne (GIR, heures d'aide, DIPC, PAP) : ce sont **en pratique des données
de santé** recueillies lors d'un suivi médico-social (CSP L1111-8, référentiel CNIL
médico-social). Elles exigent un hébergeur **certifié HDS** et une AIPD.

L'infrastructure actuelle — Supabase (`eu-west-1`) et Vercel (`cdg1`) — n'est **pas**
certifiée HDS. La base est **partagée** entre la production, les prévisualisations et les
postes de développement : une seule écriture « de test » nominative y serait déjà une
donnée de santé hébergée illégalement.

Décision du 08/10 : le backend migrera vers un hébergeur certifié HDS ; le lot C **se
construit** dès maintenant, mais **rien de nominatif** ne s'écrit avant la migration.

## Décision

1. **Un port, deux adaptateurs.** Toute lecture/écriture des tables usager passe par
   `BeneficiaryDataPort` (`apps/web/src/lib/hds/beneficiary-data-port.ts`) :
   - `LockedBeneficiaryDataAdapter` — **par défaut** : toute écriture lève
     `HdsNotAvailableError`, toute lecture rend vide ; n'importe pas Prisma ;
   - `PrismaBeneficiaryDataAdapter` — réel, **non sélectionnable** tant que le verrou est
     fermé (`lib/hds/index.ts`, `resolveHdsBackendState`).
2. **Le verrou ne s'ouvre qu'à deux conditions cumulatives** : `HDS_BACKEND_ENABLED` vaut
   exactement `"true"` (lu dans `lib/config/env.ts` seulement ; toute autre valeur est une
   erreur de configuration) **et** `hdsConfigProblems(env)` est vide : `HDS_PROVIDER`
   déclaré, stockage `HDS_S3_*` complet et distinct du bucket `eoda-documents`.
3. **Le profil de production refuse de démarrer** sur `HDS_BACKEND_ENABLED=true`
   incomplet (`production-profile.ts`). En développement, la même incohérence garde le
   verrou fermé.
4. **Les fichiers signés** (PDF rendu, image PNG de la signature) passent par
   `getHdsFileStoragePort()`, distinct de `getFileStoragePort()`, verrouillé de même —
   lecture comprise.
5. **Les écrans se construisent** et disent la vérité : chaque écran d'écriture affiche
   « Cette fonction stocke des données de santé : elle s'ouvrira quand l'hébergement
   certifié HDS sera en place ». Le parcours se montre en **mode démonstration**, qui
   tourne entièrement en mémoire du navigateur sur des données fictives et n'appelle
   jamais le port (« Démonstration — rien n'est enregistré »).
6. **Ce qui n'est pas usager reste sur l'infrastructure actuelle** : appareils
   enregistrés (`DeviceEnrollment`) et codes des salariés (`StaffPin`) — données de
   salariés, pas de santé. Les statistiques d'enquête ne sont jamais nominatives.
7. **Signature** : une feuille de réception unique (livret, règlement, DIPC présentés ;
   DIPC signé en option), une seule signature dessinée, **image finale seulement** —
   jamais le tracé ni sa dynamique (risque de donnée biométrique). Dossier de preuve :
   empreinte SHA-256 du document rendu, horodatage, signataire et rôle (personne,
   représentant légal, service), intervenant témoin, appareil enregistré, points « à
   dire » cochés et horodatés. `SignatureEvidence` et le journal sont append-only.
8. **Le cabinet ne lit que des chiffres** (décision de Damon, 14/10/2026 — minimisation
   RGPD/HDS). L'onglet cabinet « Personnes accompagnées » affiche des agrégats : nombre
   de personnes en cours, feuilles de réception à jour / à remettre ou à renouveler,
   enquêtes faites, échéances par nature. La structure (direction, responsable qualité)
   garde la liste nominative. Appliqué côté serveur : `getPeopleBoard` (nominatif)
   répond `notFound()` à un compte cabinet ; le cabinet passe par `getPeopleAggregates`
   et `getSurveyBoard`, qui lisent `listBeneficiaryTimelines` — requête qui ne
   sélectionne qu'un identifiant opaque et deux dates. Le calcul est un service pur
   (`beneficiary-aggregate-service.ts`) qui ne reçoit aucun nom.
   **Complément du 14/10/2026 (décision de Damon) : pas de commentaires libres côté
   cabinet.** L'onglet cabinet « Enquêtes » n'affiche ni les idées (verbatims) ni les
   propositions sur le règlement : un texte libre peut contenir un nom (la personne, un
   proche, un intervenant), et l'agrégation ne le neutralise pas. Retrait côté serveur
   dans `getSurveyBoard` (`withoutFreeTexts`, `survey-stats-service.ts`) pour tout
   appelant qui n'est pas la structure ; l'écran dit que les commentaires restent chez
   la structure (`freeTextsWithheld`). La structure garde ses commentaires. L'export CSV
   agrégé n'en contenait déjà aucun.

## Contrôles mécaniques (Règle zéro)

| Contrôle | Où |
|---|---|
| Aucune ligne hors de l'adaptateur Prisma ne touche une table usager (délégué Prisma ou SQL brut) | `apps/web/src/lib/hds/beneficiary-tables-guard.test.ts` |
| Configuration par défaut : chaque écriture du port et du stockage HDS rejette, chaque lecture est vide | `apps/web/src/lib/hds/hds-lock.test.ts` |
| Chaque action serveur d'écriture usager répond l'état verrouillé, sans écrire | `apps/web/src/lib/actions/beneficiary-actions-locked.test.ts` |
| Le profil de production refuse `HDS_BACKEND_ENABLED=true` sans hébergeur ni stockage distinct | `apps/web/src/lib/config/production-profile.test.ts` |
| Un compte cabinet n'atteint jamais la lecture nominative : `getPeopleBoard` refuse avant toute lecture, agrégats et statistiques n'appellent pas `listBeneficiaries` ; le tableau d'enquête du cabinet ne contient aucun commentaire libre | `apps/web/src/lib/actions/terrain-read.test.ts`, `apps/web/src/lib/services/beneficiary-aggregate-service.test.ts` |

## Ce qu'il faut pour ouvrir le verrou

1. **Fournisseur certifié HDS** choisi (OVHcloud, Scaleway, 3DS Outscale… — certification
   revérifiée au registre ANS le jour du choix), hébergeant **tout** le backend (base,
   application, stockage objet), en UE.
2. **AIPD** rédigée (référentiel CNIL médico-social), registre des traitements à jour,
   information des personnes (mention RGPD de l'enquête, durée de conservation : nom effacé
   au bout d'un an pour l'enquête).
3. **Contrat** d'hébergement HDS signé ; avenant aux conditions des structures clientes
   (EODA sous-traitant au sens RGPD).
4. **Migration des données** existantes vers l'hébergeur, avec bascule DNS et
   vérification qu'aucune copie ne reste chez Supabase/Vercel (sauvegardes comprises).
5. **Revue juridique** de la feuille de réception et du dossier de preuve (§8 du doc 09).
6. **Tests** : rejouer la suite avec `HDS_BACKEND_ENABLED=true` sur l'environnement HDS,
   tester l'adaptateur Prisma contre une base jetable de cet environnement, puis seulement
   poser les variables en production.
7. Mettre à jour cette ADR (statut « levée »), `CLAUDE.md` §6 et le tableau §0.

## Alternatives écartées

- **Ne rien construire avant la migration** : repousse l'enquête de janvier, qui est
  demandée maintenant ; les services purs (statistiques, dossier de preuve) et les écrans
  n'ont pas besoin de données réelles pour être faits et testés.
- **Masquer les boutons** : un bouton masqué ne ferme aucune route ; le verrou est dans la
  couche de persistance, testée.
- **Stocker sans le nom** (pseudonymisation) : un GIR, une adresse et un nombre d'heures
  suffisent à réidentifier une personne dans un SAD de 50 bénéficiaires — c'est toujours
  une donnée de santé.
- **Écrire dans l'ERP du client** (option c du doc 09) : reste ouverte pour plus tard,
  le port permettra un adaptateur ERP sans toucher au métier.

## Complément du 22/10/2026 — liste des personnes à enquêter, sur la tablette seulement

**Demande** (Damon) : version officielle de l'enquête, avec import de la liste des
personnes (ou au moins nom + prénom) pour savoir qui a répondu, export vers Ximi, et un
parcours qu'« un enfant » peut faire passer.

**Décision** (Damon, option « liste sur la tablette ») : la liste nom + prénom vit
**uniquement dans le navigateur de la tablette** de la structure — comme sa feuille
d'émargement papier —, jamais sur l'infrastructure EODA. Les réponses partent par la
voie anonyme existante, sans nom ni identifiant de la liste ; la tablette ne garde que
le jour où chaque questionnaire a été fait, jamais les réponses. L'import (Excel lu dans
le navigateur, CSV, copier-coller) et l'export CSV pour Ximi se font dans le navigateur.

**Pourquoi ce n'est pas une levée du verrou** : aucune donnée nominative n'est hébergée
par EODA ; le point 1 (« un port, deux adaptateurs ») ne bouge pas. L'enquête cesse
d'être anonyme pour l'intervenant présent ; elle reste confidentielle — personne ne peut
relier un nom à des réponses.

**Contrôle** : `lib/hds/survey-roster-boundary.test.ts` échoue si un module serveur
importe la liste ou le lecteur Excel.

**Écarté** : enregistrer la liste par le port HDS (inutilisable avant la migration) ;
la stocker sur Supabase « juste les noms » (c'est la donnée interdite).

**Limites assumées** : liste propre à chaque tablette ; perdue si les données du
navigateur sont effacées (réimport) ; format d'import Ximi à confirmer sur un exemple.
