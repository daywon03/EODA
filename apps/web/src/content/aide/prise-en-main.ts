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
          "Documents : la liste des pièces attendues, leur état, et l'historique des versions déposées.",
          "Analyse documentaire : chaque document déposé est lu automatiquement et confronté aux exigences (loi 2002-2 et référentiel HAS). Pour une structure accompagnée, EODA relit chaque analyse avant que la structure la voie.",
          "Auto-évaluation préparatoire : cotation des éléments d'évaluation (E.E.) chapitre par chapitre, par le cabinet. La structure en lit le résultat dans « Mon diagnostic ».",
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
      "Choisir son mot de passe avec le lien reçu par e-mail, se connecter, le changer, se déconnecter.",
    category: "PRISE_EN_MAIN",
    audiences: AUDIENCE_ALL,
    where: "Page de connexion · page « Changer mon mot de passe »",
    keywords: ["connexion", "login", "mot de passe", "compte", "déconnexion", "sécurité"],
    body: [
      {
        kind: "steps",
        items: [
          "Ouvrez l'e-mail d'invitation et cliquez sur « Choisir mon mot de passe ». Ce lien est personnel, valable 3 jours, et ne sert qu'une fois : aucun mot de passe ne vous est envoyé.",
          "Choisissez votre mot de passe, deux fois. Il doit faire au moins 12 caractères ; une phrase de passe longue protège mieux qu'un mot court compliqué.",
          "Ouvrez ensuite la page de connexion et saisissez votre adresse e-mail et ce mot de passe.",
          "Pour le changer plus tard : page « Changer mon mot de passe ». Après validation, vous êtes déconnecté sur cet appareil comme sur les autres ; reconnectez-vous avec le nouveau.",
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
          "Pour vous déconnecter : côté cabinet, l'icône de sortie à côté de votre nom, en bas du menu ; côté structure, « Se déconnecter » dans le menu de votre compte.",
      },
      {
        kind: "note",
        tone: "warning",
        text:
          "Lien expiré ou déjà utilisé, ou mot de passe oublié : demandez à EODA de réinitialiser votre mot de passe (EODAconseil@outlook.com). Vous recevrez un nouveau lien ; personne d'autre que vous ne connaîtra votre mot de passe.",
      },
    ],
  },
];
