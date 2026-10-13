import type { QuizModule } from "./types";

// Quiz « Risque infectieux » — PROVISOIRE, à valider par Sandrine.
// Sources : le risque infectieux n'est pas détaillé dans context/10 ni context/11 au-delà
// du « protocole risque infectieux » attendu ; les questions s'en tiennent aux
// précautions d'hygiène de base, générales et non contestables (hygiène des mains,
// gants, toux, déchets). Référentiel HAS : chapitre 3, prévention des risques.
export const RISQUE_INFECTIEUX_QUIZ: QuizModule = {
  code: "RISQUE_INFECTIEUX",
  version: 1,
  title: "Risque infectieux",
  shortTitle: "Risque infectieux",
  pictogram: "droplets",
  passThreshold: 0.8,
  retestMonths: 6,
  provisional: true,
  sources: [
    "context/11-modes-operatoires-sandrine.md — Partie B, critères standards « prévention des risques »",
    "Précautions d'hygiène de base (pratiques générales, à confronter au protocole de la structure)",
  ],
  questions: [
    {
      id: "ri-1",
      prompt: "Quand vous lavez-vous les mains ?",
      choices: [
        { id: "a", label: "Seulement en partant" },
        { id: "b", label: "Avant et après chaque soin" },
        { id: "c", label: "Une fois par jour" },
      ],
      correctChoiceId: "b",
      explanation: "Les mains propres avant et après chaque soin évitent de transmettre des microbes.",
    },
    {
      id: "ri-2",
      prompt: "Le gel hydroalcoolique s'utilise sur des mains…",
      choices: [
        { id: "a", label: "Sales et mouillées" },
        { id: "b", label: "Avec des gants" },
        { id: "c", label: "Visiblement propres et sèches" },
      ],
      correctChoiceId: "c",
      explanation: "Sur des mains sales, on les lave d'abord à l'eau et au savon.",
    },
    {
      id: "ri-3",
      prompt: "Après un soin avec des gants, que faites-vous ?",
      choices: [
        { id: "a", label: "Je jette les gants et je me lave les mains" },
        { id: "b", label: "Je garde les gants pour la suite" },
        { id: "c", label: "Je les range dans ma poche" },
      ],
      correctChoiceId: "a",
      explanation: "Des gants servent pour un seul soin, puis on se lave les mains.",
    },
    {
      id: "ri-4",
      prompt: "Vous toussez. Que faites-vous ?",
      choices: [
        { id: "a", label: "Je tousse dans ma main" },
        { id: "b", label: "Je porte un masque et je tousse dans mon coude" },
        { id: "c", label: "Je ne fais rien de spécial" },
      ],
      correctChoiceId: "b",
      explanation: "Masque et coude protègent la personne accompagnée, souvent fragile.",
    },
    {
      id: "ri-5",
      prompt: "Bijoux et ongles longs pendant les soins, c'est…",
      choices: [
        { id: "a", label: "Sans risque" },
        { id: "b", label: "Conseillé" },
        { id: "c", label: "À éviter : les microbes s'y cachent" },
      ],
      correctChoiceId: "c",
      explanation: "Mains sans bijoux et ongles courts se lavent bien mieux.",
    },
    {
      id: "ri-6",
      prompt: "Les déchets de soins souillés vont…",
      choices: [
        { id: "a", label: "Dans un sac fermé, selon la consigne de la structure" },
        { id: "b", label: "Par terre en attendant" },
        { id: "c", label: "Dans le recyclage" },
      ],
      correctChoiceId: "a",
      explanation: "Des déchets bien fermés évitent de contaminer le logement et les proches.",
    },
    {
      id: "ri-7",
      prompt: "La personne a de la fièvre et une diarrhée. Que faites-vous ?",
      choices: [
        { id: "a", label: "Rien, cela passera" },
        { id: "b", label: "Je préviens ma structure" },
        { id: "c", label: "Je lui donne un médicament à moi" },
      ],
      correctChoiceId: "b",
      explanation: "Un signe d'infection se transmet à la structure, qui organise la suite.",
    },
  ],
};
