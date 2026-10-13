import type { QuizModule } from "./types";

// Quiz « Prévention de la maltraitance » — PROVISOIRE, à valider par Sandrine.
// Sources : context/10 §« Maltraitance » (toutes les formes, premier geste interne,
// signalement en second, abus financier) ; context/11 Partie B (procédure P3, référent
// maltraitance) ; référentiel HAS critères 3.11.1 et 3.11.2. Le numéro national n'est
// volontairement PAS demandé : il est marqué « à vérifier » dans context/10.
export const MALTRAITANCE_QUIZ: QuizModule = {
  code: "MALTRAITANCE",
  version: 1,
  title: "Prévention de la maltraitance",
  shortTitle: "Maltraitance",
  pictogram: "shield",
  passThreshold: 0.8,
  retestMonths: 6,
  provisional: true,
  sources: [
    "context/10-regles-mise-en-conformite.md — Maltraitance, Questions sensibles",
    "context/11-modes-operatoires-sandrine.md — Partie B §5, procédure P3 et référent maltraitance",
    "context/02-referentiel-has.md — critères 3.11.1 et 3.11.2",
  ],
  questions: [
    {
      id: "mt-1",
      prompt: "La maltraitance, est-ce seulement des coups ?",
      choices: [
        { id: "a", label: "Oui, seulement des coups" },
        { id: "b", label: "Non : paroles, négligence, argent, aussi" },
        { id: "c", label: "Seulement les cris" },
      ],
      correctChoiceId: "b",
      explanation: "La maltraitance prend plusieurs formes : physique, verbale, négligence, financière.",
    },
    {
      id: "mt-2",
      prompt: "Laisser une personne seule sans boire toute la journée, c'est…",
      choices: [
        { id: "a", label: "Normal si elle ne demande rien" },
        { id: "b", label: "Sans importance" },
        { id: "c", label: "Une négligence, donc une maltraitance" },
      ],
      correctChoiceId: "c",
      explanation: "Ne pas répondre à un besoin essentiel est une forme de maltraitance.",
    },
    {
      id: "mt-3",
      prompt: "Un proche se sert sur le compte de la personne. C'est…",
      choices: [
        { id: "a", label: "Un possible abus financier" },
        { id: "b", label: "Une affaire de famille, pas la mienne" },
        { id: "c", label: "Toujours normal" },
      ],
      correctChoiceId: "a",
      explanation: "L'abus financier est fréquent, souvent par procuration : il faut le signaler.",
    },
    {
      id: "mt-4",
      prompt: "Vous avez un doute de maltraitance. Premier geste ?",
      choices: [
        { id: "a", label: "Ne rien dire tant que ce n'est pas sûr" },
        { id: "b", label: "Appeler la police tout de suite" },
        { id: "c", label: "Prévenir votre responsable, en interne" },
      ],
      correctChoiceId: "c",
      explanation: "Le premier geste est toujours interne : la structure ouvre un dossier et oriente.",
    },
    {
      id: "mt-5",
      prompt: "Un doute, même petit, faut-il le dire ?",
      choices: [
        { id: "a", label: "Oui, toujours" },
        { id: "b", label: "Non, seulement si je suis certaine" },
        { id: "c", label: "Seulement à un collègue" },
      ],
      correctChoiceId: "a",
      explanation: "On transmet le doute : c'est la structure qui vérifie, pas vous seule.",
    },
    {
      id: "mt-6",
      prompt: "Qui suit les situations de maltraitance dans la structure ?",
      choices: [
        { id: "a", label: "Personne" },
        { id: "b", label: "Le référent maltraitance désigné" },
        { id: "c", label: "La famille" },
      ],
      correctChoiceId: "b",
      explanation: "La structure désigne un référent interne pour la maltraitance.",
    },
    {
      id: "mt-7",
      prompt: "Vous êtes épuisée et vous parlez mal à la personne. Que faire ?",
      choices: [
        { id: "a", label: "Continuer, ça passera" },
        { id: "b", label: "Le cacher" },
        { id: "c", label: "En parler à votre responsable" },
      ],
      correctChoiceId: "c",
      explanation: "La fatigue peut conduire à la maltraitance : en parler permet de trouver de l'aide.",
    },
  ],
};
