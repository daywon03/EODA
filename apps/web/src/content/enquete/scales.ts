import type { SurveyScale, SurveyScaleCode } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// ÉCHELLES DE RÉPONSE — transcrites de la grille de dépouillement v02 (EODA, 07/10)
// qui accompagne le questionnaire v1.0 du 30/09 : mêmes options, mêmes poids.
//
// « Ne se prononce pas » (NSP) est AJOUTÉ sur la tablette à chaque échelle de
// satisfaction : le questionnaire papier dit « vous n'êtes pas obligé(e) de répondre
// à toutes les questions » — une case laissée vide sur papier devient NSP à l'écran,
// et reste exclue du calcul comme une case vide.
// ─────────────────────────────────────────────────────────────────────────────

const NSP = { choice: "NSP", label: "Ne se prononce pas", weight: null } as const;

export const SURVEY_SCALES: Record<SurveyScaleCode, SurveyScale> = {
  // Facile à Lire et à Comprendre — 3 niveaux (questionnaire personne accompagnée).
  FALC3: {
    code: "FALC3",
    label: "Échelle FALC 3 niveaux",
    isControl: false,
    options: [
      { choice: "TRES", label: "Oui, tout à fait", weight: 1 },
      { choice: "PEU", label: "Un peu", weight: 0.5 },
      { choice: "PAS", label: "Non, pas du tout", weight: 0 },
      NSP,
    ],
  },
  // Question « pendant un gros problème » : peut ne pas être arrivé.
  CRISE: {
    code: "CRISE",
    label: "Échelle situation vécue",
    isControl: false,
    options: [
      { choice: "TRES", label: "Oui", weight: 1 },
      { choice: "PEU", label: "Un peu", weight: 0.5 },
      { choice: "PAS", label: "Non", weight: 0 },
      { choice: "NON_CONCERNE", label: "Cela ne m'est pas arrivé", weight: null },
    ],
  },
  // Famille et proches — 4 niveaux + « Non concerné ».
  SAT5: {
    code: "SAT5",
    label: "Échelle de satisfaction",
    isControl: false,
    options: [
      { choice: "TRES", label: "Très satisfait(e)", weight: 1 },
      { choice: "PLUTOT", label: "Satisfait(e)", weight: 2 / 3 },
      { choice: "PEU", label: "Peu satisfait(e)", weight: 1 / 3 },
      { choice: "PAS", label: "Pas satisfait(e)", weight: 0 },
      { choice: "NON_CONCERNE", label: "Non concerné", weight: null },
      NSP,
    ],
  },
  // Indicateur de contrôle (personne à prévenir) : hors taux, « Non » et « Je ne sais
  // pas » appellent une mise à jour du dossier.
  CONTROLE: {
    code: "CONTROLE",
    label: "Indicateur de contrôle",
    isControl: true,
    options: [
      { choice: "TRES", label: "Oui", weight: null },
      { choice: "NSP", label: "Je ne sais pas", weight: null, alert: true },
      { choice: "PAS", label: "Non", weight: null, alert: true },
    ],
  },
};
