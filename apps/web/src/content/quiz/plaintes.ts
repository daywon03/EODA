import type { QuizModule } from "./types";

// Quiz « Plaintes et réclamations » — v2, PROVISOIRE, à valider par Sandrine.
// Réécrit sur le manuel d'évaluation HAS (juillet 2025) : objectifs 3.12 (plaintes)
// et 3.13 (événements indésirables), tous IMPÉRATIFS pour un SAD sauf 3.13.4. Les
// critères évalués en entretien avec les professionnels sont 3.12.3 (analyse en
// équipe) et 3.13.3 (déclarer, analyser) ; les autres décrivent l'organisation de la
// structure. Les délais (le jour même, accusé de réception sous 24 h, traitement sous
// 10 jours) ne sont PAS dans le manuel : ce sont ceux de la procédure dite par
// Sandrine le 07/10 (context/10).
export const PLAINTES_QUIZ: QuizModule = {
  code: "PLAINTES",
  version: 2,
  title: "Plaintes et réclamations",
  shortTitle: "Plaintes",
  pictogram: "message",
  passThreshold: 0.8,
  retestMonths: 6,
  provisional: true,
  sources: [
    "Manuel HAS juillet 2025 — critère 3.12.1 recueil et traitement des plaintes (impératif, tous ESSMS dont SAD), p. 151",
    "Manuel HAS juillet 2025 — critère 3.12.2 retour à la personne (impératif, SAD), p. 152",
    "Manuel HAS juillet 2025 — critère 3.12.3 analyse en équipe (impératif, SAD), p. 153",
    "Manuel HAS juillet 2025 — critère 3.13.1 recueil des événements indésirables (impératif, SAD), p. 154",
    "Manuel HAS juillet 2025 — critère 3.13.3 déclaration et analyse en équipe (impératif, SAD), p. 156",
    "context/10-regles-mise-en-conformite.md — Procédure plaintes (07/10), Événements indésirables (registre)",
    "context/11-modes-operatoires-sandrine.md — Partie B, procédures P1 et P2",
  ],
  questions: [
    {
      id: "pl-v2-1",
      prompt: "Une personne accompagnée a-t-elle le droit de se plaindre ?",
      choices: [
        { id: "a", label: "Non, jamais" },
        { id: "b", label: "Seulement par lettre recommandée" },
        { id: "c", label: "Oui, c'est son droit" },
      ],
      correctChoiceId: "c",
      explanation: "Se plaindre est un droit. Le service doit le dire à la personne.",
      pictogram: "message-circle",
      source:
        "Manuel HAS juillet 2025, critère 3.12.1, p. 151 — « L'ESSMS organise le recueil des plaintes et des réclamations » ; context/10 §Plaintes et réclamations (informer du droit).",
    },
    {
      id: "pl-v2-2",
      prompt: "La personne se plaint à vous, à l'oral. Que faites-vous ?",
      choices: [
        { id: "a", label: "Je le dis au service le jour même" },
        { id: "b", label: "Rien, ce n'est pas écrit" },
        { id: "c", label: "J'attends qu'elle se plaigne encore" },
      ],
      correctChoiceId: "a",
      explanation: "Une plainte, même à l'oral, se transmet au service le jour même.",
      pictogram: "megaphone",
      source:
        "Manuel HAS juillet 2025, critère 3.12.1, p. 151 — recueil des plaintes ; délai « le jour même » : context/10 §Procédure plaintes (07/10), hors manuel.",
    },
    {
      id: "pl-v2-3",
      prompt: "Le service dit à la personne qu'il a reçu sa plainte. En combien de temps ?",
      choices: [
        { id: "a", label: "Un mois" },
        { id: "b", label: "24 heures" },
        { id: "c", label: "Jamais" },
      ],
      correctChoiceId: "b",
      explanation: "Le service envoie un accusé de réception sous 24 heures.",
      pictogram: "mail-check",
      source: "context/10 §Procédure plaintes (07/10) — « accusé de réception sous 24 h ». Délai hors manuel HAS.",
    },
    {
      id: "pl-v2-4",
      prompt: "La personne qui s'est plainte reçoit-elle une réponse ?",
      choices: [
        { id: "a", label: "Seulement si elle relance" },
        { id: "b", label: "Oui, le service lui répond par écrit" },
        { id: "c", label: "Non" },
      ],
      correctChoiceId: "b",
      explanation: "Le service traite la plainte et répond par écrit à la personne.",
      pictogram: "mail-check",
      source:
        "Manuel HAS juillet 2025, critère 3.12.2, p. 152 — « L'ESSMS assure un retour à la personne à l'origine de la réclamation ou de la plainte » ; context/10 §Procédure plaintes (réponse écrite, traitement sous 10 jours).",
    },
    {
      id: "pl-v2-5",
      prompt: "Pourquoi l'équipe parle-t-elle des plaintes ensemble ?",
      choices: [
        { id: "a", label: "Pour trouver un coupable" },
        { id: "b", label: "Pour rien" },
        { id: "c", label: "Pour trouver des solutions et éviter que ça recommence" },
      ],
      correctChoiceId: "c",
      explanation: "En équipe, on cherche ce qui n'a pas marché et on change ce qu'il faut.",
      pictogram: "users",
      source:
        "Manuel HAS juillet 2025, critère 3.12.3, p. 153 — « Les professionnels analysent les plaintes et les réclamations en équipe » et « mettent en place des actions correctives ».",
    },
    {
      id: "pl-v2-6",
      prompt: "La personne tombe pendant votre visite. Vous la déclarez au service ?",
      choices: [
        { id: "a", label: "Oui : c'est un événement indésirable" },
        { id: "b", label: "Non, si elle n'a pas mal" },
        { id: "c", label: "Non, c'est une plainte" },
      ],
      correctChoiceId: "a",
      explanation: "Un événement indésirable, c'est un fait qui n'aurait pas dû arriver. On le déclare.",
      pictogram: "triangle-alert",
      source:
        "Manuel HAS juillet 2025, critère 3.13.3, p. 156 — « Les professionnels déclarent les évènements indésirables ». La chute comme exemple : hors manuel, à valider.",
    },
    {
      id: "pl-v2-7",
      prompt: "Qui peut déclarer un événement indésirable ?",
      choices: [
        { id: "a", label: "Seulement la direction" },
        { id: "b", label: "Tout salarié qui le voit" },
        { id: "c", label: "Seulement la famille" },
      ],
      correctChoiceId: "b",
      explanation: "Chaque salarié peut et doit déclarer ce qu'il a vu. L'équipe l'analyse ensuite.",
      pictogram: "clipboard-list",
      source:
        "Manuel HAS juillet 2025, critère 3.13.3, p. 156 — « Les professionnels déclarent les évènements indésirables » et « les analysent en équipe » ; critère 3.13.1, p. 154 (support de déclaration).",
    },
    {
      id: "pl-v2-8",
      prompt: "Une plainte et un événement indésirable, c'est pareil ?",
      choices: [
        { id: "a", label: "Oui, exactement pareil" },
        { id: "b", label: "Non, ce sont deux choses différentes" },
        { id: "c", label: "On ne note ni l'un ni l'autre" },
      ],
      correctChoiceId: "b",
      explanation: "Le service les note séparément. Les deux servent à améliorer l'aide.",
      pictogram: "notebook-tabs",
      source:
        "Manuel HAS juillet 2025 — objectifs distincts 3.12 (plaintes, p. 151) et 3.13 (événements indésirables, p. 154) ; context/10 §Événements indésirables (registre qui distingue réclamation, EI et EIG).",
    },
  ],
};
