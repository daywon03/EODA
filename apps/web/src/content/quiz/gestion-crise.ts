import type { QuizModule } from "./types";

// Quiz « Gestion de crise » — PROVISOIRE, à valider par Sandrine.
// Sources : context/11 Partie B §5 (procédure P4 PCA / gestion de crise, annuaire de
// crise, plan bleu) ; context/10 §DIPC (numéros d'urgence 17, 112, 114) ; référentiel HAS
// critères 3.14.1 et 3.14.2.
export const GESTION_CRISE_QUIZ: QuizModule = {
  code: "GESTION_CRISE",
  version: 1,
  title: "Gestion de crise",
  shortTitle: "Gestion de crise",
  pictogram: "siren",
  passThreshold: 0.8,
  retestMonths: 6,
  provisional: true,
  sources: [
    "context/11-modes-operatoires-sandrine.md — Partie B §5, procédure P4 (PCA, annuaire de crise)",
    "context/10-regles-mise-en-conformite.md — DIPC, numéros d'urgence",
    "context/02-referentiel-has.md — critères 3.14.1 et 3.14.2",
  ],
  questions: [
    {
      id: "gc-1",
      prompt: "Le PCA, c'est…",
      choices: [
        { id: "a", label: "Un formulaire de congé" },
        { id: "b", label: "Le plan de continuité d'activité en cas de crise" },
        { id: "c", label: "Un planning de ménage" },
      ],
      correctChoiceId: "b",
      explanation: "Le plan de continuité d'activité (PCA) dit comment continuer les aides pendant une crise.",
    },
    {
      id: "gc-2",
      prompt: "Pendant une canicule, à qui pensez-vous en premier ?",
      choices: [
        { id: "a", label: "Aux personnes les plus fragiles" },
        { id: "b", label: "À personne en particulier" },
        { id: "c", label: "Aux personnes en vacances" },
      ],
      correctChoiceId: "a",
      explanation: "En crise, on visite d'abord les personnes prioritaires, les plus fragiles.",
    },
    {
      id: "gc-3",
      prompt: "Il fait très chaud. Que faites-vous chez la personne ?",
      choices: [
        { id: "a", label: "J'ouvre grand les volets en plein soleil" },
        { id: "b", label: "Je ne change rien" },
        { id: "c", label: "Je la fais boire et je garde la pièce au frais" },
      ],
      correctChoiceId: "c",
      explanation: "Faire boire et rafraîchir le logement protège la personne de la chaleur.",
    },
    {
      id: "gc-4",
      prompt: "Vous ne pouvez pas aller à votre intervention. Que faire ?",
      choices: [
        { id: "a", label: "Prévenir la structure le plus tôt possible" },
        { id: "b", label: "Ne rien dire" },
        { id: "c", label: "Demander à un voisin d'y aller" },
      ],
      correctChoiceId: "a",
      explanation: "Prévenir vite permet à la structure de trouver une solution pour la personne.",
    },
    {
      id: "gc-5",
      prompt: "Où trouver les numéros à appeler en cas de crise ?",
      choices: [
        { id: "a", label: "Sur Internet, au hasard" },
        { id: "b", label: "Dans l'annuaire de crise de la structure" },
        { id: "c", label: "Nulle part" },
      ],
      correctChoiceId: "b",
      explanation: "L'annuaire de crise rassemble les contacts utiles, il est tenu à jour.",
    },
    {
      id: "gc-6",
      prompt: "Une personne est en danger immédiat. Vous appelez…",
      choices: [
        { id: "a", label: "Votre famille" },
        { id: "b", label: "Personne, vous attendez" },
        { id: "c", label: "Le 112, puis votre structure" },
      ],
      correctChoiceId: "c",
      explanation: "En urgence, on appelle les secours (112), puis on prévient la structure.",
    },
    {
      id: "gc-7",
      prompt: "Pendant une crise, qui donne les consignes ?",
      choices: [
        { id: "a", label: "La structure, selon son plan de crise" },
        { id: "b", label: "Chacun fait comme il veut" },
        { id: "c", label: "La personne accompagnée" },
      ],
      correctChoiceId: "a",
      explanation: "La structure applique son plan de crise et informe les équipes.",
    },
  ],
};
