import type { SurveyScale, SurveyScaleCode, SurveyScaleOption } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// ÉCHELLES DE RÉPONSE.
//
// FALC3, SAT5 et leurs poids viennent de la grille de dépouillement v02 (EODA, 07/10)
// qui accompagne le questionnaire v1.0 du 30/09. « Ne se prononce pas » (NSP) est
// AJOUTÉ sur la tablette aux échelles qui n'ont pas de « Je ne sais pas » : une case
// laissée vide sur papier devient NSP à l'écran, exclue du calcul comme une case vide.
//
// Enquête du 21/10/2026 (dernière version de Sandrine) : chaque question garde les
// réponses ÉCRITES SUR LE PAPIER, d'où une échelle par jeu de réponses. Poids :
// réponse favorable 1, intermédiaire (« Un peu », « Parfois », « En partie ») 0,5,
// défavorable 0 ; « Je ne sais pas » et les réponses « pas concerné(e) » (« Je n'ai
// jamais fait de remarque », « Je n'en ai pas besoin », « Je n'ai pas mal »…) sont
// exclues du calcul. La grille v02 ne connaît pas ces questions : poids PROVISOIRES,
// à valider par Sandrine.
// ─────────────────────────────────────────────────────────────────────────────

const NSP = { choice: "NSP", label: "Ne se prononce pas", weight: null } as const;
const dontKnow = { choice: "NSP", label: "Je ne sais pas", weight: null } as const;
const yes = { choice: "TRES", label: "Oui", weight: 1 } as const;
const no = { choice: "PAS", label: "Non", weight: 0 } as const;
const aLittle = { choice: "PEU", label: "Un peu", weight: 0.5 } as const;
const sometimes = { choice: "PEU", label: "Parfois", weight: 0.5 } as const;
const partly = { choice: "PEU", label: "En partie", weight: 0.5 } as const;
const notConcerned = (label: string) => ({ choice: "NON_CONCERNE", label, weight: null }) as const;

function scale(code: SurveyScaleCode, options: readonly SurveyScaleOption[], isControl = false): SurveyScale {
  return { code, label: options.map((o) => o.label).join(" / "), isControl, options };
}

export const SURVEY_SCALES: Record<SurveyScaleCode, SurveyScale> = {
  // Facile à Lire et à Comprendre — 3 niveaux (questionnaire personne accompagnée).
  FALC3: scale("FALC3", [
    { choice: "TRES", label: "Oui, tout à fait", weight: 1 },
    { choice: "PEU", label: "Un peu", weight: 0.5 },
    { choice: "PAS", label: "Non, pas du tout", weight: 0 },
    NSP,
  ]),
  // Même échelle quand le papier propose lui-même « Je ne sais pas » (13 B, 14).
  FALC3_NSP: scale("FALC3_NSP", [
    { choice: "TRES", label: "Oui, tout à fait", weight: 1 },
    { choice: "PEU", label: "Un peu", weight: 0.5 },
    { choice: "PAS", label: "Non, pas du tout", weight: 0 },
    dontKnow,
  ]),
  // « Pendant un gros problème, vous a-t-on appelé(e) ? » — plus de « Un peu »
  // (remarque de Sandrine au test du 21/10), et l'événement peut ne pas être arrivé.
  CRISE: scale("CRISE", [yes, no, dontKnow, notConcerned("Cela ne m'est pas arrivé")]),
  // Famille et proches — 4 niveaux + « Non concerné ».
  SAT5: scale("SAT5", [
    { choice: "TRES", label: "Très satisfait(e)", weight: 1 },
    { choice: "PLUTOT", label: "Satisfait(e)", weight: 2 / 3 },
    { choice: "PEU", label: "Peu satisfait(e)", weight: 1 / 3 },
    { choice: "PAS", label: "Pas satisfait(e)", weight: 0 },
    notConcerned("Non concerné"),
    NSP,
  ]),
  // Indicateur de contrôle (personne à prévenir) : hors taux, « Non » et « Je ne sais
  // pas » appellent une mise à jour du dossier. Ordre du papier : Oui, Non, Je ne sais pas.
  CONTROLE: scale(
    "CONTROLE",
    [
      { choice: "TRES", label: "Oui", weight: null },
      { choice: "PAS", label: "Non", weight: null, alert: true },
      { choice: "NSP", label: "Je ne sais pas", weight: null, alert: true },
    ],
    true
  ),
  OUI_UNPEU_NON: scale("OUI_UNPEU_NON", [yes, aLittle, no, NSP]),
  OUI_UNPEU_NON_NSP: scale("OUI_UNPEU_NON_NSP", [yes, aLittle, no, dontKnow]),
  OUI_UNPEU_NON_PAS_BESOIN: scale("OUI_UNPEU_NON_PAS_BESOIN", [yes, aLittle, no, notConcerned("Je n'en ai pas besoin")]),
  TOUJOURS_PARFOIS_JAMAIS: scale("TOUJOURS_PARFOIS_JAMAIS", [
    { choice: "TRES", label: "Oui, toujours", weight: 1 },
    sometimes,
    { choice: "PAS", label: "Non, jamais", weight: 0 },
    NSP,
  ]),
  CHAQUE_FOIS_PARFOIS_JAMAIS: scale("CHAQUE_FOIS_PARFOIS_JAMAIS", [
    { choice: "TRES", label: "Oui, à chaque fois", weight: 1 },
    sometimes,
    { choice: "PAS", label: "Non, jamais", weight: 0 },
    dontKnow,
  ]),
  OUI_EN_PARTIE_NON: scale("OUI_EN_PARTIE_NON", [yes, partly, no, NSP]),
  OUI_EN_PARTIE_NSP: scale("OUI_EN_PARTIE_NSP", [yes, partly, no, dontKnow]),
  OUI_PARFOIS_NSP: scale("OUI_PARFOIS_NSP", [yes, sometimes, no, dontKnow]),
  OUI_PARFOIS_NSP_NC: scale("OUI_PARFOIS_NSP_NC", [yes, sometimes, no, dontKnow, notConcerned("Non concerné")]),
  OUI_NON_NSP: scale("OUI_NON_NSP", [yes, no, dontKnow]),
  SOUVENT_PARFOIS_NON_NSP: scale("SOUVENT_PARFOIS_NON_NSP", [
    { choice: "TRES", label: "Oui, souvent", weight: 1 },
    sometimes,
    no,
    dontKnow,
  ]),
  REPONSE_REMARQUE: scale("REPONSE_REMARQUE", [yes, no, notConcerned("Je n'ai jamais fait de remarque")]),
  SUITE_DEMANDE: scale("SUITE_DEMANDE", [yes, aLittle, no, notConcerned("Je n'ai jamais demandé")]),
  SUITE_AVIS: scale("SUITE_AVIS", [yes, partly, no, notConcerned("Je n'ai jamais donné mon avis")]),
  // « Avez-vous besoin d'aide pour participer à la vie de votre ville ? » mesure un
  // BESOIN, pas une satisfaction : aucune réponse n'entre dans le taux. La répartition
  // reste lue (combien de personnes ont besoin d'aide).
  BESOIN_AIDE_VIE_SOCIALE: scale("BESOIN_AIDE_VIE_SOCIALE", [
    { choice: "TRES", label: "Oui", weight: null },
    { choice: "PAS", label: "Non", weight: null },
    notConcerned("Je n'en ai pas besoin"),
    dontKnow,
  ]),
  DOULEUR: scale("DOULEUR", [yes, sometimes, no, notConcerned("Je n'ai pas mal")]),
  ECOUTE: scale("ECOUTE", [
    { choice: "TRES", label: "Oui, je me sens écouté(e)", weight: 1 },
    sometimes,
    { choice: "PAS", label: "Non, je ne me sens pas écouté(e)", weight: 0 },
    NSP,
  ]),
};
