import type { QuizModule } from "./types";

// Quiz « Bientraitance » — v2, PROVISOIRE, à valider par Sandrine avant usage réel.
// Réécrit sur le manuel d'évaluation HAS (juillet 2025), chapitre 2 « Les
// professionnels » : critères évalués en entretien avec les professionnels (2.2.2 à
// 2.2.5, 2.10.2) et 2.2.7 (l'ESSMS sensibilise à la confidentialité). 2.2.1 (liberté
// d'aller et venir) n'est PAS repris : son champ d'application est « Établissement »,
// il ne vise pas un service à domicile. Les gestes précis (expliquer le soin, fermer
// la porte…) illustrent les « pratiques » que le manuel demande de connaître sans les
// lister : ils sont à confirmer par Sandrine.
export const BIENTRAITANCE_QUIZ: QuizModule = {
  code: "BIENTRAITANCE",
  version: 2,
  title: "Bientraitance",
  shortTitle: "Bientraitance",
  pictogram: "heart",
  passThreshold: 0.8,
  retestMonths: 6,
  provisional: true,
  sources: [
    "Manuel HAS juillet 2025 — critère 2.2.2 dignité et intégrité (impératif, tous ESSMS dont SAD), p. 80",
    "Manuel HAS juillet 2025 — critère 2.2.3 vie privée et intimité (impératif, SAD), p. 81",
    "Manuel HAS juillet 2025 — critère 2.2.4 opinion, croyances (impératif, SAD), p. 82",
    "Manuel HAS juillet 2025 — critère 2.2.5 droit à l'image (impératif, SAD), p. 83",
    "Manuel HAS juillet 2025 — critère 2.2.7 confidentialité (impératif, SAD), p. 85",
    "Manuel HAS juillet 2025 — critère 2.10.2 sécurisation des données (standard, SAD), p. 112",
    "Manuel HAS juillet 2025 — critère 3.1.1 définition commune de la bientraitance (standard, SAD), p. 114",
    "context/10-regles-mise-en-conformite.md — Droit à l'image, Maltraitance (définition de la bientraitance)",
  ],
  questions: [
    {
      id: "bt-v2-1",
      prompt: "La bientraitance, c'est d'abord…",
      choices: [
        { id: "a", label: "Faire vite pour finir à l'heure" },
        { id: "b", label: "Respecter la personne et ses choix" },
        { id: "c", label: "Décider à la place de la personne" },
      ],
      correctChoiceId: "b",
      explanation: "Être bientraitant, c'est respecter la personne, ce qu'elle veut et ce qu'elle choisit.",
      pictogram: "heart-handshake",
      source:
        "Manuel HAS juillet 2025, critère 3.1.1, p. 114 — « L'ESSMS partage une définition commune de la bientraitance avec l'ensemble des acteurs (…) professionnels » ; context/10 §Maltraitance (définition de la bientraitance).",
    },
    {
      id: "bt-v2-2",
      prompt: "Pendant un soin, vous parlez à la personne. Pourquoi ?",
      choices: [
        { id: "a", label: "Pour lui expliquer ce que je fais" },
        { id: "b", label: "Je ne parle pas, pour aller plus vite" },
        { id: "c", label: "Je parle seulement à sa famille" },
      ],
      correctChoiceId: "a",
      explanation: "Expliquer chaque geste respecte la dignité de la personne et la rassure.",
      pictogram: "message-circle",
      source:
        "Manuel HAS juillet 2025, critère 2.2.2, p. 80 — entretien avec les professionnels : « connaissent les pratiques qui favorisent le respect de la dignité et de l'intégrité ». Geste précis à valider.",
    },
    {
      id: "bt-v2-3",
      prompt: "Pendant la toilette, que faites-vous ?",
      choices: [
        { id: "a", label: "Je laisse la porte ouverte" },
        { id: "b", label: "Je demande au voisin de m'aider" },
        { id: "c", label: "Je ferme la porte et je couvre la personne" },
      ],
      correctChoiceId: "c",
      explanation: "Fermer la porte et couvrir le corps protège l'intimité de la personne.",
      pictogram: "shower-head",
      source:
        "Manuel HAS juillet 2025, critère 2.2.3, p. 81 — entretien avec les professionnels : « connaissent les pratiques qui favorisent le respect de la vie privée et de l'intimité ». Geste précis à valider.",
    },
    {
      id: "bt-v2-4",
      prompt: "La personne refuse sa toilette aujourd'hui. Que faites-vous ?",
      choices: [
        { id: "a", label: "Je la fais quand même" },
        { id: "b", label: "J'écoute, je propose plus tard et je préviens le service" },
        { id: "c", label: "Je pars sans rien dire" },
      ],
      correctChoiceId: "b",
      explanation: "On respecte le refus. On cherche une autre solution et on prévient le service.",
      pictogram: "hand",
      source:
        "Manuel HAS juillet 2025, critère 2.2.2, p. 80 — respect de la dignité et de l'intégrité (pratiques à connaître et à mettre en œuvre). Conduite précise à valider.",
    },
    {
      id: "bt-v2-5",
      prompt: "La personne a une religion différente de la vôtre. Vous…",
      choices: [
        { id: "a", label: "Respectez sa religion, sans donner votre avis" },
        { id: "b", label: "Essayez de la faire changer d'avis" },
        { id: "c", label: "Refusez d'aller chez elle" },
      ],
      correctChoiceId: "a",
      explanation: "Chacun est libre de ses idées et de ses croyances. On les respecte.",
      pictogram: "church",
      source:
        "Manuel HAS juillet 2025, critère 2.2.4, p. 82 — entretien avec les professionnels : « connaissent les pratiques qui favorisent le respect de la liberté d'opinion, des croyances et de la vie spirituelle ».",
    },
    {
      id: "bt-v2-6",
      prompt: "Pouvez-vous prendre la personne en photo ?",
      choices: [
        { id: "a", label: "Oui, si la famille le demande" },
        { id: "b", label: "Oui, toujours" },
        { id: "c", label: "Seulement si la personne a donné son accord" },
      ],
      correctChoiceId: "c",
      explanation: "Pas de photo ni de vidéo sans l'accord de la personne. On respecte son choix.",
      pictogram: "camera",
      source:
        "Manuel HAS juillet 2025, critère 2.2.5, p. 83 — « Les professionnels recueillent le choix de la personne (…) sur son droit à l'image » et « respectent le choix exprimé » ; context/10 §Droit à l'image (consentement libre et éclairé).",
    },
    {
      id: "bt-v2-7",
      prompt: "Un voisin demande des nouvelles de la santé de la personne. Vous…",
      choices: [
        { id: "a", label: "Ne dites rien sur sa santé ni sur sa vie" },
        { id: "b", label: "Racontez tout, il connaît bien la personne" },
        { id: "c", label: "Lui montrez le cahier de liaison" },
      ],
      correctChoiceId: "a",
      explanation: "Ce que vous savez sur la personne reste secret. Vous n'en parlez qu'au service.",
      pictogram: "lock",
      source:
        "Manuel HAS juillet 2025, critère 2.2.7, p. 85 — « L'ESSMS (…) sensibilise les professionnels au respect des règles de confidentialité et de protection des informations » ; critère 2.10.2, p. 112.",
    },
    {
      id: "bt-v2-8",
      prompt: "Votre mot de passe pour l'outil du service, vous…",
      choices: [
        { id: "a", label: "Le prêtez à une collègue" },
        { id: "b", label: "Le gardez pour vous seul" },
        { id: "c", label: "L'écrivez sur la porte du frigo" },
      ],
      correctChoiceId: "b",
      explanation: "Le mot de passe est personnel. Il protège les informations des personnes.",
      pictogram: "key-round",
      source:
        "Manuel HAS juillet 2025, critère 2.10.2, p. 112 — « Les professionnels connaissent les règles de sécurisation des données » ; observation : « utilisation des identifiants et mots de passe personnels ».",
    },
  ],
};
