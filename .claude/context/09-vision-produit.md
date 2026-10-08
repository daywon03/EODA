# Vision produit — EODA, la SaaS et le cabinet

> Rédigé le 30/09/2026 (Damon + Claude Code), à partir de : la réflexion business plan
> menée avec ChatGPT (partage Codex « Structurer le business plan ESSMS »), les réunions
> de septembre 2026 (démo à Sandrine le 22/09, séances documentaires du 22/09, cartographie
> documents ↔ critères du 20/09, tablettes et Digiforma du 25/09), le cahier des charges du
> 20/08/2026 et deux recherches web sourcées (concurrence ; FALC, signature, HDS).
>
> **Statut : direction arrêtée par Damon, chiffres à valider avec Sandrine.** Tout ce qui
> est marqué *proposition* n'est pas une décision. Les décisions déjà écrites dans
> `CLAUDE.md` restent en vigueur tant qu'une ligne de ce fichier ne les remplace pas
> explicitement.

---

## 1. La décision de positionnement (Damon, 30/09/2026)

> *« EODA sera la SaaS et aussi le consultant, mais on ne va pas mettre en avant l'IA comme
> les autres SaaS qui font ça. »*

1. **EODA est un logiciel** : un socle d'abonnement qui permet à un SAD de préparer son
   évaluation HAS et de rester prêt entre deux évaluations.
2. **EODA est un cabinet** : le contenu des offres v10 (Essentiel, Performance, Excellence,
   prestations à la carte) **tient toujours**. Il devient un **supplément d'accompagnement**
   pour les structures qui n'ont personne de dédié à la mise en place des processus.
3. **L'IA ne se vend pas.** Elle travaille en coulisse (§6) ; l'interface parle de
   « propositions à vérifier » et de « relu par Sandrine ».
4. **La cible ne change pas** : les SAD (Aide, Mixte) associatifs, privés et publics du 93,
   78 et 28, dont ASSAD BENOIT est le pilote. Pas d'EHPAD, pas de multi-secteur avant la
   preuve sur les SAD.
5. **Conformité d'abord, fonctionnalités métier ensuite** (§7).

Ce que ça ne change pas : l'indépendance évaluateur / conseil (EODA prépare, n'évalue
jamais), la validation humaine avant toute restitution, la cotation 1/2/3/4/★/NC/RI.

---

## 2. Le marché (chiffres HAS vérifiés le 30/09/2026)

| Fait | Valeur | Source |
|---|---|---|
| ESSMS dans le champ de l'évaluation | 47 700 | [HAS — niveau de qualité des ESSMS](https://www.has-sante.fr/jcms/p_3946562/en/quel-est-le-niveau-de-qualite-des-accompagnements-des-essms-en-france) |
| Évalués au 31/12/2025 | 17 790 (37 %), dont 7 263 en 2025 | idem |
| Structures atteignant **tous** leurs critères impératifs | **10,5 %** | idem |
| Impératifs les plus mal tenus | gestion de crise 35 %, maltraitance 41 %, plaintes 43 % | idem |
| Chapitre le plus faible | chapitre 3 (la structure) | idem |
| Cycle | **une évaluation tous les 5 ans** (3 sur 15 ans) | [HAS — comprendre la nouvelle évaluation](https://www.has-sante.fr/jcms/c_2838131/fr/comprendre-la-nouvelle-evaluation-des-essms) |
| Programmation pluriannuelle | 01/07/2023 → 31/12/2027 | [HAS — mettre en œuvre](https://www.has-sante.fr/jcms/p_3323069/fr/mettre-en-oeuvre-l-evaluation-des-essms) |
| Résultats publics | Qualiscope depuis le 16/09/2025, open data depuis le 28/01/2026 | [data.gouv.fr](https://www.data.gouv.fr/datasets/resultats-devaluation-des-etablissements-et-services-sociaux-et-medico-sociaux-essms) |

Non vérifié : le nombre de SAD en France (aucun chiffre HAS trouvé) ; le coût moyen d'une
évaluation externe (~7 000 € TTC, relayé par un tiers). Le jeu open data permet de compter
les SAD évalués dans le 93, le 78 et le 28 — **à faire** avant de chiffrer un objectif
commercial.

**Lecture business.** Les trois impératifs les plus ratés au niveau national (crise,
maltraitance, plaintes) sont exactement le cœur de l'offre Essentiel et des procédures P1 à
P5. C'est l'argument de prospection le plus fort dont dispose EODA, et il est public.

⚠️ Correction de la conversation ChatGPT : elle citait 16 647 ESSMS évalués et un
concurrent « Qualisia » à 149–499 €/mois. La HAS donne 17 790 ; « Qualisia » est
**introuvable** — ne pas le citer.

---

## 3. Concurrence (vérifiée le 30/09/2026)

| Acteur | Ce qu'il fait | Prix connu |
|---|---|---|
| **Ageval** | Leader revendiqué (« 1 ESSMS sur 2 »), référentiel HAS, GED, PAQ, EI, enquêtes, audits, DUERP ; hébergement HDS ; filiale formation + conseil vendus à part — [ageval.fr](https://www.ageval.fr/logiciel-qualite-medico-social/) | Sur devis ; 2 500–4 500 €/an selon un tiers (non vérifié éditeur) |
| **Qualineo** | Domicile (SAD, SSIAD), GED, PAQ, EI, plaintes, **enquêtes en FALC**, auto-évaluation HAS multi-sessions avec actions versées au PAQ, « Copilote IA » ; **partenariat Arche MC2** (ERP domicile, 300+ clients communs) — [qualineo.io](https://www.qualineo.io/secteurs/domicile) | Non public |
| **BlueKanGo** | QHSE multisecteur, auto-évaluation HAS, EI, enquêtes, IA — [bluekango.com](https://www.bluekango.com/secteurs/social-et-medico-social/) | « Dès 79 €/mois » (agrégateur, non vérifié) |
| **Qualitéval**, **MS Qualité**, **Qualissiad** | Logiciels qualité ESSMS classiques (plan d'action, évaluation HAS, EI, plaintes) | Sur devis |
| **Ximi**, **Alma**, **MyPegase**, Arche MC2 | ERP du domicile ; qualité limitée aux réclamations et enquêtes, pas de référentiel HAS affiché | Alma 200 / 490 €/mois ; MyPegase dès 84 € HT/mois ; Ximi ~99 €/utilisateur/mois (tiers) |
| **Kits papier / Word** | Ex. Élodie Goyer : kit d'auto-évaluation 850–1 300 € — [elodiegoyer.fr](https://elodiegoyer.fr/outils-qualite-essms/) | Public |
| **Digiforma** (autre secteur, référence UX) | Organismes de formation : émargement numérique, documents générés, relances datées, indicateurs Qualiopi — [digiforma.com/prix](https://www.digiforma.com/prix/) | 49 → 699 € HT/mois, public |
| **Bastion / Vanta / Drata** (autre secteur, référence UX) | Conformité logicielle : % par référentiel, statuts de preuve, frise d'audit, accusés de lecture des politiques, relance avant échéance ; **Bastion inclut un expert humain dans l'abonnement** — [bastion.tech/pricing](https://bastion.tech/pricing) | Sur devis |

**Ce que les concurrents ont et qu'EODA n'a pas encore** : plan d'amélioration alimenté par
la cotation (tous), registres EI / plaintes (tous), enquêtes FALC (Qualineo), accusé de
lecture des procédures et sensibilisation tracée, dates de validité des documents avec
relance, lien avec l'ERP du domicile (Qualineo × Arche MC2).

**Ce qu'aucun concurrent ne montre** et qu'EODA a déjà :
1. **La relecture humaine obligatoire** de toute analyse avant restitution — face aux
   « copilotes IA », c'est l'argument de confiance.
2. **Le cabinet dans le logiciel** : l'accompagnement humain intégré (modèle Bastion),
   quand Ageval vend l'outil et le conseil séparément.
3. **La spécialisation SAD** (Aide / Mixte, 16 / 17 impératifs, réforme SAD 2025–2028).
4. **L'accessibilité aux équipes de terrain** (exigence §5) — les concurrents sont pensés
   pour un responsable qualité que les petits SAD n'ont pas.
5. **Un prix public** (à décider, §4) dans un marché presque entièrement « sur devis ».

---

## 4. Modèle économique — *proposition à valider avec Sandrine*

### 4.1 Principe
Un **socle SaaS** payé par la structure, et **l'accompagnement en supplément**. Le contenu
des offres v10 ne change pas ; c'est leur mise en marché qui change : aujourd'hui l'accès
portail est une option (400 €/mois, -10 % / -30 %) greffée sur une offre de conseil ;
demain le portail est le produit, et le conseil s'y ajoute.

### 4.2 Grille proposée (montants HT, *propositions*)

| Palier | Pour qui | Contenu | Prix proposé |
|---|---|---|---|
**Structure arrêtée par Damon le 30/09/2026** (montants toujours à valider) :

| Palier | Pour qui | Contenu | Qui valide | Prix proposé |
|---|---|---|---|---|
| **1. Portail — Diagnostic** (seul) | SAD qui veut savoir où il en est et agir seul | **Le contenu de l'offre Essentiel, en autonomie** : 16/17 impératifs + 7 documents loi 2002-2 analysés, questions sur les pratiques, rapport de diagnostic + plan d'action générés, modèles vierges, échéancier, équipe & quiz, veille HAS | La structure (« non relu par EODA ») | **129 €/mois**, engagement 12 mois |
| **2. Portail — Mise en conformité** (seul) | SAD qui veut des documents conformes sans consultant | Diagnostic **sur tout le référentiel** + bouton « Mettre en conformité » sur chaque document + création des documents manquants à partir des modèles EODA | La structure | **249 €/mois**, engagement 12 mois |
| **3. Portail — Pilotage** (seul) | SAD qui veut piloter toute sa démarche qualité sans consultant | **Le contenu de l'offre Excellence, en autonomie** : Mise en conformité + plan d'action PDCA avec pilotes, revue qualité guidée et compte rendu généré, registres plaintes / EI, gestion complète de l'équipe (rôles, campagnes de quiz, retests), **24 KPI en 6 domaines** + rapport mensuel, seconde auto-évaluation comparée, répétition de l'évaluation | La structure | **399 €/mois**, engagement 12 mois (≈ la licence portail actuelle de 400 €/mois) |
| **4. Accompagnement** (en supplément) | SAD sans personne dédiée à la mise en place des processus | Essentiel, Performance, Excellence, prestations à la carte — **contenu v10 inchangé**, relecture humaine de Sandrine | **Sandrine**, puis la structure | Prix « à partir de » v10 **conservés comme base** ; remise abonné à décider |
| **Réseau / multi-sites** | Associations multi-SAD, fédérations | Tableau de bord consolidé | — | Sur devis |

Ce que ça change par rapport à la v10 : la **visite** et la **cotation par Sandrine** de
l'offre Essentiel restent dans l'accompagnement ; en palier Diagnostic, c'est la structure
qui répond aux questions et cote, guidée par la plateforme.

Repères : la zone crédible pour un SAD de ~50 personnes accompagnées est **79–250 €/mois**
(recherche du 30/09). L'objectif du cahier des charges (CA mensuel > 4 000 €) est atteint
avec ~16 abonnés Mise en conformité ou ~31 abonnés Diagnostic, avant toute mission de
conseil.

**⚠️ Deux règles actuelles sont renversées pour les paliers seuls — à confirmer avec
Sandrine, qui les avait posées :** « aucune analyse automatique n'atteint le client sans
revue humaine » (CDC du 20/08) et « le client n'appuie jamais lui-même sur générer » (call du
16/08, pour justifier la facturation de l'accompagnement). Elles **restent vraies** pour une
structure accompagnée ; pour une structure seule, c'est elle qui déclenche et qui valide,
avec la mention « non relu par EODA ». Tant que ce n'est pas implémenté, le code applique la
règle stricte pour tout le monde.

### 4.2 bis Les pratiques, pas seulement les documents
La HAS vérifie aussi que les processus sont appliqués. Le portail pose donc, par critère ou
par thématique, des questions sur les pratiques (« Ce processus est-il en place ?
Expliquez-le »), avec **réponse écrite ou dictée** (transcription vocale). Base : la structure
des grilles Synaé (E.E., éléments de preuve, commentaires) et du classeur de suivi de
Sandrine (preuves, statut, action prioritaire, écart / corrections / reste à traiter pour
les impératifs), plus le manuel HAS. Point de vigilance : une réponse dictée peut citer une
personne accompagnée — rappel à l'écran, pas de conservation de l'audio, transcription par
un prestataire européen (à choisir).

### 4.3 Ce que ça implique dans le code (à ne pas faire avant validation)
- `subscription-service.ts` porte aujourd'hui la dégressivité -10 % / -30 % d'une ligne
  `VEILLE_PORTAIL_EODA` : elle devra être remplacée par des paliers d'abonnement, pas
  complétée par-dessus.
- **« Une fiche client ne se crée que par la signature d'un devis »** (CLAUDE.md) reste
  vrai : un abonnement se signe comme un devis. Une souscription en libre-service serait une
  **seconde porte** — décision explicite requise avant de la construire.
- Paiement en ligne : toujours en attente d'un choix de prestataire (§12.6 du doc 07).

### 4.4 Décisions ouvertes
Montants des paliers ; quota de relecture du palier Accompagné ; remise abonné sur les
offres de conseil ; frais de mise en route ; sort des clients actuels (bêta-test).

---

## 5. L'exigence d'accessibilité (Damon, 30/09/2026)

> *« Il faut que même un enfant de 12 ans puisse utiliser la plateforme, faire les quiz… »*

Référence : WCAG 2.2 AA (socle RGAA 4.1) + règles FALC européennes « L'information pour
tous » ([Unapei](https://www.unapei.org/publication/linformation-pour-tous-regles-europeennes-pour-une-information-facile-a-lire-et-a-comprendre/)).
EODA n'y est pas légalement tenu (RGAA : privé > 250 M€ de CA ; European Accessibility Act :
exemption < 10 salariés et < 2 M€ —
[source](https://obligations-legales-accessibilite-numerique.fr/fr/comprendre/)) : c'est un
**choix produit**, et un différenciateur.

Points qui ne s'inventent pas :
- **Pictogrammes** : ARASAAC (CC BY-NC-SA) et SantéBD **interdisent l'usage commercial**
  ([ARASAAC](https://innovacioneducativa.aragon.es/arasaac-los-pictogramas-aragoneses-que-estan-presentes-en-medio-mundo/),
  [SantéBD](https://ib.santebd.org/cgu)) ; Sclera exige un accord écrit
  ([Sclera](https://www.sclera.be/fr/picto/copyright)). → Jeu de pictogrammes propre à EODA
  ou licence compatible.
- **Logo FALC** : gratuit, mais exige une relecture par des personnes concernées
  ([conditions](https://easy-to-read.inclusion-europe.eu/european-logo/)). → Ne pas
  l'apposer avant cette relecture.
- **Pas de pourcentages ni d'images enfantines** pour les publics FALC.
- Mesures de contraste de la charte actuelle et règles d'usage :
  `.claude/context/04-charte-eoda.md` §7.

---

## 6. Comment l'IA doit fonctionner (vue CTO)

### 6.1 Doctrine
L'IA **prépare**, l'humain **décide**. *(Mise à jour du 08/10 : l'IA peut être nommée à
l'écran — accord de Sandrine — mais toujours avec sa réserve ; en autonomie, « non
revérifié par un humain, peut comporter des erreurs, à relire absolument ». Voir CLAUDE.md
§7.)* Elle produit des **propositions** que Sandrine accepte ou corrige, et **rien**
n'atteint le client sans validation (`analysisVisibleTo`, déjà en place). Chaque geste
« accepter » / « corriger » est une donnée d'évaluation : c'est ainsi que le système
s'améliore et que sa fiabilité se mesure.

### 6.2 Le pipeline de dépôt (dessiné le 20/09/2026)
1. **Extraction** du texte et des images (PDF, DOCX ; OCR plus tard pour les scans et les
   questionnaires papier photographiés).
2. **Repérage des critères couverts** — un document couvre de 2 à 10 critères ; la
   proposition cite les passages qui la justifient.
3. **Repérage des champs client** à compléter (logo, raison sociale, SIRET, FINESS, dates).
4. **Contrôle de cohérence** contre le référentiel en base (éléments d'évaluation, preuves
   attendues) : manques, mentions périmées, contradictions entre documents (ex. une clause
   CESU supprimée du livret mais restée dans le règlement de fonctionnement).
5. **Revue humaine** (file « À relire ») avant toute publication.

### 6.3 Règles de construction
- **Ancrage** : le prompt reçoit le texte officiel du critère et de ses E.E. depuis la base
  (référentiel versionné), jamais depuis la mémoire du modèle.
- **Sortie structurée** (schéma JSON validé), avec pour chaque constat : le critère, le
  passage cité, un niveau de certitude, et la valeur « non déterminable » quand le
  document ne permet pas de conclure — plutôt qu'une affirmation.
- **Jamais de verdict de conformité** généré pour le client ; la cotation suggérée reste
  une suggestion modifiable (règle déjà écrite au spec 01, module 3).
- **Minimisation** : pseudonymisation des champs nominatifs avant tout envoi à un modèle ;
  les pièces nominatives (DIPC signé, PAP) ne partent pas à l'analyse sans décision HDS (§8).
- **Coût maîtrisé** : un petit modèle pour classer et repérer (Claude Haiku 4.5), un modèle
  intermédiaire pour l'analyse et la rédaction (Claude Sonnet 5.5) ; mise en cache du
  référentiel dans le prompt ; traitement hors du cycle de la requête (convention `P8`).
- **Évaluation** : un jeu de référence constitué des analyses **déjà validées par
  Sandrine** ; chaque changement de prompt ou de modèle est rejoué dessus ; indicateur
  suivi : taux de propositions acceptées sans correction, par critère.
- **Fournisseur** : DeepSeek (testé le 20/09, 1,13 $ pour 100 M de jetons) est écarté pour
  les données clients — hors UE, sans garantie. Piste à vérifier : Claude via un
  hébergeur européen certifié HDS (ex. AWS Bedrock en région UE sous contrat HDS), pour
  traiter un jour des pièces nominatives.

### 6.4 Autres usages, tous en coulisse
Questions de quiz tirées des procédures de la structure (relues par Sandrine avant
diffusion) ; reformulation des E.E. en questions d'entretien ; lecture des questionnaires
de satisfaction papier photographiés ; récapitulatif « ce qui a changé » d'une version à
l'autre d'un document.

### 6.5 Ce dont j'ai besoin pour écrire les bons prompts
Déjà sur le poste de Damon (non versionnés) : le manuel HAS, les trois grilles Synaé, le
cahier des charges. **À demander** :
1. les fiches `Critère_X_Y_Z.docx` (« documents & preuves attendus ») ;
2. 10 à 20 documents déjà analysés **et corrigés par Sandrine**, anonymisés — le jeu de
   référence ;
3. le référentiel documentaire en cours (~39–41 pièces, P et D) une fois validé par l'assistante de direction du pilote ;
4. le fichier PAC imposé (schéma de colonnes) ;
5. la note HAS du 03/09/2026 à qualifier (générale ou ESSMS ?).

---

## 7. Feuille de route — conformité d'abord

| Lot | Contenu | Condition |
|---|---|---|
| **A — Refonte et socle conformité** | Nouveau design (brief `.claude/design/`), navigation latérale cabinet, fiche structure en onglets, panneau document, file « À relire », **critères & preuves**, **plan d'action (PAC)**, échéancier / renouvellement des documents, agenda commenté, journal des modifications d'un document | Maquettes validées par Sandrine ; fichier PAC |
| **B — Équipe et sensibilisation** | Liste de l'équipe (import tableur), quiz par QR code **dans la plateforme**, fiches et bibliothèque d'auto-formation, matrice de preuve, retest tous les 6 mois, accusé de lecture des procédures | Décision « compte ou choix du nom » |
| **C — Terrain** | Signature sur tablette avec dossier de preuve, enquête de satisfaction (en ligne + papier photographié), feuille de réception unique | **Décision HDS (§8)** |
| **D — Offre SaaS** | Paliers d'abonnement (Diagnostic, Mise en conformité, Pilotage), remplacement de la dégressivité actuelle, paiement en ligne | Validation des prix (§4) ; prestataire de paiement |
| **E — Pilotage en autonomie** | Ce qui fait le palier Pilotage : plan d'action PDCA avec pilotes, revue qualité guidée, **registres plaintes / EI** (remontés ici : trois impératifs, les plus faibles au niveau national), rôles dans l'équipe cliente, **24 KPI** + rapport mensuel, répétition de l'évaluation | Rôles côté client à modéliser (aujourd'hui un seul rôle `CLIENT_USER`) |
| **Ensuite — métier** | Connexion aux ERP du domicile (Ximi, Arche MC2) **plutôt que** de reconstruire planning, tournées, paie et facturation | Demande récurrente de clients payants |

**Changement de décision à noter** : le §12.5 du doc 07 (call du 16/08) prévoyait de
renvoyer vers Kahoot, « pas de moteur de quiz maison ». La démo du 22/09 demande des quiz
par QR code **avec suivi par salarié et retest à 6 mois** — ce que Kahoot ne donne pas
comme preuve d'audit. Le lot B construit donc les quiz dans la plateforme.

**Vue CTO sur l'ERP** : Qualineo s'est allié à Arche MC2 plutôt que de refaire un ERP. Le
marché du planning / télégestion du domicile est occupé ; la valeur d'EODA est la preuve de
conformité. Point à vérifier (réunion du 25/09) : le coordinateur de secteur du pilote a évoqué que « seules 5 marques
sont autorisées comme outils métier » — non vérifié, à qualifier avant tout projet ERP.

---

## 8. Décision bloquante — hébergement de données de santé (HDS)

**Le fait.** L'article L1111-8 du Code de la santé publique impose un hébergeur certifié HDS
pour les données de santé recueillies lors d'un **suivi social ou médico-social**
([Légifrance](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049577902)) ; le
référentiel CNIL médico-social le redit et impose une AIPD systématique
([CNIL](https://www.cnil.fr/sites/cnil/files/atoms/files/referentiel_relatif_aux_traitements_de_donnees_personnelles_pour_le_suivi_social_et_medico-social_des_personnes_agees_en_situation_de_handicap_ou_en_difficulte.pdf)).
Un DIPC signé, un PAP, une évaluation des besoins, un plan APA révèlent la dépendance : **ce
sont en pratique des données de santé** ([CNIL](https://www.cnil.fr/fr/quest-ce-ce-quune-donnee-de-sante)).

**Le problème.** Supabase et Vercel ne sont **pas** certifiés HDS
([Supabase](https://supabase.com/security), [Vercel](https://vercel.com/security)).

**Conséquences immédiates.**
- Les modules **signature sur tablette** et **dossier de la personne accompagnée** (lot C)
  ne partent pas en production sur l'infrastructure actuelle.
- Les documents **institutionnels** (livret d'accueil vierge, procédures, projet de service,
  règlement de fonctionnement) restent dans le périmètre actuel.
- À vérifier dès maintenant : aucune pièce nominative (DIPC rempli, PAP) n'est déjà déposée
  dans la checklist — l'avertissement à l'upload prévu au spec 01 doit l'interdire
  explicitement.

**Options** : (a) rester sur des preuves organisationnelles sans données nominatives
(recommandé pour les lots A et B) ; (b) migrer la partie nominative vers un hébergeur
certifié HDS en UE (OVHcloud, Scaleway, 3DS Outscale — certifications à revérifier au
registre ANS) ; (c) laisser les pièces nominatives dans l'ERP du client (Ximi…) et ne
stocker chez EODA que la preuve qu'elles existent. **Décidé le 08/10/2026 : option (b)** — le backend migre vers un hébergement certifié HDS ; enquête nominative ; le lot C se construit, rien de nominatif en production avant la migration (CLAUDE.md §6).

**Signature électronique** : la signature simple est recevable pour un DIPC (aucun niveau
imposé par le CASF), à condition d'un **dossier de preuve** (identité du signataire et de
l'intervenant, empreinte SHA-256 du PDF signé, horodatage, journal inaltérable, appareil) ;
une signature dessinée seule n'est qu'une image. Prévoir la signature par le **représentant
légal**. Ne pas enregistrer la dynamique du tracé (risque de donnée biométrique). Sources :
[Goodflag](https://goodflag.com/blog/fichier-de-preuve), [DAJ Bercy](https://www.economie.gouv.fr/daj/lettre-de-la-daj-valeur-juridique-de-la-signature-manuscrite-scannee).
À faire valider par un juriste.

---

## 9. Indicateurs de réussite du produit

- Délai entre l'ouverture d'un compte et le premier document déposé.
- Part des critères du périmètre qui ont au moins une preuve rattachée.
- Actions du plan ouvertes / clôturées.
- Taux de propositions acceptées sans correction (qualité des automatismes).
- Utilisation hebdomadaire sans relance ; part des salariés à jour de leur quiz.
- Heures de Sandrine par structure et par mois (le gain de temps, objectif premier).
- Conversion Autonomie → Accompagné → mission de conseil.

## 10. Risques

| Risque | Réponse |
|---|---|
| Produit perçu comme un outil qualité de plus | Spécialisation SAD, humain dans la boucle, accessibilité terrain, prix public |
| Usage ponctuel (tous les 5 ans) | Échéancier des documents, retest des quiz, rappel annuel, veille HAS |
| Adoption faible par les équipes | Espace équipe FALC, QR code, zéro compte à créer |
| Score trompeur (« document présent » ≠ « pratique appliquée ») | Preuves multiples par critère, relecture humaine, jamais de pourcentage présenté comme une garantie |
| Données de santé | Décision HDS (§8) avant le lot C ; minimisation par défaut |
| Dépendance à un développeur unique | Déjà relevée par le CDC §7 : documentation, conventions, CI |
