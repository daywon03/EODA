import type { QuizModule } from "./types";

// Quiz « Risque infectieux » — v2, PROVISOIRE, à valider par Sandrine.
// Le manuel d'évaluation HAS (juillet 2025) a bien un objectif dédié, 3.7, applicable
// à TOUS les ESSMS dont les services à domicile, mais au niveau STANDARD (aucun
// impératif) : 3.7.1 (règles d'hygiène communiquées par la structure), 3.7.2 (les
// professionnels repèrent les situations à risque et appliquent les règles — mains,
// déchets, linge), 3.7.3 (sensibilisation). Le manuel ne détaille PAS les gestes : les
// questions sur le gel, les gants et la toux reprennent les précautions d'hygiène de
// base, hors manuel, à confronter au protocole de la structure.
export const RISQUE_INFECTIEUX_QUIZ: QuizModule = {
  code: "RISQUE_INFECTIEUX",
  version: 2,
  title: "Risque infectieux",
  shortTitle: "Risque infectieux",
  pictogram: "droplets",
  passThreshold: 0.8,
  retestMonths: 6,
  provisional: true,
  sources: [
    "Manuel HAS juillet 2025 — critère 3.7.1 stratégie et règles d'hygiène (standard, tous ESSMS dont SAD), p. 134",
    "Manuel HAS juillet 2025 — critère 3.7.2 actions des professionnels (standard, SAD), p. 135",
    "Manuel HAS juillet 2025 — critère 3.7.3 sensibilisation (standard, SAD), p. 136",
    "Précautions d'hygiène de base — hors manuel, à confronter au protocole de la structure",
  ],
  questions: [
    {
      id: "ri-v2-1",
      prompt: "Quand vous lavez-vous les mains ?",
      choices: [
        { id: "a", label: "Seulement en partant" },
        { id: "b", label: "Avant et après chaque soin" },
        { id: "c", label: "Une fois par jour" },
      ],
      correctChoiceId: "b",
      explanation: "Des mains propres avant et après chaque soin évitent de passer des microbes.",
      pictogram: "droplets",
      source:
        "Manuel HAS juillet 2025, critère 3.7.2, p. 135 — observation du « respect des règles d'hygiène (…) Exemples : hygiène des mains » ; moment précis : précautions de base, hors manuel.",
    },
    {
      id: "ri-v2-2",
      prompt: "Le gel pour les mains s'utilise sur des mains…",
      choices: [
        { id: "a", label: "Sales et mouillées" },
        { id: "b", label: "Propres et sèches" },
        { id: "c", label: "Avec des gants" },
      ],
      correctChoiceId: "b",
      explanation: "Si vos mains sont sales, lavez-les d'abord à l'eau et au savon.",
      pictogram: "hand",
      source:
        "Précautions d'hygiène de base, hors manuel ; manuel HAS juillet 2025, critère 3.7.1, p. 134 (règles d'hygiène des mains communiquées par la structure).",
    },
    {
      id: "ri-v2-3",
      prompt: "Après un soin avec des gants, que faites-vous ?",
      choices: [
        { id: "a", label: "Je garde les gants pour la suite" },
        { id: "b", label: "Je les range dans ma poche" },
        { id: "c", label: "Je jette les gants et je me lave les mains" },
      ],
      correctChoiceId: "c",
      explanation: "Des gants servent pour un seul soin. Ensuite, on se lave les mains.",
      pictogram: "trash-2",
      source: "Précautions d'hygiène de base, hors manuel — à confronter au protocole de la structure.",
    },
    {
      id: "ri-v2-4",
      prompt: "Vous toussez. Que faites-vous ?",
      choices: [
        { id: "a", label: "Je mets un masque et je tousse dans mon coude" },
        { id: "b", label: "Je tousse dans ma main" },
        { id: "c", label: "Rien de spécial" },
      ],
      correctChoiceId: "a",
      explanation: "Le masque et le coude protègent la personne, souvent fragile.",
      pictogram: "wind",
      source: "Précautions d'hygiène de base, hors manuel — à confronter au protocole de la structure.",
    },
    {
      id: "ri-v2-5",
      prompt: "La personne a de la fièvre et la diarrhée. Que faites-vous ?",
      choices: [
        { id: "a", label: "Rien, ça va passer" },
        { id: "b", label: "Je lui donne un de mes médicaments" },
        { id: "c", label: "Je préviens le service" },
      ],
      correctChoiceId: "c",
      explanation: "Ce sont peut-être des signes d'infection. Le service organise la suite.",
      pictogram: "thermometer",
      source:
        "Manuel HAS juillet 2025, critère 3.7.2, p. 135 — « Les professionnels savent identifier les situations nécessitant une gestion spécifique du risque infectieux » ; outils : « fiche de signalement, d'alerte ».",
    },
    {
      id: "ri-v2-6",
      prompt: "Les déchets de soins sales vont…",
      choices: [
        { id: "a", label: "Dans un sac fermé, selon la consigne du service" },
        { id: "b", label: "Par terre, en attendant" },
        { id: "c", label: "Dans le bac de recyclage" },
      ],
      correctChoiceId: "a",
      explanation: "Un sac bien fermé évite de salir le logement et de contaminer les proches.",
      pictogram: "trash-2",
      source:
        "Manuel HAS juillet 2025, critère 3.7.2, p. 135 — observation des règles d'hygiène, « Exemples : (…) DASRI » ; critère 3.7.1, p. 134 (règles par domaine, dont DASRI).",
    },
    {
      id: "ri-v2-7",
      prompt: "Où trouver les règles d'hygiène du service ?",
      choices: [
        { id: "a", label: "Il n'y en a pas" },
        { id: "b", label: "Dans les consignes écrites du service" },
        { id: "c", label: "Chacun fait à sa façon" },
      ],
      correctChoiceId: "b",
      explanation: "Le service écrit ses règles d'hygiène et les donne à l'équipe. Demandez-les.",
      pictogram: "book-open",
      source:
        "Manuel HAS juillet 2025, critère 3.7.1, p. 134 — « L'ESSMS communique sur les règles d'hygiène et de prévention du risque infectieux » (procédures, conduite à tenir, plaquettes, affichage).",
    },
  ],
};
