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

## Reste à faire

- **Formulaires du Département (93)** « Désignation du SAD — déclaration initiale » et
  « changement de situation » : PDF **non remplissables** (aucun champ AcroForm, vérifié le
  26/10). La fiche saisie porte déjà tous leurs champs ; il reste à écrire par-dessus le PDF
  officiel, à des coordonnées mesurées.
- Valider avec Sandrine : les points d'explication (dont le délai de rétractation de 14 jours,
  Code conso L221-18, à confirmer pour un SAD), la signature « pour le service » par
  l'intervenant (ou la direction), le format d'import de Ximi.
- Refus de signer : tracer le refus (HAS 1.7.4) plutôt que d'annuler le parcours.
