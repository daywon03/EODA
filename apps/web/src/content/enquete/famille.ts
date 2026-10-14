import type { SurveyTemplate } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// QUESTIONNAIRE « FAMILLE ET PROCHES » — transcrit du gabarit d'enquête de Sandrine
// (v1.0 du 30/09/2026, transcription V1.6 du rapport context2) : 14 questions,
// « Non concerné », avis libres, bloc RGPD. Le nom de la structure du pilote est
// remplacé par « le service ». Le « lien avec la personne accompagnée » (conjoint,
// enfant, autre) n'est pas repris : il n'entre dans aucun calcul et la tablette sait
// déjà qui répond (`respondentKind`).
// ─────────────────────────────────────────────────────────────────────────────

const sat = (id: string, prompt: string, shortLabel: string, tag?: "REGLEMENT" | "PCA") =>
  ({ kind: "SCALE", id, scale: "SAT5", prompt, shortLabel, ...(tag ? { tag } : {}) }) as const;

export const SURVEY_FAMILLE: SurveyTemplate = {
  code: "FAMILLE",
  version: 1,
  title: "Enquête de satisfaction — famille et proches",
  respondentLabel: "Un proche",
  intro:
    "Votre avis compte pour améliorer l'accompagnement de votre proche. Ce questionnaire prend environ 5 minutes.",
  questions: [
    sat("f01-relation", "La qualité de la relation entre les intervenants et votre proche", "Qualité de la relation intervenants / proche"),
    sat(
      "f02-dignite",
      "Le respect de la dignité, des habitudes et du rythme de vie de votre proche",
      "Respect de la dignité, des habitudes et du rythme de vie"
    ),
    sat(
      "f03-information-changement",
      "L'information reçue en cas de changement (horaire, intervenant, absence)",
      "Information en cas de changement"
    ),
    sat("f04-reactivite", "La rapidité de réponse en cas de problème ou de question", "Rapidité de réponse"),
    sat(
      "f05-adaptation",
      "La capacité du service à s'adapter à l'évolution des besoins de votre proche",
      "Adaptation à l'évolution des besoins"
    ),
    sat(
      "f06-ecoute",
      "L'écoute et la prise en compte de vos remarques ou réclamations",
      "Écoute des remarques et réclamations"
    ),
    sat("f07-confidentialite", "La confidentialité des informations concernant votre proche", "Confidentialité des informations"),
    sat("f08-qui-contacter", "Le fait de savoir clairement qui contacter en cas de besoin", "Savoir clairement qui contacter"),
    sat(
      "f09-continuite",
      "La continuité de l'accompagnement en cas d'absence d'un intervenant",
      "Continuité en cas d'absence d'un intervenant"
    ),
    sat(
      "f10-plan-crise",
      "L'information reçue sur le plan de gestion de crise du service (canicule, épidémie, intempéries…)",
      "Information sur le plan de gestion de crise",
      "PCA"
    ),
    sat(
      "f11-situation-exceptionnelle",
      "La réactivité du service lors d'une situation exceptionnelle déjà vécue (nouvelles, information, reprise)",
      "Réactivité lors d'une situation exceptionnelle",
      "PCA"
    ),
    {
      kind: "SCALE",
      id: "f12-coordonnees",
      scale: "CONTROLE",
      prompt: "Vos coordonnées (personne à prévenir) sont-elles à jour auprès du service ?",
      shortLabel: "Coordonnées de la personne à prévenir à jour",
      tag: "CONTROLE_DOSSIER",
    },
    sat(
      "f13-reglement",
      "La clarté et la pertinence des règles du service (règlement de fonctionnement)",
      "Clarté du règlement de fonctionnement",
      "REGLEMENT"
    ),
    {
      kind: "TEXT",
      id: "f13b-regle-proposee",
      prompt: "Souhaitez-vous proposer une modification ou un ajout à ces règles ?",
      shortLabel: "Propositions sur le règlement de fonctionnement",
      feedsRuleProposals: true,
    },
    sat("f14-global", "Votre satisfaction globale à l'égard du service", "Satisfaction globale"),
    { kind: "TEXT", id: "f15-fonctionne-bien", prompt: "Qu'est-ce qui fonctionne particulièrement bien ?", shortLabel: "Ce qui fonctionne bien" },
    { kind: "TEXT", id: "f16-ameliorer", prompt: "Qu'est-ce qui pourrait être amélioré ?", shortLabel: "Ce qui pourrait être amélioré" },
  ],
  privacyNotice:
    "Les informations recueillies sont traitées par le service, responsable du traitement, pour mesurer la satisfaction et améliorer la qualité de l'accompagnement (intérêt légitime, art. 6.1.f du RGPD ; obligation d'évaluation de la qualité, art. L312-8 du CASF). Répondre est facultatif. Seules la direction et la coordination ont accès aux réponses, qui ne sont transmises à aucun tiers ; les résultats sont diffusés uniquement de façon globale et anonyme. Les questionnaires nominatifs sont conservés 1 an, puis détruits. Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation et d'opposition auprès du délégué à la protection des données du service, et pouvez saisir la CNIL (www.cnil.fr). N'indiquez pas d'informations médicales dans les zones libres.",
};
