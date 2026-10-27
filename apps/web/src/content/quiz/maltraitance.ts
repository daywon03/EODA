import type { QuizModule } from "./types";

// Quiz « Prévention de la maltraitance » — v2, PROVISOIRE, à valider par Sandrine.
// Réécrit sur le manuel d'évaluation HAS (juillet 2025) : objectif 3.11 (3.11.1 et
// 3.11.2 impératifs, 3.11.3 standard — la sensibilisation « à la détection et au
// signalement », évaluée en entretien avec les professionnels) et 2.4.6 (abus de
// faiblesse). Le 3977 est désormais demandé : le manuel le cite p. 150 (références du
// critère 3.11.3), ce qui lève le « à vérifier » de context/10. Le premier geste reste
// INTERNE (context/10) : le manuel ne décrit pas la procédure de la structure.
export const MALTRAITANCE_QUIZ: QuizModule = {
  code: "MALTRAITANCE",
  version: 2,
  title: "Prévention de la maltraitance",
  shortTitle: "Maltraitance",
  pictogram: "shield",
  passThreshold: 0.8,
  retestMonths: 6,
  provisional: true,
  sources: [
    "Manuel HAS juillet 2025 — critère 3.11.1 plan de prévention (impératif, tous ESSMS dont SAD), p. 148",
    "Manuel HAS juillet 2025 — critère 3.11.2 traitement des signalements (impératif, SAD), p. 149",
    "Manuel HAS juillet 2025 — critère 3.11.3 détection et signalement (standard, SAD), p. 150",
    "Manuel HAS juillet 2025 — critère 2.4.6 harcèlement, abus de faiblesse (standard, SAD), p. 93",
    "context/10-regles-mise-en-conformite.md — Maltraitance (premier geste interne), Questions sensibles",
    "context/11-modes-operatoires-sandrine.md — Partie B, procédure P3 et référent interne maltraitance",
  ],
  questions: [
    {
      id: "mt-v2-1",
      prompt: "La maltraitance, est-ce seulement des coups ?",
      choices: [
        { id: "a", label: "Oui, seulement des coups" },
        { id: "b", label: "Seulement les cris" },
        { id: "c", label: "Non : aussi des mots, un oubli, de l'argent pris" },
      ],
      correctChoiceId: "c",
      explanation: "La maltraitance a plusieurs formes : gestes, paroles, oublis, argent.",
      pictogram: "triangle-alert",
      source:
        "Manuel HAS juillet 2025, critère 3.11.3, p. 150 — sensibilisation « à la détection » des faits de maltraitance et de violence ; context/10 §Maltraitance (toutes les formes de maltraitance).",
    },
    {
      id: "mt-v2-2",
      prompt: "Laisser la personne sans boire toute la journée, c'est…",
      choices: [
        { id: "a", label: "Un oubli grave : une forme de maltraitance" },
        { id: "b", label: "Normal si elle ne demande rien" },
        { id: "c", label: "Sans importance" },
      ],
      correctChoiceId: "a",
      explanation: "Ne pas répondre à un besoin de base, c'est de la négligence. C'est une maltraitance.",
      pictogram: "glass-water",
      source:
        "Manuel HAS juillet 2025, critère 3.11.3, p. 150 — détection des faits de maltraitance (référence : guide HAS 2024, fiche 1 « Reconnaître une situation potentielle de maltraitance ») ; context/10 §Maltraitance.",
    },
    {
      id: "mt-v2-3",
      prompt: "Un proche prend souvent de l'argent sur le compte de la personne. C'est…",
      choices: [
        { id: "a", label: "Une affaire de famille, pas la mienne" },
        { id: "b", label: "Peut-être un abus : j'en parle au service" },
        { id: "c", label: "Toujours normal" },
      ],
      correctChoiceId: "b",
      explanation: "Prendre l'argent d'une personne fragile peut être un abus. On en parle au service.",
      pictogram: "wallet",
      source:
        "Manuel HAS juillet 2025, critère 2.4.6, p. 93 — « Les professionnels évaluent les risques de harcèlement ou d'abus de faiblesse » ; context/10 §DIPEC, Questions sensibles (abus financier, procurations).",
    },
    {
      id: "mt-v2-4",
      prompt: "Vous avez un doute de maltraitance. Que faites-vous d'abord ?",
      choices: [
        { id: "a", label: "J'attends d'être sûr" },
        { id: "b", label: "J'appelle la police tout de suite" },
        { id: "c", label: "Je préviens mon responsable, dans le service" },
      ],
      correctChoiceId: "c",
      explanation: "Le premier geste se fait dans le service. Le service vérifie et décide de la suite.",
      pictogram: "user-round-check",
      source:
        "Manuel HAS juillet 2025, critère 3.11.2, p. 149 — « L'ESSMS analyse les signalements » ; critère 3.11.3, p. 150 (signalement) ; context/10 §Maltraitance : « le premier geste est toujours interne ».",
    },
    {
      id: "mt-v2-5",
      prompt: "Faut-il être sûr pour parler d'une maltraitance ?",
      choices: [
        { id: "a", label: "Non, un doute suffit pour en parler" },
        { id: "b", label: "Oui, il faut une preuve" },
        { id: "c", label: "Oui, il faut l'avoir vu deux fois" },
      ],
      correctChoiceId: "a",
      explanation: "Vous n'avez pas à prouver. Vous dites ce que vous avez vu. Le service vérifie.",
      pictogram: "megaphone",
      source:
        "Manuel HAS juillet 2025, critère 3.11.3, p. 150 — détection et signalement (référence : guide HAS 2024, fiche 3 « signaux faibles d'alerte ») ; context/10 §Maltraitance (la structure analyse et oriente).",
    },
    {
      id: "mt-v2-6",
      prompt: "Qui suit les situations de maltraitance dans le service ?",
      choices: [
        { id: "a", label: "Personne" },
        { id: "b", label: "Le référent maltraitance du service" },
        { id: "c", label: "La famille de la personne" },
      ],
      correctChoiceId: "b",
      explanation: "Le service nomme un référent. Il aide l'équipe et suit chaque situation.",
      pictogram: "users",
      source:
        "context/11 Partie B — procédure P3 et « nomination du référent interne maltraitance » ; manuel HAS juillet 2025, critère 3.1.2, p. 115 (« référents » cités parmi les outils de la démarche).",
    },
    {
      id: "mt-v2-7",
      prompt: "Le 3977, c'est…",
      choices: [
        { id: "a", label: "Le numéro des pompiers" },
        { id: "b", label: "Le numéro de la mairie" },
        { id: "c", label: "Le numéro national contre les maltraitances" },
      ],
      correctChoiceId: "c",
      explanation:
        "Le 3977 écoute sur les maltraitances des personnes âgées ou handicapées. Au travail, prévenez d'abord le service.",
      pictogram: "phone",
      source:
        "Manuel HAS juillet 2025, critère 3.11.3, p. 150 — autres références : « La Fédération 3977 contre les maltraitances envers les personnes en situation de vulnérabilité » ; context/10 §Maltraitance (premier geste interne).",
    },
    {
      id: "mt-v2-8",
      prompt: "Vous êtes à bout et vous parlez mal à la personne. Que faire ?",
      choices: [
        { id: "a", label: "Continuer, ça passera" },
        { id: "b", label: "En parler à mon responsable" },
        { id: "c", label: "Le cacher" },
      ],
      correctChoiceId: "b",
      explanation: "La fatigue est un risque de maltraitance. En parler permet de trouver de l'aide.",
      pictogram: "battery-low",
      source:
        "Manuel HAS juillet 2025, critère 3.11.1, p. 148 — « L'ESSMS identifie avec les professionnels les situations à risque pouvant générer des actes de maltraitance ». Lien fatigue → risque à valider.",
    },
  ],
};
