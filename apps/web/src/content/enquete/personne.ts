import type { SurveyTemplate } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// QUESTIONNAIRE « PERSONNE ACCOMPAGNÉE » (FALC) — transcrit du gabarit d'enquête de
// Sandrine (« Ce que vous pensez de votre accompagnement », v1.0 du 30/09/2026,
// transcription V1.6 du rapport context2) : 12 questions, message libre, bloc RGPD.
//
// Seul écart : le nom de la structure du pilote est remplacé par « le service »
// (aucun nom réel dans le dépôt). Les intitulés sont ceux du gabarit, à la lettre ;
// toute correction incrémente `version`.
// ─────────────────────────────────────────────────────────────────────────────

export const SURVEY_PERSONNE: SurveyTemplate = {
  code: "PERSONNE",
  // v2 (20/10/2026) : chapeau restauré du gabarit (confidentialité, aide d'un
  // proche ou d'une personne de confiance). Les questions et l'ordre sont inchangés.
  version: 2,
  title: "Ce que vous pensez de votre accompagnement",
  respondentLabel: "La personne accompagnée",
  // Les deux phrases du gabarit, dans l'ordre : la confidentialité (« seules la
  // direction et la coordination les lisent ») était tombée à la transcription, et
  // avec elle la phrase qui dit à la personne qu'elle peut se faire aider. Ce sont
  // les deux informations qui décident si elle répond (relecture du 20/10/2026).
  intro:
    "Le service veut savoir si vous êtes content(e) de l'aide que vous recevez. Vos réponses nous aident à améliorer le service. Vous n'êtes pas obligé(e) de répondre à toutes les questions. Vos réponses restent confidentielles : seules la direction et la coordination les lisent. Vous pouvez répondre seul(e), avec un proche, ou avec l'aide d'une personne de confiance.",
  questions: [
    {
      kind: "SCALE",
      id: "p01-respect",
      scale: "FALC3",
      prompt: "Les personnes qui vous aident sont-elles gentilles et respectueuses avec vous ?",
      shortLabel: "Gentillesse et respect des intervenants",
    },
    {
      kind: "SCALE",
      id: "p02-habitudes",
      scale: "FALC3",
      prompt: "Est-ce qu'on respecte vos habitudes et vos choix ?",
      shortLabel: "Respect des habitudes et des choix",
    },
    {
      kind: "SCALE",
      id: "p03-prevenu",
      scale: "FALC3",
      prompt: "Est-ce qu'on vous prévient si l'heure de la visite change ?",
      shortLabel: "Prévenu(e) en cas de changement d'heure de visite",
    },
    {
      kind: "SCALE",
      id: "p04-avis",
      scale: "FALC3",
      prompt: "Est-ce qu'on vous demande votre avis sur votre accompagnement ?",
      shortLabel: "Avis demandé sur l'accompagnement",
    },
    {
      kind: "SCALE",
      id: "p05-besoins",
      scale: "FALC3",
      prompt: "Est-ce que l'aide que vous recevez correspond à ce dont vous avez besoin ?",
      shortLabel: "Aide adaptée aux besoins",
    },
    {
      kind: "SCALE",
      id: "p06-securite",
      scale: "FALC3",
      prompt: "Est-ce que vous vous sentez en sécurité avec les personnes qui vous accompagnent ?",
      shortLabel: "Sentiment de sécurité avec les intervenants",
    },
    {
      kind: "SCALE",
      id: "p07-a-qui-dire",
      scale: "FALC3",
      prompt: "Si quelque chose ne va pas, savez-vous à qui le dire ?",
      shortLabel: "Sait à qui le dire si quelque chose ne va pas",
    },
    {
      kind: "SCALE",
      id: "p08-reglement",
      scale: "FALC3",
      prompt:
        "Le service a écrit les règles du service. Ce document s'appelle le « règlement de fonctionnement ». Ces règles vous semblent-elles claires et justes ?",
      help: "Vous pouvez demander à un professionnel de vous lire ou de vous expliquer ce document.",
      shortLabel: "Règlement de fonctionnement clair et juste",
      tag: "REGLEMENT",
    },
    {
      kind: "TEXT",
      id: "p08b-regle-proposee",
      prompt: "Voulez-vous changer ou ajouter une règle ?",
      shortLabel: "Propositions sur le règlement de fonctionnement",
      feedsRuleProposals: true,
    },
    {
      kind: "SCALE",
      id: "p09-plan-crise",
      scale: "FALC3",
      prompt:
        "S'il y a un gros problème (forte chaleur, neige, épidémie, grève…), le service a un plan pour continuer à vous aider. Est-ce qu'on vous a expliqué ce plan ?",
      help: "Ce plan s'appelle le « plan de gestion de crise et de continuité d'activité ».",
      shortLabel: "Plan de gestion de crise expliqué",
      tag: "PCA",
    },
    {
      kind: "SCALE",
      id: "p10-appel-crise",
      scale: "CRISE",
      prompt: "Pendant un gros problème, est-ce que le service vous a appelé(e) pour prendre de vos nouvelles ?",
      shortLabel: "Appel pour prendre des nouvelles pendant un gros problème",
      tag: "PCA",
    },
    {
      kind: "SCALE",
      id: "p11-personne-a-prevenir",
      scale: "CONTROLE",
      prompt: "Est-ce que le service a le bon numéro de téléphone de la personne à prévenir pour vous ?",
      shortLabel: "Bon numéro de la personne à prévenir",
      tag: "CONTROLE_DOSSIER",
    },
    {
      kind: "SCALE",
      id: "p12-global",
      scale: "FALC3",
      prompt: "Globalement, êtes-vous content(e) de l'aide du service ?",
      shortLabel: "Satisfaction globale",
    },
    {
      kind: "TEXT",
      id: "p13-message",
      prompt: "Y a-t-il quelque chose que vous aimeriez nous dire, ou qui pourrait être amélioré ?",
      shortLabel: "Message libre",
    },
  ],
  privacyNotice:
    "Vos informations sont protégées. Vos réponses servent seulement à améliorer le service. Seules la direction et la coordination les lisent. Elles ne sont données à personne d'autre. Votre nom est effacé au bout d'un an : on garde seulement les résultats, sans les noms. N'écrivez pas d'informations sur votre santé. Vous pouvez demander à voir, corriger ou effacer vos réponses. Si vous n'êtes pas d'accord, vous pouvez vous plaindre à la CNIL (www.cnil.fr).",
};
