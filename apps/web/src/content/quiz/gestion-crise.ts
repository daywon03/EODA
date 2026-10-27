import type { QuizModule } from "./types";

// Quiz « Gestion de crise » — v2, PROVISOIRE, à valider par Sandrine.
// Réécrit sur le manuel d'évaluation HAS (juillet 2025) : objectif 3.14 (3.14.1 et
// 3.14.2 impératifs — plan défini AVEC les professionnels et communiqué en interne ;
// 3.14.3 et 3.14.4 standard, évalués en entretien avec les professionnels) et 2.8.1
// (repérer une situation de crise ou de rupture et alerter). Deux questions ne sont
// PAS sourcées dans le manuel : la priorité aux personnes fragiles (plan bleu cité,
// priorisation non décrite) et le 112 (context/10, numéros d'urgence du DIPEC).
export const GESTION_CRISE_QUIZ: QuizModule = {
  code: "GESTION_CRISE",
  version: 2,
  title: "Gestion de crise",
  shortTitle: "Gestion de crise",
  pictogram: "siren",
  passThreshold: 0.8,
  retestMonths: 6,
  provisional: true,
  sources: [
    "Manuel HAS juillet 2025 — critère 3.14.1 plan de crise et de continuité (impératif, tous ESSMS dont SAD), p. 158",
    "Manuel HAS juillet 2025 — critère 3.14.2 communication du plan (impératif, SAD), p. 159",
    "Manuel HAS juillet 2025 — critère 3.14.3 exercices et retours d'expérience (standard, SAD), p. 160",
    "Manuel HAS juillet 2025 — critère 2.8.1 situations de crise ou de rupture (standard, SAD), p. 105",
    "context/11-modes-operatoires-sandrine.md — Partie B, procédure P4 (PCA, annuaire de crise)",
    "context/10-regles-mise-en-conformite.md — DIPEC, numéros d'urgence",
  ],
  questions: [
    {
      id: "gc-v2-1",
      prompt: "Le plan de crise du service sert à…",
      choices: [
        { id: "a", label: "Ranger les dossiers" },
        { id: "b", label: "Continuer à aider les personnes pendant une crise" },
        { id: "c", label: "Organiser les congés" },
      ],
      correctChoiceId: "b",
      explanation: "Le plan dit comment continuer les aides pendant une crise : canicule, épidémie, panne.",
      pictogram: "clipboard-list",
      source:
        "Manuel HAS juillet 2025, critère 3.14.1, p. 158 — « plan de gestion de crise et de continuité de l'activité » ; exemples : « PCA, plan bleu, plan blanc ».",
    },
    {
      id: "gc-v2-2",
      prompt: "Qui prépare le plan de crise ?",
      choices: [
        { id: "a", label: "La direction, avec les salariés" },
        { id: "b", label: "La mairie, toute seule" },
        { id: "c", label: "Personne, on improvise" },
      ],
      correctChoiceId: "a",
      explanation: "Le plan se prépare avec les salariés. Votre avis compte.",
      pictogram: "users",
      source:
        "Manuel HAS juillet 2025, critère 3.14.1, p. 158 — « L'ESSMS définit, avec les professionnels, un plan de gestion de crise et de continuité de l'activité ».",
    },
    {
      id: "gc-v2-3",
      prompt: "Où trouver les numéros utiles en cas de crise ?",
      choices: [
        { id: "a", label: "Sur Internet, au hasard" },
        { id: "b", label: "Nulle part" },
        { id: "c", label: "Dans la liste de crise du service, tenue à jour" },
      ],
      correctChoiceId: "c",
      explanation: "Le service tient une liste des contacts utiles. Elle est mise à jour.",
      pictogram: "notebook-tabs",
      source:
        "Manuel HAS juillet 2025, critère 3.14.2, p. 159 — communication du plan en interne ; exemple : « liste des acteurs concernés et coordonnées à jour » ; context/11 P4 (annuaire de crise).",
    },
    {
      id: "gc-v2-4",
      prompt: "Le service organise un exercice de crise. Vous…",
      choices: [
        { id: "a", label: "Participez, puis dites ce qui a marché ou pas" },
        { id: "b", label: "Restez chez vous, ce n'est pas vrai" },
        { id: "c", label: "Regardez sans rien dire" },
      ],
      correctChoiceId: "a",
      explanation: "L'exercice sert à se préparer. Votre retour aide à améliorer le plan.",
      pictogram: "siren",
      source:
        "Manuel HAS juillet 2025, critère 3.14.3, p. 160 — « Les professionnels participent aux exercices de simulation » et « aux retours d'expérience pour améliorer le dispositif ».",
    },
    {
      id: "gc-v2-5",
      prompt: "La personne n'ouvre pas, ce n'est pas normal. Que faites-vous ?",
      choices: [
        { id: "a", label: "Je repars et je reviens demain" },
        { id: "b", label: "J'alerte le service tout de suite" },
        { id: "c", label: "Je n'en parle à personne" },
      ],
      correctChoiceId: "b",
      explanation: "Une situation inhabituelle peut être grave. On alerte le service sans attendre.",
      pictogram: "door-closed",
      source:
        "Manuel HAS juillet 2025, critère 2.8.1, p. 105 — « Les professionnels savent repérer les situations de crise ou de rupture dans l'accompagnement » ; liste des personnes-ressources à alerter.",
    },
    {
      id: "gc-v2-6",
      prompt: "Vous ne pouvez pas aller à votre intervention. Que faire ?",
      choices: [
        { id: "a", label: "Ne rien dire" },
        { id: "b", label: "Demander à un voisin d'y aller" },
        { id: "c", label: "Prévenir le service le plus tôt possible" },
      ],
      correctChoiceId: "c",
      explanation: "Prévenir vite permet au service de trouver une solution pour la personne.",
      pictogram: "phone",
      source:
        "Manuel HAS juillet 2025, critère 2.8.1, p. 105 — repérer les situations de rupture dans l'accompagnement ; critère 3.14.1, p. 158 (continuité de l'activité). Conduite précise à valider.",
    },
    {
      id: "gc-v2-7",
      prompt: "Pendant une canicule, qui aidez-vous en premier ?",
      choices: [
        { id: "a", label: "Les personnes les plus fragiles, selon le service" },
        { id: "b", label: "Les personnes les plus proches de chez moi" },
        { id: "c", label: "Personne en particulier" },
      ],
      correctChoiceId: "a",
      explanation: "En crise, le service dit qui aider en premier : les personnes les plus fragiles.",
      pictogram: "thermometer",
      source:
        "Manuel HAS juillet 2025, critère 3.14.1, p. 158 — plan bleu cité, mais la priorité aux personnes fragiles n'y est PAS décrite : hors manuel, à valider (context/11 P4).",
    },
    {
      id: "gc-v2-8",
      prompt: "Une personne est en danger grave, maintenant. Vous appelez…",
      choices: [
        { id: "a", label: "Votre famille" },
        { id: "b", label: "Le 112, puis le service" },
        { id: "c", label: "Personne, vous attendez" },
      ],
      correctChoiceId: "b",
      explanation: "En urgence, on appelle les secours (112). Ensuite, on prévient le service.",
      pictogram: "triangle-alert",
      source: "context/10 §DIPEC — numéros d'urgence 17, 112, 114. Hors manuel HAS, à valider.",
    },
  ],
};
