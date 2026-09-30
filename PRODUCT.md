# Product

<!-- impeccable:product-schema 1 -->

> Vérité produit durable de la plateforme EODA. Les règles métier et techniques détaillées
> vivent dans `.claude/CLAUDE.md` et `.claude/context/` ; la vision et la stratégie dans
> `.claude/context/09-vision-produit.md`. Ce fichier ne décrit aucun style visuel.

## Platform

web

(Navigateur, ordinateur **et** tablette ; mobile pour les quiz ouverts par QR code. Pas
d'application native à ce stade — décision du 22/09/2026 : trop lourde pour la phase actuelle.)

## Users

Trois publics, qui n'ont ni le même besoin ni le même rapport au numérique :

1. **L'équipe EODA (portail cabinet)** — Sandrine Regina, consultante qualité ESSMS, et à
   terme des consultants partenaires (rôles `CABINET_ADMIN`, `CABINET_EVALUATOR`). Elle suit
   plusieurs structures en parallèle, prépare les diagnostics, cote les critères pendant les
   entretiens, valide chaque analyse avant qu'elle n'atteigne le client, pilote son
   pipeline commercial. Travaille sur ordinateur, parfois en visite chez le client.
2. **La direction et la coordination d'un SAD (portail client)** — directrice, coordinateur,
   référent qualité d'une petite structure (~50 personnes accompagnées), souvent **sans
   personne dédiée à la qualité**. Dépose ses documents, suit son avancement, lit ses
   livrables validés, échange avec EODA. Peu à l'aise avec le numérique (CDC du 20/08, §5).
3. **Les professionnels de terrain (AVS / ADVF)** — aides à domicile, forte rotation,
   niveaux de lecture très hétérogènes, parfois non francophones de naissance ou jamais
   scolarisés. Font des quiz de sensibilisation sur leur téléphone (QR code), consultent
   des fiches, font signer des documents aux personnes accompagnées sur tablette. **Exigence
   posée par Damon le 30/09/2026 : un enfant de 12 ans doit pouvoir s'en servir.**

## Product Purpose

Préparer un SAD à son évaluation qualité HAS et l'y maintenir entre deux évaluations
(cycle de 5 ans), en transformant un référentiel de 157 critères en une liste d'actions
claires, prouvées et suivies.

Pour EODA : absorber le travail répétitif (comparer les documents aux exigences, relancer,
coter, produire) afin d'accompagner plusieurs structures en parallèle sans perdre la qualité
du jugement humain. Pour la structure : savoir à tout moment **ce qui manque, qui doit agir,
et ce qui est déjà prouvé**.

Succès : un client qui revient sans relance, des pièces conformes validées par EODA, des
équipes sensibilisées dont la preuve existe, une évaluation externe abordée sans surprise.

## Positioning

EODA est **à la fois le logiciel et le cabinet**. Les concurrents vendent soit un outil
qualité générique multi-secteurs (la structure reste seule devant l'écran), soit du conseil
sans outil (Excel, mails, Drive). EODA vend un socle logiciel spécialisé SAD **et** la
possibilité d'y ajouter un accompagnement humain pour mettre les processus en place quand la
structure n'a personne de dédié.

Trois vérités qu'un voisin ne peut pas copier telles quelles :
- **Spécialisation SAD** (Aide / Mixte, 16 ou 17 impératifs), vocabulaire et documents du
  domicile, pas d'EHPAD générique.
- **Chaque analyse restituée est relue par une consultante formée à la méthode HAS.**
  L'automatisation prépare, l'humain valide — la plateforme ne s'auto-proclame jamais juge.
- **Conçu pour les équipes de terrain les moins à l'aise avec l'écrit**, pas seulement pour
  les directions.

L'IA n'est **pas** un argument de vente (décision Damon, 30/09/2026) : elle travaille en
coulisse et n'apparaît jamais comme promesse à l'écran.

## Operating Context

- Référentiel HAS (manuel juillet 2025) : 3 chapitres, 157 critères (137 sur le périmètre
  SAD des grilles Synaé), cotation 1/2/3/4/★/NC/RI. Plateforme officielle : Synaé. Résultats
  publics : Qualiscope (A/B/C/D, jamais une unité de saisie).
- Documents loi 2002-2 (7 outils), procédures qualité (EI, plaintes, maltraitance, PCA,
  RGPD), référentiel documentaire EODA en cours (~39 à 41 pièces, procédures « P » et
  documents « D »).
- Rituels : réunion de découverte → devis → signature → diagnostic → ateliers → suivi
  hebdomadaire → seconde auto-évaluation → évaluation externe.
- Terrain : visites à domicile, signature de DIPC, questionnaires de satisfaction papier et
  en ligne, CVS, fiches de sensibilisation rangées dans les casiers des AVS.
- Autorités : HAS (national), ARS (régional), Conseil départemental (ATC du SAD).

## Capabilities and Constraints

Existant (septembre 2026) : pipeline commercial et devis, signature → fiche client +
mission, suivi de mission, checklist documentaire avec analyse automatique et **revue
humaine obligatoire**, versioning, livrables dérivés, auto-évaluation HAS par chapitre et
comparaison de sessions, bibliothèque de modèles, agenda, fil d'échange, journal d'audit,
aide intégrée, thème clair/sombre.

Contraintes durables :
- Positionnement **préparation/conseil**, jamais « évaluation HAS officielle ».
- Cotation 1/2/3/4/★/NC/RI uniquement ; NC averti sur impératif ; RI chapitre 1 seulement.
- Aucune analyse automatique visible du client sans validation humaine.
- Hébergement en Europe ; cloisonnement strict par établissement ; toute consultation de
  document journalisée.
- Données de personnes accompagnées : minimisées ; la signature sur tablette et le stockage
  de DIPC signés ouvrent une question HDS **non tranchée** (cf. `09-vision-produit.md`).

Décisions ouvertes (ne pas inventer) : nouvelle grille tarifaire SaaS, paiement en ligne,
format d'import Synaé, cadence des relances automatiques, ouverture de la grille de
découverte au client, périmètre des modules métier (ERP) après la conformité.

## Brand Commitments

- Nom : **EODA conseil**. Signature : « Expliquer · Observer · Démontrer · Accompagner ».
- Logo officiel inchangé, jamais redessiné (`apps/web/public/logo-eoda.png`,
  `marque-eoda.png`, composant `EodaLogo.tsx`).
- Charte graphique actuelle conservée (`.claude/context/04-charte-eoda.md`) — confirmé par
  Damon le 30/09/2026 : « garde le logo et la charte graphique actuels, il faut juste que
  tout soit cohérent, facile d'utilisation et accessible ».
- Couleurs de cotation HAS réservées à la cotation.
- Contact de marque : `EODAconseil@outlook.com`.

## Evidence on Hand

- Client pilote réel : ASSAD BENOIT (bêta-test gratuit, évaluation visée janvier 2027) —
  **jamais** de données réelles dans une maquette ou une fixture.
- Offre commerciale v10 (`.claude/context/08-offre-commerciale-v10.md`), cahier des charges
  du 20/08/2026, manuel HAS et grilles Synaé (locaux, non versionnés).
- Aucun témoignage, logo client, chiffre d'impact ni benchmark publié : ne pas en inventer.

## Product Principles

1. **Conformité d'abord, métier ensuite.** On livre ce qui prouve la conformité HAS avant
   tout module de gestion (planning, RH, facturation).
2. **L'humain valide, la machine prépare.** Toute suggestion automatique est présentée comme
   une proposition à vérifier, jamais comme un verdict.
3. **Un écran, une action principale.** Ce qui manque et qui doit agir passe avant les
   pourcentages.
4. **Un fait saisi une fois.** L'état se dérive des faits ; rien ne se ressaisit.
5. **Ce qui est prouvé se voit** : chaque critère montre ses preuves, chaque formation ses
   participants, chaque document son historique.

## Accessibility & Inclusion

- Objectif : WCAG 2.2 niveau AA (base RGAA 4.1) **et** principes FALC (Facile à lire et à
  comprendre) sur tout le portail client et tous les parcours terrain.
- Test d'usage de référence : une personne de 12 ans, ou une personne qui lit difficilement,
  réussit seule un quiz, un dépôt de document et la lecture de son avancement.
- Phrases courtes, une idée par phrase, mots du quotidien, pictogramme + texte (jamais
  l'un sans l'autre), taille de texte généreuse, cibles tactiles larges, aucune information
  portée par la couleur seule, pas de jargon HAS non expliqué côté client et terrain.
