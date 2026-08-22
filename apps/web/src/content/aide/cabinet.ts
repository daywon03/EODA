import { AUDIENCE_CABINET, AUDIENCE_CABINET_ADMIN, type HelpArticle } from "./types";

// Articles réservés aux comptes du cabinet. Le pipeline commercial est en outre
// restreint à CABINET_ADMIN : ni un CABINET_EVALUATOR ni a fortiori un
// CLIENT_USER ne doit lire quoi que ce soit sur les prospects, les devis ou les
// prix (CLAUDE.md §7).

export const CABINET_ARTICLES: readonly HelpArticle[] = [
  {
    slug: "creer-un-etablissement-et-inviter-le-client",
    title: "Créer un établissement et inviter un interlocuteur client",
    summary:
      "Renseigner la fiche d'un ESSMS accompagné, puis ouvrir un accès à son interlocuteur.",
    category: "MISSION",
    audiences: AUDIENCE_CABINET,
    where: "Tableau de bord Cabinet → « Nouvel établissement » · puis la fiche de l'établissement",
    keywords: ["établissement", "FINESS", "SAD", "invitation", "compte client", "interlocuteur"],
    body: [
      {
        kind: "steps",
        items: [
          "Depuis le tableau de bord Cabinet, cliquez sur « Nouvel établissement ».",
          "Renseignez le nom, le numéro FINESS, le type (SAD Aide ou SAD Mixte), l'adresse et la date cible d'évaluation HAS si elle est connue.",
          "Enregistrez : la fiche s'ouvre avec sa checklist documentaire, encore vide.",
          "En bas de la fiche, bloc « Inviter un interlocuteur client » : saisissez le nom, l'email et le rôle de la personne (direction, coordination, qualité, autre).",
          "Un mot de passe temporaire est généré et affiché une seule fois. Copiez-le et transmettez-le à l'interlocuteur ; il devra le changer à sa première connexion.",
        ],
      },
      {
        kind: "paragraph",
        text:
          "Le type de SAD n'est pas cosmétique : un SAD Mixte réalise aide et soins, ce qui ajoute le critère impératif du circuit du médicament par rapport à un SAD Aide.",
      },
      {
        kind: "note",
        tone: "warning",
        text:
          "Un compte client ne voit que l'établissement auquel il est rattaché, et rien du cabinet. Ne créez jamais un compte client « générique » partagé entre deux structures : le cloisonnement repose sur ce rattachement.",
      },
    ],
  },
  {
    slug: "suivre-une-mission",
    title: "Suivre une mission d'accompagnement",
    summary:
      "Démarrer le suivi, choisir la formule, cocher les 12 items du diagnostic et les 4 phases.",
    category: "MISSION",
    audiences: AUDIENCE_CABINET,
    where: "Fiche établissement → « Suivi de mission »",
    keywords: ["mission", "formule", "diagnostic", "phases", "checklist", "offre", "PAC"],
    body: [
      {
        kind: "steps",
        items: [
          "Ouvrez la fiche de l'établissement, puis « Suivi de mission ».",
          "Si aucune mission n'existe, choisissez la formule contractée (Essentiel, Performance, Excellence) et validez. Une mission en bêta-test gratuit reçoit le périmètre le plus large.",
          "La formule reste modifiable ensuite dans le bloc « Périmètre contractuel » — c'est elle, et elle seule, qui gouverne le périmètre de la mission.",
          "Cochez les items au fur et à mesure : 12 items pour la phase de diagnostic, puis les items des 4 phases d'accompagnement, avec leurs dates de début et de fin.",
        ],
      },
      {
        kind: "list",
        items: [
          "Réunion de cadrage (validation des besoins, planning)",
          "Recueil documentaire",
          "Validation du planning de visite",
          "Réunion d'ouverture (revue du planning)",
          "Visite du site (affichage, organisation)",
          "Entretiens méthode HAS — critères impératifs",
          "Réunion de bilan de visite (axes forts / écarts / axes de progrès)",
          "Cotation des critères",
          "Vérification des documents loi 2002-2",
          "Rédaction du rapport de diagnostic",
          "Création du PAC (plan d'action)",
          "Réunion distancielle — restitution du PAC",
        ],
      },
      {
        kind: "paragraph",
        text:
          "Un item qui n'entre pas dans l'offre souscrite reste visible mais grisé, avec un cadenas, et sa case est inactive. Le refus est aussi appliqué côté serveur : le contourner depuis le navigateur ne change rien. En Essentiel, ce sont les trois items du protocole de visite longue (validation du planning, réunion d'ouverture, bilan de visite) que la demi-journée ne comporte pas.",
      },
      {
        kind: "paragraph",
        text:
          "Le bloc « Documents du portail client » affiche quatre compteurs — déposés, analysés par l'IA, modifiés, conformes. Il est en lecture seule : c'est un reflet. Le dépôt se fait depuis la checklist de la fiche établissement, pas ici.",
      },
    ],
  },
  {
    slug: "coter-les-elements-d-evaluation",
    title: "Coter les éléments d'évaluation",
    summary:
      "Ouvrir une session par chapitre, coter les E.E., et lire les impératifs à risque.",
    category: "EVALUATION",
    audiences: AUDIENCE_CABINET,
    where: "Fiche établissement → « Ouvrir l'auto-évaluation » → un chapitre",
    keywords: ["cotation", "E.E.", "critère", "impératif", "chapitre", "session", "NC", "RI", "score"],
    body: [
      {
        kind: "paragraph",
        text:
          "L'auto-évaluation exige une mission : c'est la formule qui détermine le périmètre de critères. Sans mission, l'écran propose d'en démarrer une.",
      },
      {
        kind: "paragraph",
        text:
          "Trois chapitres, trois méthodes : chapitre 1 (la personne accompagnée, accompagné traceur), chapitre 2 (les professionnels, traceur ciblé), chapitre 3 (l'ESSMS, audit système). Ouvrir un chapitre démarre — ou reprend — une session de cotation, avec un chronomètre. « Terminer la session » enregistre sa durée.",
      },
      {
        kind: "steps",
        items: [
          "Dépliez la thématique puis l'objectif pour atteindre le critère.",
          "Cotez chaque élément d'évaluation (E.E.) en cliquant sur la pastille voulue. L'enregistrement est immédiat.",
          "Utilisez le champ commentaire pour noter la preuve consultée — c'est ce qui rend la cotation défendable trois mois plus tard.",
        ],
      },
      {
        kind: "list",
        items: [
          "1 — pas du tout satisfaisant · 2 — plutôt pas satisfaisant · 3 — plutôt satisfaisant · 4 — tout à fait satisfaisant",
          "★ — optimisé, au-delà des attendus : compte comme un 4 dans le score",
          "NC — non concerné : exclu du calcul du score",
          "RI — réponse inadaptée : exclu du calcul du score",
        ],
      },
      {
        kind: "note",
        tone: "warning",
        text:
          "NC est interdit sur un critère impératif. RI n'existe qu'au chapitre 1, et seulement sur les E.E. qui l'autorisent : ailleurs le bouton n'est pas proposé. Une cotation refusée renvoie un message et rien n'est enregistré.",
      },
      {
        kind: "paragraph",
        text:
          "Le score d'un critère est la moyenne de ses E.E. cotés ; celui d'un objectif, d'une thématique puis du chapitre s'en déduit par agrégation. Tout critère impératif coté en dessous de 4 remonte dans le bandeau « impératifs à risque » en haut du chapitre — ce sont ceux qui imposent un formulaire de critère impératif et un plan d'action.",
      },
      {
        kind: "note",
        tone: "info",
        text:
          "Quand tous les documents rattachés à un critère sont conformes, la plateforme suggère une cotation. C'est une suggestion visuelle : rien n'est enregistré tant que vous n'avez pas cliqué vous-même.",
      },
      {
        kind: "paragraph",
        text:
          "Le périmètre affiché dépend de l'offre : en Essentiel, seuls les critères impératifs sont listés et cotables. Un critère standard y est refusé même s'il est atteint par un autre chemin.",
      },
    ],
  },
  {
    slug: "pipeline-commercial",
    title: "Prospects, devis et catalogue",
    summary: "Le module commercial interne : suivi des prospects, devis, catalogue et indicateurs.",
    category: "COMMERCIAL",
    audiences: AUDIENCE_CABINET_ADMIN,
    where: "Onglet « Pipeline commercial »",
    keywords: ["prospect", "devis", "catalogue", "KPI", "prix", "acompte", "conversion"],
    body: [
      {
        kind: "note",
        tone: "warning",
        text:
          "Module strictement interne, réservé au rôle administrateur du cabinet. Ces données ne doivent jamais être montrées à un compte client, ni reprises dans un livrable qui lui est destiné.",
      },
      {
        kind: "list",
        items: [
          "Prospects — un tableau par statut : nouveau contact, RDV programmé, devis envoyé, négociation, signé, perdu. Le statut se change depuis la fiche du prospect.",
          "Devis — créés depuis la fiche d'un prospect, numérotés automatiquement, avec quatre états : brouillon, envoyé, signé, perdu. Un devis se prépare à l'impression depuis sa page.",
          "Catalogue — les formules, les prestations à la carte avec leur unité de facturation (forfait, heure, jour, document, support, mois), et les réglages de facturation dont le taux d'acompte.",
          "Indicateurs — devis émis, taux de conversion, pipeline pondéré, chiffre d'affaires signé cumulé.",
        ],
      },
      {
        kind: "paragraph",
        text:
          "Les prix sont toujours présentés « à partir de » : le montant définitif se construit dans le devis, options comprises, pendant la réunion d'évaluation des besoins. Le client ne configure pas son offre lui-même.",
      },
    ],
  },
];
