import type { SurveyQuestion, SurveyScaleCode, SurveyTemplate } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// QUESTIONNAIRE « FAMILLE ET PROCHES » — transcrit du gabarit d'enquête de Sandrine.
// Version courante : celle du 21/10/2026 — 19 questions numérotées et leurs
// sous-questions lettrées (11 A, 18 A-H), avis libres, lien avec la personne
// accompagnée, bloc RGPD. Le nom de la structure du pilote est remplacé par « le
// service ». Le lien (conjoint(e) / enfant / autre) est facultatif comme sur le
// papier ; il n'entre dans aucun taux, c'est une question de contexte.
// ─────────────────────────────────────────────────────────────────────────────

type Tag = "REGLEMENT" | "PCA" | "CONTROLE_DOSSIER";
const q = (
  number: string,
  id: string,
  scale: SurveyScaleCode,
  prompt: string,
  shortLabel: string,
  extra: { help?: string; tag?: Tag } = {}
): SurveyQuestion => ({ kind: "SCALE", number, id, scale, prompt, shortLabel, ...extra });
const sat = (number: string, id: string, prompt: string, shortLabel: string, tag?: Tag): SurveyQuestion =>
  q(number, id, "SAT5", prompt, shortLabel, tag ? { tag } : {});

// Consigne du papier, lue avant les questions « Savez-vous si… » (4 à 8).
const KNOWLEDGE_HELP = "Répondez avec ce que vous savez. Si vous ne savez pas, choisissez « Je ne sais pas ».";

export const SURVEY_FAMILLE: SurveyTemplate = {
  code: "FAMILLE",
  // v2, v3 (20/10/2026) : chapeau restauré ; lien avec la personne accompagnée.
  // v4 (21/10/2026) : V1.6 enrichie (« à votre connaissance »).
  // v5 (21/10/2026, dernière version de Sandrine) : questions reformulées
  // (« Savez-vous si… »), 11 A et 18 A à 18 H ajoutées, nouveau chapeau.
  version: 5,
  title: "Enquête de satisfaction — famille et proches",
  respondentLabel: "Un proche",
  intro:
    "Votre avis compte pour améliorer l'accompagnement de votre proche. Le service réalise cette enquête pour mieux comprendre votre expérience et celle de votre proche. Vos réponses servent à voir ce qui fonctionne bien et ce qui doit être amélioré. L'équipe regarde toutes les réponses et décide des améliorations à faire. Les résultats et les améliorations seront expliqués aux personnes accompagnées et à leurs proches. Vos réponses peuvent rester anonymes si vous le souhaitez. Cela veut dire que vous n'êtes pas obligé(e) d'écrire votre nom.",
  questions: [
    sat("1", "f01-relation", "La qualité de la relation entre les intervenants et votre proche", "Qualité de la relation intervenants / proche"),
    sat(
      "2",
      "f02-dignite",
      "Le respect de la dignité, des habitudes et du rythme de vie de votre proche",
      "Respect de la dignité, des habitudes et du rythme de vie"
    ),
    sat(
      "3",
      "f03-information-changement",
      "L'information reçue en cas de changement (horaire, intervenant, absence)",
      "Information en cas de changement"
    ),
    q(
      "4",
      "f03b-personne-confiance",
      "OUI_EN_PARTIE_NSP",
      "Savez-vous si le service a expliqué à votre proche qu'il peut choisir une personne de confiance ?",
      "Personne de confiance expliquée au proche",
      { help: KNOWLEDGE_HELP }
    ),
    q(
      "5",
      "f03c-acces-dossier",
      "OUI_EN_PARTIE_NSP",
      "Savez-vous si le service a expliqué à votre proche comment voir son dossier ?",
      "Accès au dossier expliqué au proche",
      { help: KNOWLEDGE_HELP }
    ),
    q(
      "6",
      "f03d-explication",
      "OUI_PARFOIS_NSP",
      "Savez-vous si les professionnels expliquent à votre proche l'aide proposée, pour qu'il puisse l'accepter ou la refuser ?",
      "Aide proposée expliquée au proche",
      { help: KNOWLEDGE_HELP }
    ),
    q(
      "7",
      "f03e-accord",
      "OUI_PARFOIS_NSP",
      "Savez-vous si les professionnels demandent l'accord de votre proche avant de l'aider ?",
      "Accord du proche demandé avant d'aider",
      { help: KNOWLEDGE_HELP }
    ),
    q(
      "8",
      "f03f-choix-aides",
      "OUI_EN_PARTIE_NSP",
      "Savez-vous si votre proche a choisi avec le service les aides dont il a besoin ?",
      "Aides choisies avec le service",
      { help: KNOWLEDGE_HELP }
    ),
    sat("9", "f04-reactivite", "La rapidité de réponse en cas de problème ou de question", "Rapidité de réponse"),
    sat("10", "f05-adaptation", "L'adaptation du service quand les besoins de votre proche changent", "Adaptation à l'évolution des besoins"),
    sat("11", "f06-ecoute", "L'écoute et la prise en compte de vos remarques ou de vos réclamations", "Écoute des remarques et réclamations"),
    q(
      "11 A",
      "f06b-reponse-remarque",
      "REPONSE_REMARQUE",
      "Si vous avez dit qu'un problème ne vous convenait pas, est-ce qu'on vous a répondu ?",
      "Réponse reçue après une remarque"
    ),
    sat("12", "f07-confidentialite", "La confidentialité des informations concernant votre proche", "Confidentialité des informations"),
    sat("13", "f08-qui-contacter", "Savoir clairement qui appeler en cas de besoin", "Savoir clairement qui appeler"),
    sat("14", "f09-continuite", "La continuité de l'aide quand un intervenant est absent", "Continuité en cas d'absence d'un intervenant"),
    sat(
      "15",
      "f10-plan-crise",
      "L'information reçue sur le plan de gestion de crise du service (canicule, épidémie, intempéries…)",
      "Information sur le plan de gestion de crise",
      "PCA"
    ),
    sat(
      "16",
      "f11-situation-exceptionnelle",
      "La réactivité du service pendant une situation exceptionnelle (canicule, épidémie, intempéries)",
      "Réactivité lors d'une situation exceptionnelle",
      "PCA"
    ),
    q(
      "17",
      "f12-coordonnees",
      "CONTROLE",
      "Le service a-t-il le bon numéro de téléphone de la personne à prévenir pour votre proche ?",
      "Bon numéro de la personne à prévenir",
      { tag: "CONTROLE_DOSSIER" }
    ),
    sat("18", "f13-reglement", "La clarté et l'utilité des règles du service (règlement de fonctionnement)", "Clarté du règlement de fonctionnement", "REGLEMENT"),
    {
      kind: "TEXT",
      id: "f13b-regle-proposee",
      prompt: "Souhaitez-vous proposer une modification ou un ajout à ces règles ?",
      shortLabel: "Propositions sur le règlement de fonctionnement",
      feedsRuleProposals: true,
    },
    q(
      "18 A",
      "f13c-qui-aide",
      "OUI_EN_PARTIE_NSP",
      "Votre proche sait-il qui sont les professionnels qui l'aident et ce qu'ils font ?",
      "Le proche connaît les professionnels et leur rôle"
    ),
    q(
      "18 B",
      "f13d-projet",
      "OUI_EN_PARTIE_NSP",
      "Votre proche peut-il dire ce qu'il veut dans son projet d'accompagnement ?",
      "Le proche s'exprime dans son projet d'accompagnement",
      { help: "Ce projet explique l'aide choisie avec lui." }
    ),
    q(
      "18 C",
      "f13e-liens-vie-ville",
      "OUI_EN_PARTIE_NSP",
      "Le service aide-t-il votre proche à garder des liens et à participer à la vie de sa ville ?",
      "Liens sociaux et vie de la ville du proche",
      { help: "Par exemple : voir ses proches, voter, participer à une association ou à une activité." }
    ),
    q(
      "18 D",
      "f13f-douleur",
      "OUI_PARFOIS_NSP_NC",
      "Quand votre proche a mal, peut-il le dire facilement ? Les professionnels l'écoutent-ils et préviennent-ils la bonne personne ?",
      "Douleur dite, écoutée et transmise"
    ),
    q(
      "18 E",
      "f13g-donner-avis",
      "OUI_EN_PARTIE_NON",
      "Savez-vous comment votre proche et vous pouvez donner votre avis au service ?",
      "Sait comment donner son avis au service",
      { help: "Par exemple : avec cette enquête, ou en parlant avec un professionnel." }
    ),
    q(
      "18 F",
      "f13h-suite-avis",
      "SUITE_AVIS",
      "Quand vous avez donné votre avis, est-ce que le service vous a dit ce qui en a été fait ?",
      "Informé(e) de la suite donnée à son avis"
    ),
    q(
      "18 G",
      "f13i-avis-regles",
      "OUI_EN_PARTIE_NSP",
      "Est-ce qu'on a demandé son avis à votre proche quand le service a changé ses règles ?",
      "Avis du proche demandé quand les règles changent",
      { tag: "REGLEMENT" }
    ),
    q(
      "18 H",
      "f13j-evenement-grave",
      "OUI_EN_PARTIE_NSP",
      "Est-ce que le service vous informe quand un problème grave arrive, et ce qu'il fait pour l'éviter ensuite ?",
      "Information sur les problèmes graves et leurs suites"
    ),
    sat("19", "f14-global", "Votre satisfaction globale à l'égard du service", "Satisfaction globale"),
    { kind: "TEXT", id: "f15-fonctionne-bien", prompt: "Qu'est-ce qui fonctionne particulièrement bien ?", shortLabel: "Ce qui fonctionne bien" },
    { kind: "TEXT", id: "f16-ameliorer", prompt: "Qu'est-ce qui pourrait être amélioré ?", shortLabel: "Ce qui pourrait être amélioré" },
    // Placé là où le gabarit le met : après les avis libres, avant le nom et la date.
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
    "Les informations recueillies sont traitées par le service, responsable du traitement, pour mesurer la satisfaction et améliorer la qualité de l'accompagnement (intérêt légitime, art. 6.1.f du RGPD ; obligation d'évaluation de la qualité, art. L312-8 du CASF). Répondre et indiquer votre nom sont facultatifs. Seules la direction et la coordination ont accès aux réponses, qui ne sont transmises à aucun tiers ; les résultats sont diffusés uniquement de façon globale et anonyme. Les questionnaires nominatifs sont conservés 1 an après réception, puis détruits. Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation et d'opposition auprès du délégué à la protection des données du service, et pouvez saisir la CNIL (www.cnil.fr). N'indiquez pas d'informations médicales dans les zones libres.",
};
