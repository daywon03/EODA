import type { SurveyTemplate } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// QUESTIONNAIRE « FAMILLE ET PROCHES » — transcrit du gabarit d'enquête de Sandrine.
// Version courante : la V1.6 enrichie remise par Damon le 21/10/2026 : 19 questions,
// « Non concerné », avis libres, le lien avec la personne accompagnée, bloc RGPD. Le
// nom de la structure du pilote est remplacé par « le service ». Le lien
// (conjoint(e) / enfant / autre) est demandé facultatif comme sur le papier ; il
// n'entre dans aucun taux, c'est une question de contexte, pas une échelle.
// ─────────────────────────────────────────────────────────────────────────────

const sat = (id: string, prompt: string, shortLabel: string, tag?: "REGLEMENT" | "PCA") =>
  ({ kind: "SCALE", id, scale: "SAT5", prompt, shortLabel, ...(tag ? { tag } : {}) }) as const;

// Consigne du questionnaire, lue avant chacune des cinq questions « à votre
// connaissance ».
const PROCHE_HELP =
  "Répondez selon ce que vous savez de l'accompagnement de votre proche. Si vous ne savez pas, choisissez « Je ne sais pas ».";
const proche = (id: string, scale: "PROCHE_EN_PARTIE" | "PROCHE_PARFOIS", prompt: string, shortLabel: string) =>
  ({ kind: "SCALE", id, scale, prompt, help: PROCHE_HELP, shortLabel }) as const;

export const SURVEY_FAMILLE: SurveyTemplate = {
  code: "FAMILLE",
  // v2 (20/10/2026) : chapeau restauré du gabarit (anonymat possible, ce qui
  // fonctionne bien / ce qui peut être amélioré). Les questions sont inchangées.
  // v3 (20/10/2026) : le lien avec la personne accompagnée, présent sur le papier
  // juste après les avis libres, était absent du contenu.
  // v4 (21/10/2026) : V1.6 enrichie — cinq questions « à votre connaissance » sur les
  // droits du proche (personne de confiance, dossier, explication, accord, choix des
  // aides), après l'information en cas de changement. Identifiants conservés.
  version: 4,
  title: "Enquête de satisfaction — famille et proches",
  respondentLabel: "Un proche",
  // Le chapeau du gabarit dit trois choses, pas deux : l'anonymat possible, et les
  // deux questions auxquelles le questionnaire répond (ce qui fonctionne bien, ce
  // qui peut être amélioré). Restaurés le 20/10/2026.
  intro:
    "Votre avis compte pour améliorer l'accompagnement de votre proche. Le service réalise cette enquête pour mieux comprendre votre expérience et celle de votre proche, identifier ce qui fonctionne bien et ce qui peut être amélioré. Ce questionnaire prend environ 5 minutes. Vos réponses peuvent rester anonymes si vous le souhaitez (voir « Protection de vos données personnelles »).",
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
    proche(
      "f03b-personne-confiance",
      "PROCHE_EN_PARTIE",
      "À votre connaissance, le service a-t-il expliqué à votre proche qu'il peut désigner une personne de confiance ?",
      "Personne de confiance expliquée au proche"
    ),
    proche(
      "f03c-acces-dossier",
      "PROCHE_EN_PARTIE",
      "À votre connaissance, le service a-t-il expliqué à votre proche comment consulter les informations de son dossier concernant son accompagnement ?",
      "Accès au dossier expliqué au proche"
    ),
    proche(
      "f03d-explication",
      "PROCHE_PARFOIS",
      "À votre connaissance, les professionnels expliquent-ils à votre proche l'aide proposée pour qu'il puisse l'accepter ou la refuser ?",
      "Aide proposée expliquée au proche"
    ),
    proche(
      "f03e-accord",
      "PROCHE_PARFOIS",
      "À votre connaissance, les professionnels demandent-ils l'accord de votre proche avant de lui apporter leur aide ?",
      "Accord du proche demandé avant d'aider"
    ),
    proche(
      "f03f-choix-aides",
      "PROCHE_EN_PARTIE",
      "À votre connaissance, votre proche a-t-il choisi avec le service les aides à prévoir selon ses besoins et ses souhaits ?",
      "Aides choisies avec le service"
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
    // Placé là où le gabarit le met : après les avis libres, avant le nom et la date.
    // Comme le nom sur le papier, il est facultatif — il ne bloque donc pas le passage
    // à l'écran suivant, et il n'entre dans aucun taux.
    {
      kind: "CHOICE",
      id: "f17-lien",
      prompt: "Votre lien avec la personne accompagnée (facultatif)",
      shortLabel: "Lien avec la personne accompagnée",
      options: ["Conjoint(e)", "Enfant", "Autre"],
      otherOption: "Autre",
    },
  ],
  privacyNotice:
    "Les informations recueillies sont traitées par le service, responsable du traitement, pour mesurer la satisfaction et améliorer la qualité de l'accompagnement (intérêt légitime, art. 6.1.f du RGPD ; obligation d'évaluation de la qualité, art. L312-8 du CASF). Répondre est facultatif. Seules la direction et la coordination ont accès aux réponses, qui ne sont transmises à aucun tiers ; les résultats sont diffusés uniquement de façon globale et anonyme. Les questionnaires nominatifs sont conservés 1 an, puis détruits. Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation et d'opposition auprès du délégué à la protection des données du service, et pouvez saisir la CNIL (www.cnil.fr). N'indiquez pas d'informations médicales dans les zones libres.",
};
