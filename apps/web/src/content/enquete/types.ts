import type { SurveyChoice, SurveyTemplateCode } from "@/lib/hds/beneficiary-data-port";

// ─────────────────────────────────────────────────────────────────────────────
// ENQUÊTE DE SATISFACTION — types du CONTENU (lot C).
//
// Les questionnaires sont du contenu versionné, comme les quiz et les pratiques :
// corriger une formulation incrémente `version`, et une réponse garde la version à
// laquelle elle a répondu (`SurveyResponse.templateVersion`). Ajouter une question
// ne demande jamais de migration.
// ─────────────────────────────────────────────────────────────────────────────

export type SurveyScaleCode = "FALC3" | "CRISE" | "SAT5" | "CONTROLE";

export type SurveyScaleOption = {
  choice: SurveyChoice;
  label: string;
  // Poids dans le taux de satisfaction (0 à 1). null = exclu du calcul (« Non
  // concerné », « Cela ne m'est pas arrivé », « Ne se prononce pas »).
  weight: number | null;
  // Indicateur de contrôle : la réponse appelle une mise à jour du dossier.
  alert?: boolean;
};

export type SurveyScale = {
  code: SurveyScaleCode;
  label: string;
  // Indicateur de CONTRÔLE (personne à prévenir) : n'entre jamais dans le taux.
  isControl: boolean;
  options: readonly SurveyScaleOption[];
};

export type SurveyQuestionTag = "REGLEMENT" | "PCA" | "CONTROLE_DOSSIER";

export type SurveyScaleQuestion = {
  kind: "SCALE";
  id: string;
  scale: SurveyScaleCode;
  prompt: string;
  // Aide lue à voix haute (FALC), facultative.
  help?: string;
  // Libellé court du dépouillement (statistiques, plan d'action, export).
  shortLabel: string;
  tag?: SurveyQuestionTag;
};

export type SurveyTextQuestion = {
  kind: "TEXT";
  id: string;
  prompt: string;
  shortLabel: string;
  // Les propositions sur le règlement de fonctionnement vont au CVS / à la direction.
  feedsRuleProposals?: boolean;
};

export type SurveyQuestion = SurveyScaleQuestion | SurveyTextQuestion;

export type SurveyTemplate = {
  code: SurveyTemplateCode;
  version: number;
  title: string;
  intro: string;
  respondentLabel: string;
  questions: readonly SurveyQuestion[];
  // Bloc « Protection de vos données » lu ou montré avant de commencer.
  privacyNotice: string;
};
