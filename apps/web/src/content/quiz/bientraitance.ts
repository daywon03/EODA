import type { QuizModule } from "./types";

// Quiz « Bientraitance » — PROVISOIRE, à valider par Sandrine avant usage réel.
// Sources : context/10 §« Maltraitance » (définition de la bientraitance, droit à
// l'image, questions sensibles, vocabulaire HAS) ; référentiel HAS critère 3.11.1.
export const BIENTRAITANCE_QUIZ: QuizModule = {
  code: "BIENTRAITANCE",
  version: 1,
  title: "Bientraitance",
  shortTitle: "Bientraitance",
  pictogram: "heart",
  passThreshold: 0.8,
  retestMonths: 6,
  provisional: true,
  sources: [
    "context/10-regles-mise-en-conformite.md — Maltraitance (définition de la bientraitance)",
    "context/10-regles-mise-en-conformite.md — Droit à l'image, Questions sensibles",
    "context/02-referentiel-has.md — critère 3.11.1",
  ],
  questions: [
    {
      id: "bt-1",
      prompt: "La bientraitance, c'est d'abord…",
      choices: [
        { id: "a", label: "Faire vite pour finir à l'heure" },
        { id: "b", label: "Respecter la personne et ses choix" },
        { id: "c", label: "Décider à la place de la personne" },
      ],
      correctChoiceId: "b",
      explanation: "La bientraitance part du respect de la personne et de ce qu'elle veut.",
    },
    {
      id: "bt-2",
      prompt: "Avant d'entrer chez la personne accompagnée, que faites-vous ?",
      choices: [
        { id: "a", label: "Je frappe et j'attends sa réponse" },
        { id: "b", label: "J'entre directement avec ma clé" },
        { id: "c", label: "J'appelle la famille" },
      ],
      correctChoiceId: "a",
      explanation: "Le domicile est le lieu de vie de la personne : on s'annonce.",
    },
    {
      id: "bt-3",
      prompt: "La personne refuse sa toilette aujourd'hui. Que faites-vous ?",
      choices: [
        { id: "a", label: "Je la fais quand même" },
        { id: "b", label: "Je pars sans rien dire" },
        { id: "c", label: "J'écoute, je propose plus tard, je préviens mon responsable" },
      ],
      correctChoiceId: "c",
      explanation: "On respecte le refus, on cherche une solution et on transmet l'information.",
    },
    {
      id: "bt-4",
      prompt: "Pouvez-vous prendre la personne en photo pour la famille ?",
      choices: [
        { id: "a", label: "Oui, si la famille le demande" },
        { id: "b", label: "Seulement si la personne a donné son accord" },
        { id: "c", label: "Oui, toujours" },
      ],
      correctChoiceId: "b",
      explanation: "Aucune photo sans l'accord libre et éclairé de la personne.",
    },
    {
      id: "bt-5",
      prompt: "Pendant les soins, comment parlez-vous à la personne ?",
      choices: [
        { id: "a", label: "Je lui explique ce que je fais" },
        { id: "b", label: "Je parle au téléphone en même temps" },
        { id: "c", label: "Je ne dis rien pour aller plus vite" },
      ],
      correctChoiceId: "a",
      explanation: "Expliquer chaque geste rassure la personne et respecte sa dignité.",
    },
    {
      id: "bt-6",
      prompt: "La personne veut garder ses habitudes de repas. Que faites-vous ?",
      choices: [
        { id: "a", label: "J'impose mes habitudes" },
        { id: "b", label: "Je respecte ses goûts et ses horaires" },
        { id: "c", label: "Je demande à un voisin" },
      ],
      correctChoiceId: "b",
      explanation: "Les habitudes de vie de la personne font partie de son accompagnement.",
    },
    {
      id: "bt-7",
      prompt: "Une question délicate se pose devant la famille. Que faire ?",
      choices: [
        { id: "a", label: "Ne jamais en reparler" },
        { id: "b", label: "Demander à la famille de répondre" },
        { id: "c", label: "La reposer plus tard à la personne seule" },
      ],
      correctChoiceId: "c",
      explanation: "Certaines questions se posent à la personne seule, sans pression.",
    },
  ],
};
