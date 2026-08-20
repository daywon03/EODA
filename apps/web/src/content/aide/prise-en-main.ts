import { AUDIENCE_ALL, type HelpArticle } from "./types";

// Articles ouverts à TOUS les comptes authentifiés — la prise en main n'est
// jamais conditionnée à l'offre souscrite
// (context/07-outil-pilotage-missions.md §12.5, call du 16/08/2026).

export const PRISE_EN_MAIN_ARTICLES: readonly HelpArticle[] = [
  {
    slug: "a-quoi-sert-la-plateforme",
    title: "À quoi sert la plateforme EODA",
    summary:
      "Ce que fait l'outil, ce qu'il ne fait pas, et le vocabulaire employé dans les écrans.",
    category: "PRISE_EN_MAIN",
    audiences: AUDIENCE_ALL,
    where: "Partout — bouton « Aide » en haut à droite de l'écran",
    keywords: ["présentation", "HAS", "ESSMS", "SAD", "Synaé", "démarrage"],
    body: [
      {
        kind: "paragraph",
        text:
          "La plateforme accompagne un ESSMS — ici un SAD, Service Autonomie à Domicile — dans sa préparation à l'évaluation qualité HAS. Elle sert à trois choses : rassembler les documents attendus, en analyser le contenu face aux exigences, et préparer la cotation des critères du référentiel.",
      },
      {
        kind: "list",
        items: [
          "Checklist documentaire : la liste des pièces attendues, leur statut, et l'historique des versions déposées.",
          "Analyse documentaire : chaque document déposé est lu automatiquement et confronté aux exigences (loi 2002-2 et référentiel HAS).",
          "Auto-évaluation préparatoire : cotation des éléments d'évaluation (E.E.) chapitre par chapitre, réservée aux comptes du cabinet.",
        ],
      },
      {
        kind: "note",
        tone: "warning",
        text:
          "Ce n'est pas une évaluation HAS officielle. L'évaluation officielle se déroule sur Synaé, avec un organisme évaluateur accrédité COFRAC, indépendant du conseil. Ce que produit la plateforme est un diagnostic et une auto-évaluation préparatoire, à usage interne.",
      },
      {
        kind: "paragraph",
        text:
          "Le vocabulaire des écrans est celui du référentiel : critère, critère impératif, élément d'évaluation (E.E.), chapitre, cotation 1 / 2 / 3 / 4 / ★ / NC / RI. Le système Qualiscope (A/B/C/D) n'est jamais utilisé pour coter : c'est un affichage public agrégé, pas une échelle de cotation.",
      },
    ],
  },
  {
    slug: "se-connecter-et-changer-son-mot-de-passe",
    title: "Se connecter et changer son mot de passe",
    summary:
      "Première connexion avec le mot de passe temporaire, changement obligatoire, déconnexion.",
    category: "PRISE_EN_MAIN",
    audiences: AUDIENCE_ALL,
    where: "Page de connexion · page « Changer mon mot de passe »",
    keywords: ["connexion", "login", "mot de passe", "compte", "déconnexion", "sécurité"],
    body: [
      {
        kind: "steps",
        items: [
          "Ouvrez la page de connexion et saisissez votre adresse email et le mot de passe qui vous a été communiqué par EODA Conseil.",
          "À la première connexion, la plateforme vous conduit d'office sur la page « Changer mon mot de passe » : aucun autre écran n'est accessible tant que le mot de passe temporaire n'a pas été remplacé.",
          "Saisissez le mot de passe actuel, puis deux fois le nouveau. Il doit faire au moins 12 caractères ; une phrase de passe longue protège mieux qu'un mot court compliqué.",
          "Après validation, vous êtes déconnecté sur cet appareil comme sur les autres. Reconnectez-vous avec le nouveau mot de passe.",
        ],
      },
      {
        kind: "paragraph",
        text:
          "Le mot de passe peut être changé à tout moment, pas seulement à la première connexion : la même page reste accessible et se comporte de la même façon.",
      },
      {
        kind: "note",
        tone: "info",
        text:
          "Le bouton de déconnexion est l'icône de sortie, en haut à droite de l'écran, à côté de votre nom.",
      },
      {
        kind: "note",
        tone: "warning",
        text:
          "Le mot de passe temporaire n'est affiché qu'une seule fois, au moment où votre consultant crée le compte. S'il est perdu, il faut en générer un nouveau : écrivez à EODAconseil@outlook.com.",
      },
    ],
  },
];
