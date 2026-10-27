# ADR 20261026 — DIPC signé sur la tablette, sans que rien ne quitte la tablette

- **Statut** : proposé (demande de Damon du 26/10/2026, à confirmer). Les points
  d'explication sont **provisoires, à valider par Sandrine**.
- **Date** : 26/10/2026
- **Portée** : accueil d'une nouvelle personne accompagnée, signature de son DIPC, envoi à la
  personne, export vers le logiciel métier (Ximi) ou le serveur de la structure.
- **Prolonge** : ADR 20261014 (verrou HDS) et la décision du 22/10/2026 (liste de l'enquête
  tenue sur la tablette).

## Contexte

Demande : sur la tablette, faire signer le DIPC fourni par EODA à une nouvelle personne,
expliquer ce que le manuel HAS impose d'expliquer, saisir son identité **une fois** pour
qu'elle se retrouve partout, signer, envoyer le contrat à la personne, l'exporter (une
personne ou toutes) vers Ximi ou le serveur de la structure. Un projet de signature
électronique a été proposé : **DocuSeal** (`signature-electronique-open-source/`).

Contraintes :
- l'identité d'une personne accompagnée, son DIPC signé et sa signature sont des **données de
  santé** (ADR 20261014) : rien ne s'écrit sur Supabase / Vercel avant la migration HDS ;
- la décision du 22/10 a déjà ouvert une voie qui tient : une liste nominative **gardée dans le
  navigateur de la tablette**, jamais envoyée (`survey-roster-boundary.test.ts`).

## Décision

1. **Tout se passe dans le navigateur de la tablette.** Fiche d'identité, fusion dans le DIPC,
   explications cochées, signatures, PDF, export : `admission-service`,
   `admission-document-service`, `admission-pdf` (pdf-lib 1.17.1, chargé à la signature
   seulement), `zip-store`. Contrats rangés dans IndexedDB, base nommée par structure.
   Le test de frontière refuse qu'un module serveur les importe, import dynamique compris.
2. **Le serveur ne donne qu'une chose : le DIPC validé de la structure** (document
   institutionnel). `getTabletDipcSource` (garde `resolveTabletSession`, structure lue depuis
   l'appareil), règle `selectTabletDipc` : validation à jour (`isValidationCurrent`), version
   d'EODA d'abord. Accès journalisé `DOCUMENT_PREVIEWED` sans personne. Aucune écriture.
3. **Un seul plan pour l'aperçu et le PDF** (`planAdmissionDocument`) : ce que la personne relit
   avant de signer est ce qui est signé. Aucune clause ajoutée : identité des parties devant,
   texte d'EODA au milieu (champs `{{personne.nom}}`… remplis, champ inconnu = signature
   refusée), trace des explications, des remises et des signatures derrière.
4. **Signature électronique simple** (art. 1367 C. civ.) : image PNG finale par signataire,
   jamais le tracé (biométrie, 09 §8) ; horodatage, intervenant présent, appareil enregistré,
   empreinte SHA-256 du DIPC validé dans le contrat, empreinte du PDF dans l'index d'export.
   Signataires : la personne et le service ; sous tutelle, le tuteur à la place de la
   personne ; sous curatelle, la personne ET le curateur.
5. **Envoi à la personne par la feuille de partage de la tablette** (messagerie, AirDrop,
   impression), jamais par l'e-mail du serveur : le PDF ne transite pas par EODA.
6. **Export** : un PDF, ou une archive ZIP de tous les contrats avec un index CSV (nom de
   naissance, nom d'usage, date de naissance, version du DIPC, date de signature,
   signataires, fichier, empreinte). Noms de fichiers à la convention EODA.
7. **Pas de DocuSeal.** Service Docker séparé (Ruby, AGPL-3.0) qui stockerait les DIPC signés
   hors hébergeur HDS ; l'AGPL impose de publier le code de toute version modifiée offerte
   en réseau ; il ajoute un serveur à exploiter pour un geste qui se fait en face à face, sur
   un appareil déjà authentifié. Il redeviendrait pertinent pour une signature **à
   distance** (envoi d'un lien à signer), une fois le backend HDS en place.

## Conséquences

- Utilisable **dès maintenant** avec les vraies personnes, sans lever le verrou HDS.
- La tablette n'est pas un coffre : un navigateur effacé perd ses contrats. L'écran le dit et
  pousse à l'export ; `navigator.storage.persist()` est demandé. Une liste par tablette.
- Le cabinet ne voit rien de nominatif (cohérent avec la minimisation du 14/10).
- À la migration HDS : chaque contrat rejoint le dossier de la personne par
  `BeneficiaryDataPort.recordSignedDocument` (`BeneficiaryDocumentKind.DIPC`), le PDF dans
  le stockage HDS.

## Complément du 27/10/2026

- **Copie du DIPC pour la tablette** : plutôt qu'une copie rangée (périmée à chaque
  nouvelle version validée), une préparation DÉRIVÉE du texte validé
  (`prepareDipcForTablet`) : Markdown nettoyé, champs d'identité posés sur les zones
  repérées par leur libellé, « [à compléter] » saisis sur la tablette, « ☐ » cochés,
  annexes intactes. Vérifiée sur le DIPC de l'ASSAD (lecture seule de la base, texte jamais
  commité).
- **Formulaire « désignation du SAD — déclaration initiale » (Département 93)** : rempli par
  écriture sur le PDF officiel, à des positions mesurées sur ce fichier ; son empreinte est
  figée et tout autre fichier est refusé. Les déclarations sur l'honneur sont cochées par la
  personne. Il part avec le contrat, par la feuille de partage de la tablette.
- **Correctif** : `/tablette/admission` n'était pas ouverte dans `classifyPath` — la
  tablette était renvoyée vers `/login`. Un test lit désormais toutes les pages de la
  tablette sur le disque.

- **Formulaire « changement de situation »** (même jour) : rempli de la même façon, sur
  son propre PDF officiel (positions et empreinte propres), choisi sur le même écran que
  la déclaration initiale.
- **Durée du contrat** : les options « n°1 / n°2 » du DIPC deviennent un choix sur la
  tablette ; durée indéterminée proposée d'emblée ; dates exigées pour la durée
  déterminée.

- **Refus de signer** (HAS 1.7.3 / 1.7.4) : enregistré sur la même fiche que le contrat
  (issue « refusé »), avec une attestation qui ne fait rien signer, le motif s'il est
  donné et la date à laquelle reproposer ; visible dans la liste et dans l'export.
- Valider avec Sandrine : les points d'explication (dont le délai de rétractation de 14 jours,
  Code conso L221-18, à confirmer pour un SAD), la signature « pour le service » par
  l'intervenant (ou la direction), le format d'import de Ximi.
- Refus de signer : tracer le refus (HAS 1.7.4) plutôt que d'annuler le parcours.

## Complément du 27/10/2026 (soir) — le Word d'EODA, tel quel

- **Décision** (Damon) : le contrat signé doit être le document qu'EODA a validé, avec sa
  mise en page (couleurs, tableaux). La copie en texte rendue en PDF ne la gardait pas.
- **Choix** : la tablette remplit le `.docx` validé lui-même, dans le navigateur — lecture
  ZIP sans dépendance (`zip-read`, `DecompressionStream`), réécriture des seules zones
  (`dipec-word-service`), signatures insérées comme images. Écarté : une conversion
  serveur (Chromium) — elle ferait passer le contrat rempli, donc des données de santé,
  par le serveur (verrou HDS) ; écarté aussi : un DocuSeal (même raison, déjà écarté le 26/10).
- **Conséquences** : le contrat remis et exporté est un `.docx` ; le PDF devient
  l'attestation de remise et de signature, qui porte l'empreinte du Word. Le rythme convenu
  s'écrit sous l'article 3.4 ; la personne de confiance remplit et cosigne l'annexe 3.2 ;
  absente, elle reçoit le contrat par la messagerie de la tablette. Le formulaire du
  Département reprend l'aide, les heures et la signature du contrat.
- **À valider avec Sandrine** : la phrase ajoutée sous l'article 3.4 (« Rythme convenu avec
  le bénéficiaire : … ») ; l'envoi de l'annexe 3.2 à une personne de confiance absente
  (retour papier ou scan) ; un PDF du Word signé, si Ximi ou le Département l'exigent
  (aujourd'hui : le Word et l'attestation).
