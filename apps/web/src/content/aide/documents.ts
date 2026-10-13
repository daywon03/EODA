import { AUDIENCE_ALL, type HelpArticle } from "./types";

// Dépôt et suivi des documents : le portail client (« Mes documents », écrans v2)
// et l'onglet « Documents » de la fiche structure côté cabinet, d'où une audience
// commune et un champ « où » qui nomme les deux points d'entrée.

export const DOCUMENT_ARTICLES: readonly HelpArticle[] = [
  {
    slug: "deposer-un-document",
    title: "Déposer un document",
    summary: "Déposer un fichier ou une photo en trois étapes, et ce qui se passe ensuite.",
    category: "DOCUMENTS",
    audiences: AUDIENCE_ALL,
    where:
      "Portail de la structure → « Mes documents » · Cabinet → fiche structure → onglet « Documents »",
    keywords: ["upload", "dépôt", "fichier", "PDF", "Word", "docx", "version", "analyse"],
    body: [
      {
        kind: "steps",
        items: [
          "Dans « Mes documents », repérez la carte du document attendu — son nom est celui de l'exigence, pas celui de votre fichier.",
          "Cliquez sur « Déposer » sur cette carte. Étape 1 : choisissez le fichier, glissez-le, ou prenez le document en photo.",
          "Étape 2 : vérifiez que c'est le bon document, et qu'il ne contient pas le nom d'une personne accompagnée. Puis « Oui, envoyer ».",
          "Étape 3 : c'est envoyé. La carte passe à « Reçu, en cours » ; la réponse arrive dans « Mes documents ».",
        ],
      },
      {
        kind: "paragraph",
        text:
          "Formats acceptés : PDF, Word, Excel, CSV, et photos (JPEG, PNG). Le format réel est vérifié à partir du contenu du fichier, pas de son extension : renommer un fichier ne suffit pas à le faire passer.",
      },
      {
        kind: "paragraph",
        text:
          "Chaque nouveau dépôt sur le même document crée une version supplémentaire (v1, v2, v3…). Rien n'est écrasé : l'historique reste consultable côté cabinet.",
      },
      {
        kind: "paragraph",
        text:
          "Une fois le fichier reçu, son texte est confronté aux exigences documentaires. L'analyse est une aide à la décision : pour une structure accompagnée, EODA la relit avant que la structure la voie.",
      },
      {
        kind: "note",
        tone: "info",
        text:
          "Déposer depuis la carte du bon document évite toute confusion : le fichier est rangé directement au bon endroit.",
      },
      {
        kind: "note",
        tone: "warning",
        text:
          "Un document qui n'entre pas dans le périmètre de l'offre souscrite est refusé, avec un message explicite. Rien n'est alors conservé : le fichier n'est ni stocké ni analysé.",
      },
    ],
  },
  {
    slug: "repondre-a-une-piece-manquante",
    title: "Répondre à une pièce manquante",
    summary: "« Je ne l'ai pas » ou « Ne nous concerne pas » : dire où en est un document absent.",
    category: "DOCUMENTS",
    audiences: AUDIENCE_ALL,
    where: "Portail de la structure → « Mes documents » → carte d'un document à déposer",
    keywords: ["manquant", "non concerné", "je ne l'ai pas", "à produire", "justification", "commentaire", "relance"],
    body: [
      {
        kind: "list",
        items: [
          "« Je ne l'ai pas » : le document vous concerne mais n'existe pas encore. La carte passe à « À produire » : il ne vous est plus réclamé comme une pièce à déposer.",
          "« Je l'ai maintenant : déposer » : le document existe finalement, vous le déposez depuis la même carte.",
          "« Ne nous concerne pas » : le document ne s'applique pas à votre structure. La carte passe à « Non concerné ». Ce choix n'existe pas pour les sept documents de la loi 2002-2, obligatoires pour toutes les structures.",
        ],
      },
      {
        kind: "paragraph",
        text:
          "Côté cabinet, le panneau du document (onglet « Documents » de la fiche) garde un commentaire libre. Il est exploitable comme élément de preuve au moment de la cotation : « la procédure existe, elle est en cours de validation en CVS, échéance mars » vaut mieux qu'une ligne vide.",
      },
    ],
  },
  {
    slug: "comprendre-les-statuts-d-un-document",
    title: "Comprendre l'état d'un document",
    summary: "Les pastilles affichées sur chaque document, et ce qu'elles signifient.",
    category: "DOCUMENTS",
    audiences: AUDIENCE_ALL,
    where: "Pastille de chaque document · portail de la structure et onglet « Documents » de la fiche",
    keywords: ["statut", "état", "conforme", "accepté", "à déposer", "à produire", "à renouveler", "pastille"],
    body: [
      {
        kind: "paragraph",
        text: "Côté structure, l'état reste simple :",
      },
      {
        kind: "list",
        items: [
          "À déposer — le document est attendu, aucun fichier n'a été envoyé.",
          "À produire — vous avez indiqué ne pas l'avoir.",
          "Reçu, en cours — le fichier est arrivé et il est en cours de traitement.",
          "Relu par EODA — l'analyse a été relue : à vous de la lire, puis de l'accepter. En autonomie, la pastille dit « À vérifier par vous ».",
          "Accepté par vous — vous avez accepté le document.",
          "À renouveler — la date de mise à jour attendue est dépassée (par exemple un document à revoir chaque année).",
          "Non concerné — le document ne s'applique pas à votre structure.",
        ],
      },
      {
        kind: "paragraph",
        text:
          "Côté cabinet, l'onglet « Documents » suit le parcours complet : déposé, analysé, mis en conformité, restitué, validé. Seule la validation est un geste : elle engage la parole de l'évaluatrice.",
      },
      {
        kind: "note",
        tone: "warning",
        text:
          "Ces états sont indicatifs et internes. Ils n'engagent pas EODA Conseil et ne préjugent pas de la cotation qu'un organisme évaluateur retiendra.",
      },
    ],
  },
  {
    slug: "suivre-l-avancement-de-la-checklist",
    title: "Suivre l'avancement de ses documents",
    summary: "Les filtres de « Mes documents », et pourquoi certains documents n'apparaissent pas.",
    category: "DOCUMENTS",
    audiences: AUDIENCE_ALL,
    where: "Portail de la structure → « Mes documents » · fiche structure → onglet « Documents »",
    keywords: ["progression", "avancement", "catégories", "offre", "filtres", "compteurs"],
    body: [
      {
        kind: "paragraph",
        text:
          "Dans « Mes documents », les filtres « À déposer », « À produire », « Reçu, en cours » et « Accepté » regroupent les documents par ce qu'il reste à faire.",
      },
      {
        kind: "paragraph",
        text:
          "Les documents sont rangés en quatre catégories : loi 2002-2 (droits des personnes accompagnées, dont le DIPC et le règlement de fonctionnement), fonctionnement de la structure, démarche qualité et gestion des risques, ressources humaines.",
      },
      {
        kind: "note",
        tone: "info",
        text:
          "Tout ce qu'EODA produit pour une structure ne lui est pas réclamé : le portail affiche les documents demandés à la structure, plus ceux qui existent déjà pour elle. Le périmètre dépend aussi de l'offre : en Essentiel, seule la catégorie loi 2002-2 est suivie. Ce n'est pas un bug.",
      },
    ],
  },
];
