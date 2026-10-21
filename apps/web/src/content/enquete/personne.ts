import type { SurveyQuestion, SurveyScaleCode, SurveyTemplate } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// QUESTIONNAIRE « PERSONNE ACCOMPAGNÉE » (FALC) — transcrit du gabarit d'enquête de
// Sandrine (« Ce que vous pensez de votre accompagnement »). Version courante : celle
// du 21/10/2026 (context2/anonymise/20261021_ENQUETE-SATISFACTION_…_v1.0.md) — 18
// questions numérotées et leurs sous-questions lettrées (12 A, 13 A-D, 17 A-G), message
// libre, bloc RGPD.
//
// Seul écart : le nom de la structure du pilote est remplacé par « le service » (aucun
// nom réel dans le dépôt). Intitulés et réponses sont ceux du papier, à la lettre (une
// faute de frappe corrigée : « Estce » → « Est-ce ») ; toute correction incrémente
// `version`. Les identifiants des questions déjà présentes ne changent pas.
// ─────────────────────────────────────────────────────────────────────────────

const q = (
  number: string,
  id: string,
  scale: SurveyScaleCode,
  prompt: string,
  shortLabel: string,
  extra: { help?: string; tag?: "REGLEMENT" | "PCA" | "CONTROLE_DOSSIER" } = {}
): SurveyQuestion => ({ kind: "SCALE", number, id, scale, prompt, shortLabel, ...extra });

export const SURVEY_PERSONNE: SurveyTemplate = {
  code: "PERSONNE",
  // v2 (20/10/2026) : chapeau restauré du gabarit.
  // v3 (21/10/2026) : V1.6 enrichie (droits de la personne).
  // v4 (21/10/2026, dernière version de Sandrine) : 18 questions + sous-questions
  // lettrées ; nouveau chapeau (ce que l'équipe fait des réponses, « Profitez de cette
  // enquête… ») ; réponses du papier question par question.
  version: 4,
  title: "Ce que vous pensez de votre accompagnement",
  respondentLabel: "La personne accompagnée",
  intro:
    "Le service veut savoir si vous êtes content(e) de l'aide que vous recevez. Vos réponses nous aident à améliorer le service. Vous n'êtes pas obligé(e) de répondre à toutes les questions. Vos réponses restent confidentielles : seules la direction et la coordination les lisent. L'équipe regarde toutes les réponses. Elle décide des améliorations à faire. Les résultats et les améliorations seront expliqués aux personnes accompagnées et à leurs proches. Profitez de cette enquête pour nous donner votre avis et signaler un problème. Vous pouvez répondre seul(e), avec un proche, ou avec l'aide d'une personne de confiance.",
  questions: [
    q("1", "p00-qui-aide", "OUI_UNPEU_NON", "Savez-vous qui sont les professionnels qui vous aident et ce qu'ils font ?", "Connaît les professionnels et leur rôle"),
    q("2", "p01-respect", "FALC3", "Les personnes qui vous aident sont-elles gentilles et respectueuses avec vous ?", "Gentillesse et respect des intervenants"),
    q("3", "p02-habitudes", "FALC3", "Est-ce qu'on respecte vos habitudes et vos choix ?", "Respect des habitudes et des choix"),
    q("4", "p03-prevenu", "TOUJOURS_PARFOIS_JAMAIS", "Est-ce qu'on vous prévient si l'heure de la visite change ?", "Prévenu(e) en cas de changement d'heure de visite"),
    q("5", "p04-choix-aides", "OUI_EN_PARTIE_NSP", "Avez-vous choisi avec le service les aides dont vous avez besoin ?", "Aides choisies avec le service"),
    q(
      "6",
      "p04b-personne-confiance",
      "OUI_NON_NSP",
      "Vous pouvez choisir une personne de confiance. Elle peut vous aider dans vos démarches. Est-ce que le service vous en a parlé ?",
      "Personne de confiance expliquée"
    ),
    q(
      "7",
      "p04c-acces-dossier",
      "OUI_NON_NSP",
      "Le service écrit des informations sur vous dans un dossier. Vous pouvez demander à voir ce dossier. Est-ce que le service vous a expliqué comment faire ?",
      "Accès au dossier expliqué"
    ),
    q("8", "p04d-explication", "OUI_PARFOIS_NSP", "Avant de vous aider, les professionnels vous expliquent-ils ce qu'ils vont faire ?", "Aide expliquée avant d'aider"),
    q(
      "9",
      "p04e-accord",
      "CHAQUE_FOIS_PARFOIS_JAMAIS",
      "Vous pouvez accepter ou refuser l'aide proposée. Les professionnels vous demandent-ils votre accord ?",
      "Accord demandé avant d'aider"
    ),
    q("10", "p05-besoins", "FALC3", "Est-ce que l'aide que vous recevez correspond à ce dont vous avez besoin ?", "Aide adaptée aux besoins"),
    q("11", "p06-securite", "FALC3", "Est-ce que vous vous sentez en sécurité avec les personnes qui vous accompagnent ?", "Sentiment de sécurité avec les intervenants"),
    q("12", "p07-a-qui-dire", "OUI_NON_NSP", "Si quelque chose ne va pas, savez-vous à qui le dire ?", "Sait à qui le dire si quelque chose ne va pas"),
    q(
      "12 A",
      "p07b-reponse-remarque",
      "REPONSE_REMARQUE",
      "Si vous avez dit qu'un problème ne vous convenait pas, est-ce qu'on vous a répondu ?",
      "Réponse reçue après une remarque"
    ),
    q(
      "13 A",
      "p08a-reglement-connu",
      "OUI_UNPEU_NON",
      "Le service a écrit les règles du service. Ce document s'appelle le « règlement de fonctionnement ». Connaissez-vous ce document ?",
      "Connaît le règlement de fonctionnement",
      { tag: "REGLEMENT" }
    ),
    q("13 B", "p08-reglement", "FALC3_NSP", "Ces règles vous semblent-elles claires et justes ?", "Règlement de fonctionnement clair et juste", {
      help: "Vous pouvez demander à un professionnel de vous lire ou de vous expliquer ce document.",
      tag: "REGLEMENT",
    }),
    {
      kind: "TEXT",
      number: "13 C",
      id: "p08b-regle-proposee",
      prompt: "Voulez-vous changer ou ajouter une règle ? Écrivez-le ici :",
      shortLabel: "Propositions sur le règlement de fonctionnement",
      feedsRuleProposals: true,
    },
    q(
      "13 D",
      "p08c-avis-regles",
      "OUI_UNPEU_NON_NSP",
      "Quand le service a changé ces règles, est-ce qu'on vous a demandé votre avis ?",
      "Avis demandé quand les règles changent",
      { tag: "REGLEMENT" }
    ),
    q(
      "14",
      "p09-plan-crise",
      "FALC3_NSP",
      "S'il y a un gros problème (forte chaleur, neige, épidémie, grève…), le service a un plan pour continuer à vous aider. Est-ce que quelqu'un vous a expliqué ce plan ?",
      "Plan de gestion de crise expliqué",
      { help: "Ce plan s'appelle le « plan de gestion de crise et de continuité d'activité ».", tag: "PCA" }
    ),
    q(
      "15",
      "p10-appel-crise",
      "CRISE",
      "Pendant un gros problème (grippe, canicule, grand froid), est-ce que le service vous a appelé(e) pour prendre de vos nouvelles ?",
      "Appel pour prendre des nouvelles pendant un gros problème",
      { tag: "PCA" }
    ),
    q(
      "16",
      "p11-personne-a-prevenir",
      "CONTROLE",
      "Si le service doit prévenir quelqu'un pour vous, a-t-il le bon numéro de téléphone ?",
      "Bon numéro de la personne à prévenir",
      { tag: "CONTROLE_DOSSIER" }
    ),
    q(
      "17 A",
      "p11a-projet",
      "OUI_UNPEU_NON_NSP",
      "Votre projet d'accompagnement explique l'aide que vous avez choisie. Avez-vous pu dire ce que vous voulez dans ce projet ?",
      "A pu s'exprimer dans son projet d'accompagnement"
    ),
    q(
      "17 B",
      "p11b-liens",
      "OUI_UNPEU_NON_PAS_BESOIN",
      "Le service vous aide-t-il à garder des liens avec d'autres personnes ?",
      "Aide à garder des liens avec d'autres personnes",
      { help: "Par exemple : voir vos proches, participer à une association ou à une activité." }
    ),
    q(
      "17 C",
      "p11c-vie-ville",
      "BESOIN_AIDE_VIE_SOCIALE",
      "Avez-vous besoin d'aide pour participer à la vie de votre ville ?",
      "Besoin d'aide pour participer à la vie de la ville",
      { help: "Par exemple : voter, aller à une activité ou participer à une association." }
    ),
    q("17 D", "p11d-douleur", "DOULEUR", "Si vous avez mal, pouvez-vous le dire facilement ?", "Peut dire facilement qu'il ou elle a mal"),
    q("17 E", "p11e-ecoute", "ECOUTE", "Les professionnels vous écoutent-ils ?", "Se sent écouté(e) par les professionnels"),
    q("17 F", "p11f-avis", "SOUVENT_PARFOIS_NON_NSP", "Est-ce que le service vous demande votre avis ?", "Avis demandé par le service", {
      help: "Par exemple : avec cette enquête, ou en parlant avec un professionnel.",
    }),
    q(
      "17 G",
      "p11g-suite-avis",
      "SUITE_DEMANDE",
      "Quand vous avez donné votre avis ou demandé quelque chose, est-ce que le service vous a dit ce qui en a été fait ?",
      "Informé(e) de la suite donnée à son avis"
    ),
    q("18", "p12-global", "FALC3", "Globalement, êtes-vous content(e) de l'aide du service ?", "Satisfaction globale"),
    {
      kind: "TEXT",
      id: "p13-message",
      prompt: "Y a-t-il quelque chose que vous aimeriez nous dire, ou qui pourrait être amélioré ?",
      shortLabel: "Message libre",
    },
  ],
  privacyNotice:
    "Vos informations sont protégées. Écrire votre nom n'est pas obligatoire. Vos réponses servent seulement à améliorer le service. Seules la direction et la coordination les lisent. Elles ne sont données à personne d'autre. Votre nom est effacé au bout d'un an : on garde seulement les résultats, sans les noms. N'écrivez pas d'informations sur votre santé. Vous pouvez demander à voir, corriger ou effacer vos réponses. Si vous n'êtes pas d'accord, vous pouvez vous plaindre à la CNIL (www.cnil.fr).",
};
