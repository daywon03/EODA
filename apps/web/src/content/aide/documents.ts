import { AUDIENCE_ALL, type HelpArticle } from "./types";

// Checklist et dépôt : les mêmes composants servent l'espace client et la fiche
// établissement côté cabinet (src/components/checklist/*), d'où une audience
// commune et un champ « où » qui nomme les deux points d'entrée.

export const DOCUMENT_ARTICLES: readonly HelpArticle[] = [
  {
    slug: "deposer-un-document",
    title: "Déposer un document",
    summary: "Déposer un PDF ou un Word sur une ligne de la checklist, et ce qui se passe ensuite.",
    category: "DOCUMENTS",
    audiences: AUDIENCE_ALL,
    where:
      "Espace client → checklist · Cabinet → fiche établissement → « Checklist documentaire »",
    keywords: ["upload", "dépôt", "fichier", "PDF", "Word", "docx", "version", "analyse"],
    body: [
      {
        kind: "steps",
        items: [
          "Dépliez la catégorie concernée en cliquant sur son titre (loi 2002-2, fonctionnement, qualité et gestion des risques, ressources humaines).",
          "Repérez la ligne du document attendu — le libellé est celui de l'exigence, pas le nom de votre fichier.",
          "Cliquez sur « Déposer » à droite de la ligne, puis choisissez le fichier sur votre ordinateur.",
          "Attendez la fin du dépôt : le statut de la ligne change tout seul, sans rechargement de la page.",
        ],
      },
      {
        kind: "paragraph",
        text:
          "Seuls les formats PDF et Word (.docx) sont acceptés. Le format réel est vérifié à partir du contenu du fichier, pas de son extension : renommer un fichier ne suffit pas à le faire passer.",
      },
      {
        kind: "paragraph",
        text:
          "Chaque nouveau dépôt sur la même ligne crée une version supplémentaire (v1, v2, v3…). La version courante est affichée sous le libellé, avec un lien d'aperçu et un lien de téléchargement. Rien n'est écrasé : l'historique reste consultable côté cabinet.",
      },
      {
        kind: "paragraph",
        text:
          "Une fois le fichier reçu, son texte est extrait et confronté aux exigences documentaires. C'est ce qui fait passer la ligne de « Déposé » à « Conforme » ou « Incomplet ». L'analyse est une aide à la décision : c'est l'évaluatrice qui tranche.",
      },
      {
        kind: "note",
        tone: "info",
        text:
          "Si le type du document n'est pas reconnu automatiquement, un message vous demande de le choisir dans une liste. Utiliser le bouton « Déposer » de la bonne ligne évite ce cas.",
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
    summary:
      "Le bloc « Ce document vous concerne-t-il ? » : dire non, ou expliquer où en est le document.",
    category: "DOCUMENTS",
    audiences: AUDIENCE_ALL,
    where: "Sur chaque ligne de checklist sans fichier déposé",
    keywords: ["manquant", "non applicable", "justification", "commentaire", "relance"],
    body: [
      {
        kind: "paragraph",
        text:
          "Tant qu'aucun fichier n'a été déposé sur une ligne, un petit bloc apparaît sous le libellé : « Ce document vous concerne-t-il ? », avec deux boutons Oui / Non et une zone de commentaire libre.",
      },
      {
        kind: "list",
        items: [
          "« Non » : le document ne s'applique pas à votre structure. La ligne passe au statut « Non applicable » et sort du décompte des manquants.",
          "« Oui » : le document vous concerne mais n'est pas encore fourni. La ligne reste « Manquant ».",
          "Commentaire : conservé dans les deux cas. Il est enregistré quand vous quittez la zone de saisie.",
        ],
      },
      {
        kind: "paragraph",
        text:
          "Le commentaire n'est pas un pense-bête : il est exploitable comme élément de preuve au moment de la cotation. Écrire « la procédure existe, elle est en cours de validation en CVS, échéance mars » vaut mieux que laisser la ligne vide — cela évite une relance et alimente le diagnostic.",
      },
      {
        kind: "note",
        tone: "info",
        text:
          "Le bloc disparaît dès qu'un fichier est déposé sur la ligne : la réponse ne concerne que les pièces encore absentes.",
      },
    ],
  },
  {
    slug: "comprendre-les-statuts-d-un-document",
    title: "Comprendre les statuts d'un document",
    summary: "Les sept pastilles de statut affichées sur la checklist, et ce qu'elles signifient.",
    category: "DOCUMENTS",
    audiences: AUDIENCE_ALL,
    where: "Colonne de droite de chaque ligne de checklist",
    keywords: ["statut", "conforme", "incomplet", "manquant", "périmé", "badge"],
    body: [
      {
        kind: "list",
        items: [
          "Manquant — aucune version déposée, et le document est attendu.",
          "Déposé — le fichier est reçu, l'analyse n'a pas encore rendu son verdict.",
          "En analyse… — l'analyse automatique est en cours.",
          "Incomplet — le document est là, mais des exigences ne sont pas couvertes. Le détail est consultable côté cabinet.",
          "Conforme — le document couvre les exigences attendues.",
          "Périmé — le document existe mais sa fréquence de mise à jour est dépassée (par exemple un document à revoir chaque année).",
          "Non applicable — répondu « Non » au bloc « Ce document vous concerne-t-il ? ».",
        ],
      },
      {
        kind: "note",
        tone: "warning",
        text:
          "Ces statuts sont indicatifs et internes. Ils n'engagent pas EODA Conseil et ne préjugent pas de la cotation qu'un organisme évaluateur retiendra.",
      },
    ],
  },
  {
    slug: "suivre-l-avancement-de-la-checklist",
    title: "Suivre l'avancement de la checklist",
    summary: "Lire la barre de progression, les compteurs, et savoir pourquoi certaines lignes manquent.",
    category: "DOCUMENTS",
    audiences: AUDIENCE_ALL,
    where: "Haut de l'espace client · fiche établissement côté cabinet",
    keywords: ["progression", "avancement", "catégories", "offre", "conforme", "compteurs"],
    body: [
      {
        kind: "paragraph",
        text:
          "Dans l'espace client, la barre de progression compte les documents conformes sur le total attendu, et trois compteurs détaillent : manquants, conformes, en cours.",
      },
      {
        kind: "paragraph",
        text:
          "Sur la fiche établissement côté cabinet, la barre affiche autre chose : le taux de dépôt, c'est-à-dire le pourcentage de documents fournis par le client. Ce n'est pas un taux de conformité — la mention figure sous la barre.",
      },
      {
        kind: "paragraph",
        text:
          "Les documents sont regroupés en quatre catégories : documents loi 2002-2 (droits des personnes accompagnées, dont le DIPC et le règlement de fonctionnement), fonctionnement de la structure, démarche qualité et gestion des risques, ressources humaines. La catégorie loi 2002-2 est ouverte par défaut : c'est la plus structurante.",
      },
      {
        kind: "note",
        tone: "info",
        text:
          "Le périmètre dépend de l'offre souscrite. En offre Essentiel, seule la catégorie loi 2002-2 est suivie : les autres catégories n'apparaissent pas, ce n'est pas un bug.",
      },
      {
        kind: "list",
        items: [
          "« Si concerné » sous un libellé : la pièce n'est attendue que si votre structure est dans le cas décrit.",
          "« Fréquence annuelle attendue » : le document doit être revu chaque année, sinon il bascule en « Périmé ».",
        ],
      },
    ],
  },
];
