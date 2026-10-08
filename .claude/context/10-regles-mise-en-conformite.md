# Règles de rédaction et de mise en conformité — ce que Sandrine corrige

> Consolidé le 08/10/2026 à partir des calls du 19/07 au 07/10/2026 (Fathom + Granola,
> transcripts lus en entier). **Ce fichier est le cahier de style de la génération** : il
> alimente les prompts d'analyse et de mise en conformité (`lib/llm/analysis-prompt.ts`,
> `document-generation-service.ts`) et le futur jeu de référence (`09-vision-produit.md` §6.3).
> Il remplace et étend le court paragraphe « Règles de rédaction retenues avec le client
> pilote » de `03-documents-obligatoires.md`.
>
> Ce sont des règles **dites par Sandrine en séance**, pas des textes de loi. Toute citation
> d'article ou de numéro marqué **⚖️ à vérifier** doit être confirmée sur Légifrance avant
> d'entrer dans un prompt : Sandrine l'a dit elle-même — « je n'ai pas confiance en Claude
> et les lois » (15/09).
>
> **Base d'exemples** : les documents finaux validés de l'ASSAD BENOIT (à venir) sont la
> référence de ce qu'un document « fini » doit être. Les règles ci-dessous disent *pourquoi*
> ils sont comme ça ; les exemples disent *à quoi ça ressemble*. Voir §9 pour la façon de
> les brancher.

## 1. Hiérarchie de confiance des sources

1. **Le manuel HAS (juillet 2025) est la « Bible »** (20/09). Les références légales et
   réglementaires d'un critère se lisent dans sa fiche du manuel, jamais dans la mémoire du
   modèle.
2. **Les gabarits EODA** viennent ensuite : ils « prennent dans le document HAS les
   références et construisent les documents par rapport à l'attente HAS », mais « ont plus de
   risque d'avoir des erreurs » (20/09) — le rattachement critère ↔ gabarit déclaré par
   Sandrine se **vérifie** contre le manuel, il ne s'accepte pas aveuglément.
3. **Les documents finaux validés** (ASSAD BENOIT) : la forme attendue d'un livrable.
4. **Le document du client** : la matière à corriger — jamais une source de règle.

Le manuel est écrit **pour les évaluateurs** : il dit ce qu'ils consultent, pas tout ce qu'il
faut produire (« derrière "tout élément de traçabilité", il y a quatre, cinq, six documents
à créer », 20/09). L'IA doit raisonner en **responsable qualité**, pas en évaluateur.

**Rôle donné à l'agent** (20/09) : « adjoint responsable qualité HAS », avec une compétence
de juriste. Sandrine est la responsable qualité ; l'agent prépare, elle décide.

## 2. Méthode — partir du document, pas du critère

- **Document par document** (15/09, 20/09) : « j'ai tel document, il remplit tel critère,
  dis-moi ce qu'il manque dedans, puis mets-le à jour ». Partir du critère produit des
  dizaines de versions concurrentes du même document.
- **Un document couvre plusieurs critères — c'est le cas ordinaire** : « quatre critères,
  deux chapitres… l'IA doit proposer les quatre, jamais s'arrêter » (20/09). Une phrase bien
  écrite peut couvrir 5 à 6 critères (22/09).
- **« Chapitre » = chapitre HAS 1/2/3**, jamais les chapitres du document. Le document est
  vérifié en entier (20/09). Chapitre 1 = la personne (perception, entretiens en miroir —
  non documentaire), chapitre 2 = les professionnels, chapitre 3 = la structure.
- **Applicabilité** : savoir qu'un critère ne s'applique pas à un SAD (ex. 2.2.1, 20/09 ;
  planning d'animation sans hébergement, 03/09). Ne jamais proposer de l'y couvrir.
- **Impératifs vs standards** : l'IA les a confondus (07/09) — « risque de crédibilité ».
  Le caractère impératif vient de la base (grilles Synaé), jamais d'une déduction.
- **Ne pas itérer en boucle** sur le même document : « plus tu lui dis de réitérer, plus il
  fait de la merde » (20/09). Régénérer depuis le gabarit + le document client, pas empiler
  les corrections.
- **Propagation** : modifier un droit de l'usager dans le livret d'accueil impose de
  vérifier le règlement de fonctionnement, le DIPC et le projet de service (22/09). « Tout ce
  à quoi l'usager a droit génère un process interne, une note de service, une communication
  interne, une formation. » Exemple réel : clause CESU supprimée du livret mais restée
  ailleurs.
- **Distinguer obligation et choix** : l'outil avait « déterminé » une politique de remise
  du DIPC à 15 jours alors que c'est un **délai maximum** au choix de la structure (22/09).
  Une sortie dit « obligation légale » ou « choix de la structure », jamais l'un pour l'autre.

## 3. Le « paquet » d'un critère

Un critère ou une procédure se prouve par une **chaîne**, pas par un document (01/09, 20/09,
22/09). Pour chaque procédure, l'IA doit lister les pièces annexes attendues :

| Pièce | Rôle de preuve |
|---|---|
| Procédure (personnes accompagnées / professionnels) | ce qui est prévu |
| Fiche de sensibilisation, affiche | information des équipes |
| Feuille d'émargement | preuve d'information ou de formation |
| Compte rendu de réunion | preuve de diffusion |
| Quiz / QCM de fin de formation | preuve d'assimilation |
| Mention dans le livret d'accueil, le règlement de fonctionnement, le DIPC | information de la personne |
| Mention dans le PAP quand c'est pertinent | application individuelle |

Exemple (20/09) — « accompagnement à l'autonomie », chapitre 2 : former et informer le
professionnel, tracer l'information, informer la personne et recueillir ses souhaits, tracer
dans le PAP, appliquer la procédure avec preuves ≈ 7 documents.

« Si on voit qu'elles racontent des trucs par cœur, ça va être grillé » (07/09) : documents,
discours et pratiques doivent se recouper. La HAS attend aussi une **stratégie face aux
salariés réfractaires** à la formation (22/09).

## 4. Forme d'un document EODA

**Structure d'un gabarit** (20/09, 22/09) :
- Première page : **version et date de mise à jour** à remplir ; passage en **v1.0 à la
  validation officielle**.
- En tête : encart logo + coordonnées, identité juridique, autorisation.
- Sous-titre listant **tous les critères impactés**, puis sous **chaque section** les
  critères correspondants. La structure peut retirer ces références si elle le souhaite.
- **Encadré EODA** « ce document couvre aussi les critères X, Y » (15/09).
- Bloc « Validation et diffusion » / signature en fin de document.
- **Sommaire obligatoire** et **numéros de page en bas à droite** (15/09, 22/09 — « comme je
  lui ai pas dit, il l'a pas fait »).
- Champs à compléter **colorés** de façon distincte (« pour qu'on sache que c'est là qu'il
  faut remplir », 20/09) — `[À compléter : …]`.
- Version **imprimable** : encarts de commentaires retirés, texte justifié, format livret
  (22/09).

**Chaîne de pièces par document** (26/08) : la version d'origine du client ; un **rapport
de conformité** critère par critère (« il manque ça ») ; la version modifiée numérotée
(V2, V3…), toutes les versions conservées ; et un **rapport des changements** remis au
client pour archive — « ce qui a été réclamé, et ce qui a été fait ».

**Marquage des ajouts** (26/08) : ajouts surlignés en vert, avec un encart par ajout
« ajouté car réclamé par le critère HAS X, absent de la version initiale », qui cite la
ligne du manuel. Les encarts sont retirés après validation ; la trace reste dans le rapport
des changements. ⚠️ Le prompt actuel (`analysis-prompt.ts:216`) interdit toute annotation :
à changer quand le format sera tranché (bilan, question 11).

**Logos** (19/07, 26/08) : procédure = logo EODA **et** logo du client ; note de service =
logo du client seul ; sans logo client, la charte EODA s'applique. Pied de page de
paternité (`document-ownership-service.ts`).

**Ce que le livrable garde** (15/09) : tout l'original — images, logos, organigrammes,
schémas, annexes. Un document de 42 pages ne revient pas en 14. Les modifications sont
**surlignées en vert**.

**Références légales et réglementaires** du critère (fiche du manuel) **insérées dans le
document** (20/09).

**Nommage** : convention `AAAAMMJJ_TYPE_CLIENT_OBJET_vXX_Interne|Externe.ext` (CLAUDE.md §6) —
Sandrine reproche à l'IA de ne pas la respecter (20/09).

**Versions** (20/09) : deux numérotations. Interne (Sandrine en est à v9, v25…) ; client —
le client reçoit **v0.1**. On ne montre jamais au client l'historique interne d'un gabarit.

**Libellés** : toujours le **titre** du document tel que Sandrine l'a écrit, jamais son code
de fichier (« DTP3 », « D9 » sont ses raccourcis personnels — 20/09).

## 5. Style

- **Court** : « 2 lignes, 20 lignes, il sera pas lu de toute façon » (22/09).
- **Ne pas répéter** dans le corps ce qui est déjà dans le tableau de suivi (référence,
  version, date). Structure type : référence de l'article de loi, puis « documents listés
  ci-dessous ».
- **Procédures pas à pas**, applicables seul par un intérimaire, avec l'emplacement exact
  des documents (22/09). Chaque procédure a **un nom et un numéro**, et les documents remis la
  citent par sa référence.
- **Vocabulaire HAS** (bientraitance, participation…), pas seulement juridique (15/09).
- **Français correct** : un mot juste avait été remplacé par un faux (15/09).
- **Pas de nominatif inutile** : pas de « Responsable : Mme X » ; seuls le **référent
  qualité** et le **DPO** sont nommés. « Accès et lieu de conservation » → « Accès : à
  l'accueil / au siège social » (22/09).
- **Droits et devoirs** de la personne accompagnée dans tous les documents (22/09).
- **« Sensibiliser », jamais « former »** : EODA n'est pas un organisme de formation (16/08).
- **Jamais « Sandrine va faire »** dans un document ou une interface : « le client dépose,
  EODA formalise » (26/08, 07/10).
- **Co-construction** avec les salariés : exigence HAS, à mentionner dans chaque document
  (ex. document d'évaluation des risques rempli en atelier puis validé — 16/08).
- **Aller droit au but** : répondre à la HAS, à la loi 2002-2, à l'ARS et au département —
  « pas un référentiel de 350 pages » (16/08).
- **Graduer selon la maturité** : chez une structure avancée, l'écart peut se réduire à
  « un paragraphe ici, un mot-clé là » ; ailleurs on crée à partir des normes (16/08).
- **Un formulaire vierge est un gabarit** : il ne se juge pas non conforme ; c'est
  l'exemplaire rempli qui donne le contexte (16/08).
- **FALC** pour ce qui s'adresse aux personnes accompagnées : grand format, schémas
  (CLAUDE.md §6, 22/09).

## 6. Règles de contenu par document

### Livret d'accueil (revu en séance le 22/09 — passé de 6 à 15 pages)
- **Mentions légales** : SIRET, statut, assurance — **le numéro d'assurance suffit, cité
  deux fois** (mentions légales et règlement), pas d'attestation. Correction d'expert à
  intégrer aux contrôles : l'outil exigeait l'attestation.
- **Facturation** : périodicité et mode de règlement **doivent figurer** (le livret du pilote
  ne les donnait pas). Document tarifaire distinct, qui suit les tarifs départementaux.
- **Recouvrement** : impayés poursuivis quel que soit le délai, commissaire de justice
  possible.
- **Liberté d'opinion et de croyance** : phrase explicite.
- **Droit à l'image** : aucune photo, vidéo ou enregistrement sans consentement libre et
  éclairé.
- **RGPD** : nommer le DPO, citer l'analyse d'impact, rappeler le droit d'accès **et**
  d'opposition.
- **Charte des droits et libertés annexée** à quasiment tous les documents remis.
- **Maltraitance** : définition de la bientraitance, toutes les formes de maltraitance ; le
  **3977** est le numéro national ⚖️ à vérifier (le transcript a mal transcrit le numéro) ;
  le **premier geste est toujours interne** (la structure ouvre un dossier, analyse,
  oriente) ; la fiche de signalement multipartenaire ne sert qu'aux cas graves et n'apparaît
  pas comme première étape ; signalement via le DAC, procureur en recours ultime.
- **Médiation** : le dispositif départemental de médiation cité dans la version du pilote
  est retiré partout au profit des canaux de signalement (décision 22/09, propre au pilote —
  ⚖️ à vérifier avant d'en faire une règle générale).
- **Participation** : toute personne accompagnée peut demander à rejoindre le comité.
- **Plaintes et réclamations** : informer du droit et du processus interne.
- **Fiche « À qui s'adresser »** : annexe autonome insérable (livret, livret salarié, DIPC,
  règlement), classée **par situation** (épuisement de l'aidant → répit ; conflit familial →
  structure ; inquiétude de maltraitance / rupture de parcours → fiche interne puis
  signalement), avec astreinte, aides financières, dispositifs départementaux. Couvre 1.11.2.

### DIPC (revu le 22/09)
- **Remise** : délai **maximum** de 15 jours, possible le jour même — choix de la structure.
  Livret, DIPC et PAP remis puis émargement « ils ont tout reçu ». Résumé oral de 2-3
  phrases acceptable.
- **Deux lignes d'auteurs** : (1) professionnel(s) ayant réalisé l'évaluation individuelle
  préalable et participative — **varie selon la personne** ; (2) professionnel(s) ayant
  **élaboré le document** (co-construction direction / professionnels) — **fixe**.
- **Personne de confiance** : coupon détachable dans le DIPC ; livret et règlement y
  renvoient.
- **Arrêté de désignation des personnes qualifiées** joint obligatoirement.
- **Numéros d'urgence** 17, 112, 114 ; médiateur de la consommation.
- **Questions sensibles** (harcèlement, radicalisation, abus financier — le plus courant :
  procurations) : posées sans interrogatoire, reposées chaque année, et reposées à la
  personne seule si la famille était présente.
- **Autorité** : le Conseil départemental, pas l'ARS (pour un SAD aide).
- **Devis** : validité 30 jours ; c'est le **tarif** qui est mis à jour par décret, pas le
  devis.
- Signataire d'une association : **président bénévole**, distinct d'un directeur salarié.

### Règlement de fonctionnement
- **Fin de prise en charge** : décès ou placement définitif = arrêt immédiat de plein droit,
  sans préavis ni indemnité ; changement de prestataire = un mois de préavis ; notification
  par lettre recommandée **ou e-mail** (22/09).
- **Règlement de fonctionnement ≠ règlement intérieur** : le premier relève de la loi
  2002-2 ; le second est un document **RH** (20/09).

### Procédure plaintes (07/10)
Prise en compte le jour même, accusé de réception sous 24 h par e-mail, traitement sous
10 jours, réponse écrite, archivage. Preuve attendue : saisie dans l'ERP, assignation
nominative, dates et heures.

### Participation (CVS ou autre forme)
Critère impératif. Sans CVS, une autre forme de participation — au minimum une **enquête de
satisfaction** (15/09), qui sert alors de canal de validation des documents soumis à l'avis
des personnes (07/10). Fréquence adaptée à la taille (≈ 50 personnes : une fois par an),
tracée et suivie d'actions ; comptes rendus versés à l'assemblée générale.

### PAP
Réévalué au moins une fois par an (22/09).

### Projet de service
Format de référence incertain (8, 14 ou 42 pages — 15/09) ; piste : modèle ANESM. Article
L311-8 du CASF ⚖️ à vérifier. Le gabarit vierge v01 du 15/09 est dans
`context/Documents/` (lisible, consignes 🔧 Repère HAS / 📝 Consigne / 💬 Exemple).

### Rapport de diagnostic (16/08)
Rappel du référentiel et des attendus HAS ; cotations Synaé (16 impératifs seulement en
Essentiel) ; bilan, points forts, points à améliorer, points critiques ; **par critère** :
note, constat / pratiques observées, preuves vues, preuves manquantes, action à engager ;
découpé par chapitre (≈ 40 pages pour 157 critères). En Essentiel, le rapport dit **ce qui
manque, pas comment le faire**.

### Plan d'action (PAC) (16/08)
Seuls les critères cotés **sous 4** génèrent une action. Une action = **un verbe concret
sur un document nommé** (« intégrer un paragraphe dans le livret d'accueil », « créer une
note de service », « ajouter un chapitre au DIPC »), avec un **pilote** (une fonction, pas
un nom), une échéance et un statut. Régénéré depuis le diagnostic (« table rase »), pas
depuis l'historique. Le schéma de colonnes imposé par Sandrine est attendu.

### Maturité qualité (16/08)
Trois niveaux : **réflexion** (process et documents), **pratique** (communication,
sensibilisation), **maturité** (contrôle de l'application). Preuves de diffusion et de
lecture : « ils veillent, ils informent, ils forment, ils font un suivi ». Rythme : notes
de service et comptes rendus en continu / chaque mois, d'autres documents tous les 3 ans.

### Événements indésirables — exemple du critère 3.13 (16/08)
Registre qui distingue réclamation, EI et EIG ; statistiques mensuelles et analyse des
récurrences ; procédure constat → déclaration → point du matin → qualification →
signalement ; gabarit de compte rendu d'analyse en équipe ; sensibilisation avec quiz.

### Droit à l'image (16/08)
Le formulaire de consentement est obligatoire même pour une structure qui ne prend pas de
photo : il acte alors qu'aucune n'est prise.

### Équivalences
DIPC = contrat de séjour (16/08). La grille Synaé dépend du FINESS : une structure sans
hébergement n'a pas tous les critères.

## 7. Données d'identité à collecter avant de générer

Liste dite le 22/09 pour que la génération remplisse sans inventer : raison sociale,
statut juridique, **SIRET**, **FINESS**, **numéro et date de déclaration NOVA**, numéro
d'assurance, titre du dirigeant (président bénévole / directeur), **DPO**, **référent
qualité**, autorité de tarification, partenaires du territoire, numéro d'astreinte. À
défaut : `[À compléter : …]`, jamais une valeur plausible inventée.

## 8. Documents réclamés au client

Les **7 documents loi 2002-2** sont obligatoires pour **toutes** les structures, sans option
« non concerné » (15/09) : projet d'établissement ou de service, charte des droits et
libertés, livret d'accueil, CVS ou autre forme de participation, DIPC, règlement de
fonctionnement, liste des personnes qualifiées. La charte et la liste des personnes
qualifiées sont des documents **affichés** : une photo correcte suffit, **pas d'analyse de
texte** (15/09). Pièces remises à toute nouvelle entrée : DIPC, règlement de
fonctionnement, livret d'accueil (07/10).

## 9. Brancher les documents finaux validés (base ASSAD BENOIT)

Constat du 08/10 : aucun mécanisme n'injecte aujourd'hui d'exemple validé dans les prompts
(détail : `specs/05-bilan-2026-10.md` §4). Règles à respecter pour le faire :

1. **Jamais dans le dépôt Git** (ni fixtures, ni `content/`) : ils entrent par la
   bibliothèque de modèles → base + stockage Supabase.
2. **Anonymisés avant dépôt** : nom, FINESS, SIRET, adresse, noms de salariés et de
   personnes accompagnées remplacés par `[À compléter : …]`. `anonymizeText` (e-mails,
   téléphones, NIR) **ne suffit pas**.
3. **Aucune pièce nominative** (DIPC signé, PAP rempli) comme exemple — HDS (CLAUDE.md §6).
4. Stockés comme gabarits de stade `FINALE`, rangés par Sandrine, **rattachés à un type de
   document** (lien à créer) et à leurs critères.
5. Injectés comme **donnée** (`<exemple_valide>`), jamais comme instruction, sur le modèle
   du bloc `<referentiel>`.
6. Chaque paire « document d'origine → version validée » rejoint le **jeu d'évaluation** :
   tout changement de prompt ou de modèle est rejoué dessus.
7. Cloisonnement : les exemples EODA servent à tous les clients d'EODA (tenant) ; on ne va
   **jamais** chercher d'exemple dans les `Document` d'un autre établissement.
