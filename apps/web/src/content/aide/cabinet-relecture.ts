import { AUDIENCE_CABINET, AUDIENCE_CABINET_ADMIN, type HelpArticle } from "./types";

// Écrans v2 du travail sur les documents côté cabinet : la file « À relire », la
// mise en conformité côte à côte, et le réglage des documents réclamés.

export const CABINET_REVIEW_ARTICLES: readonly HelpArticle[] = [
  {
    slug: "relire-les-analyses",
    title: "Relire les analyses avant qu'elles atteignent la structure",
    summary: "La file « À relire » : vérifier chaque proposition, puis « Marquer relu ».",
    category: "DOCUMENTS",
    audiences: AUDIENCE_CABINET,
    where: "Menu « À relire » · ou fiche structure → onglet « Documents » → un document",
    keywords: ["relecture", "analyse", "proposition", "relu", "revue", "à vérifier", "file"],
    body: [
      {
        kind: "paragraph",
        text:
          "Chaque document déposé est analysé, puis attend une relecture humaine. La file « À relire » liste ces analyses du plus ancien au plus récent, toutes structures confondues. Tant qu'une analyse n'est pas relue, une structure accompagnée ne la voit pas.",
      },
      {
        kind: "steps",
        items: [
          "Ouvrez le premier document de la file : son aperçu et son analyse s'affichent ensemble.",
          "Pour chaque proposition, « Accepter » ou « Corriger ». Un constat erroné se corrige dans le document, pas en réécrivant l'analyse.",
          "« Marquer relu » : la structure voit alors la mention de relecture, et la file passe au document suivant.",
        ],
      },
      {
        kind: "note",
        tone: "warning",
        text:
          "Une analyse illisible (vide, ou qui n'a pas abouti) ne peut pas être marquée relue : relancez l'analyse d'abord. Une relecture engage la parole d'EODA sur des documents présentés à la HAS.",
      },
    ],
  },
  {
    slug: "mettre-en-conformite-cote-a-cote",
    title: "Mettre un document en conformité, côte à côte",
    summary: "Décider chaque ajout proposé, puis enregistrer la version suivante du document.",
    category: "DOCUMENTS",
    audiences: AUDIENCE_CABINET,
    where: "Fiche structure → onglet « Documents » → un document → « Mettre en conformité côte à côte »",
    keywords: ["conformité", "correction", "version", "ajout", "proposition", "côte à côte"],
    body: [
      {
        kind: "paragraph",
        text:
          "À gauche, le document tel qu'il a été déposé ; à droite, la proposition, où chaque ajout est rattaché au critère qu'il vise. Les champs « [À compléter : …] » sont à remplir : la plateforme n'invente ni horaire, ni délai, ni nom.",
      },
      {
        kind: "steps",
        items: [
          "Pour chaque ajout, « Accepter » ou « Refuser » (ou « Accepter tout » une fois la proposition relue).",
          "« Enregistrer la version » : seuls les ajouts acceptés entrent dans la nouvelle version, l'original reste dans l'historique.",
        ],
      },
    ],
  },
  {
    slug: "choisir-les-documents-reclames",
    title: "Choisir les documents réclamés aux structures",
    summary: "Ce qu'on demande à une structure n'est pas tout ce qu'EODA produit pour elle.",
    category: "DOCUMENTS",
    audiences: AUDIENCE_CABINET_ADMIN,
    where: "Menu « Documents réclamés »",
    keywords: ["réclamé", "produit par EODA", "liste", "réglage", "documents attendus"],
    body: [
      {
        kind: "paragraph",
        text:
          "Chaque type de document est soit « réclamé au client » (demandé sur le portail de chaque structure), soit « produit par EODA » (rédigé par le cabinet, jamais demandé). Le portail d'une structure n'affiche que les documents réclamés, plus ceux qui existent déjà pour elle.",
      },
      {
        kind: "note",
        tone: "warning",
        text:
          "Ce réglage s'applique à toutes les structures à la fois. Chaque changement est inscrit au journal. Les Réglages d'une fiche montrent la liste, mais ne la modifient pas.",
      },
    ],
  },
];
