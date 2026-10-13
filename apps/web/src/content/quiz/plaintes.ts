import type { QuizModule } from "./types";

// Quiz « Plaintes et réclamations » — PROVISOIRE, à valider par Sandrine.
// Sources : context/10 §« Procédure plaintes (07/10) » (prise en compte le jour même,
// accusé de réception sous 24 h, traitement sous 10 jours, réponse écrite, archivage) et
// §« Plaintes et réclamations » (informer du droit) ; context/10 §« Événements
// indésirables » (registre distinguant réclamation, EI, EIG) ; référentiel HAS critères
// 3.12.1, 3.12.2 et 3.12.3 ; context/11 procédure P1.
export const PLAINTES_QUIZ: QuizModule = {
  code: "PLAINTES",
  version: 1,
  title: "Plaintes et réclamations",
  shortTitle: "Plaintes",
  pictogram: "message",
  passThreshold: 0.8,
  retestMonths: 6,
  provisional: true,
  sources: [
    "context/10-regles-mise-en-conformite.md — Procédure plaintes (07/10), Plaintes et réclamations",
    "context/10-regles-mise-en-conformite.md — Événements indésirables (registre)",
    "context/11-modes-operatoires-sandrine.md — Partie B, procédure P1",
    "context/02-referentiel-has.md — critères 3.12.1, 3.12.2, 3.12.3",
  ],
  questions: [
    {
      id: "pl-1",
      prompt: "Une personne accompagnée a-t-elle le droit de se plaindre ?",
      choices: [
        { id: "a", label: "Non, jamais" },
        { id: "b", label: "Seulement par lettre recommandée" },
        { id: "c", label: "Oui, c'est un droit" },
      ],
      correctChoiceId: "c",
      explanation: "Se plaindre est un droit : la structure doit l'en informer.",
    },
    {
      id: "pl-2",
      prompt: "Une personne vous fait une réclamation orale. Que faites-vous ?",
      choices: [
        { id: "a", label: "Je la transmets à la structure le jour même" },
        { id: "b", label: "Je l'oublie, ce n'est pas écrit" },
        { id: "c", label: "J'attends qu'elle se plaigne encore" },
      ],
      correctChoiceId: "a",
      explanation: "Toute réclamation, même orale, est transmise et prise en compte le jour même.",
    },
    {
      id: "pl-3",
      prompt: "La structure envoie un accusé de réception sous…",
      choices: [
        { id: "a", label: "Un mois" },
        { id: "b", label: "24 heures" },
        { id: "c", label: "Jamais" },
      ],
      correctChoiceId: "b",
      explanation: "La procédure prévoit un accusé de réception sous 24 heures.",
    },
    {
      id: "pl-4",
      prompt: "Où la réclamation est-elle notée ?",
      choices: [
        { id: "a", label: "Sur un papier volant" },
        { id: "b", label: "Nulle part" },
        { id: "c", label: "Dans le registre des réclamations" },
      ],
      correctChoiceId: "c",
      explanation: "Le registre garde la trace de chaque réclamation et de sa réponse.",
    },
    {
      id: "pl-5",
      prompt: "Une réclamation et un événement indésirable, c'est pareil ?",
      choices: [
        { id: "a", label: "Non, ce sont deux choses différentes" },
        { id: "b", label: "Oui, exactement pareil" },
        { id: "c", label: "On ne note ni l'un ni l'autre" },
      ],
      correctChoiceId: "a",
      explanation: "Le registre distingue réclamation, événement indésirable (EI) et EI grave.",
    },
    {
      id: "pl-6",
      prompt: "La personne reçoit-elle une réponse ?",
      choices: [
        { id: "a", label: "Seulement si elle relance" },
        { id: "b", label: "Oui, une réponse écrite" },
        { id: "c", label: "Non" },
      ],
      correctChoiceId: "b",
      explanation: "La structure traite la réclamation et répond par écrit.",
    },
    {
      id: "pl-7",
      prompt: "Pourquoi l'équipe parle-t-elle des réclamations ensemble ?",
      choices: [
        { id: "a", label: "Pour trouver un coupable" },
        { id: "b", label: "Pour rien" },
        { id: "c", label: "Pour améliorer l'accompagnement" },
      ],
      correctChoiceId: "c",
      explanation: "L'analyse en équipe sert à éviter que le problème revienne.",
    },
  ],
};
