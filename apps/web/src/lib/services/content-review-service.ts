import { QUIZ_MODULES, type QuizModule } from "@/content/quiz";
import { PRACTICE_QUESTIONNAIRE } from "@/content/pratiques/questions";
import { SURVEY_SCALES, SURVEY_TEMPLATES, type SurveyQuestion, type SurveyTemplate } from "@/content/enquete";
import { RECEPTION_DOCUMENTS, RECEPTION_POINTS_VERSION } from "@/content/enquete/reception";
import { ADMISSION_EXPLANATIONS, ADMISSION_EXPLANATIONS_VERSION } from "@/content/admission/explications";
import { DISCOVERY_GRID } from "@/content/decouverte/grille";
import type { DiscoveryField } from "@/content/decouverte/types";

// ─────────────────────────────────────────────────────────────────────────────
// CONTENUS À VALIDER — catalogue de relecture, service PUR (décision de Damon,
// 14/10/2026).
//
// Tout le contenu PROVISOIRE de la plateforme, à plat, versionné, pour la relecture
// de Sandrine : quiz, questions sur les pratiques, questionnaires d'enquête, grille de
// découverte, points « à dire » de la feuille de réception. Le catalogue est
// construit À PARTIR des fichiers de `content/` — jamais recopié : une question
// corrigée là apparaît corrigée ici, et dans l'export, sans autre geste.
//
// Un seul modèle sert l'écran ET les exports (Word, CSV) : ce que Sandrine annote
// hors ligne est exactement ce qu'elle voit à l'écran.
// ─────────────────────────────────────────────────────────────────────────────

export const CONTENT_REVIEW_STATUS = "Provisoire, à valider par Sandrine";

export type ReviewField = { label: string; value: string };
export type ReviewItem = { id: string; title: string; fields: readonly ReviewField[] };
export type ReviewGroup = { id: string; title: string; version: string; provenance: string; items: readonly ReviewItem[] };
export type ReviewFamilyId = "QUIZ" | "PRATIQUES" | "ENQUETE" | "DECOUVERTE" | "RECEPTION" | "ADMISSION";
export type ReviewFamily = { id: ReviewFamilyId; title: string; description: string; groups: readonly ReviewGroup[] };
export type ContentReviewCatalog = { status: string; families: readonly ReviewFamily[] };

// Libellés des types de document attendus (« L2002_DIPC » → « DIPEC… »), lus en base
// par l'appelant. Un code sans libellé connu s'affiche tel quel, jamais masqué.
export type DocumentTypeLabels = ReadonlyMap<string, string>;

const METHOD_LABELS = { TRACEUR_CIBLE: "Traceur ciblé", AUDIT_SYSTEME: "Audit système" } as const;

const FIELD_KIND_LABELS: Record<DiscoveryField["kind"], string> = {
  SHORT_TEXT: "Réponse courte",
  LONG_TEXT: "Réponse développée",
  CHOICE: "Choix dans une liste",
};

// Un champ vide n'est pas affiché : une ligne « Aide : » sans rien derrière se lit
// comme un oubli.
function fields(entries: readonly (readonly [string, string | undefined | null])[]): ReviewField[] {
  return entries.flatMap(([label, value]) => (value && value.trim() ? [{ label, value }] : []));
}

function quizGroup(quiz: QuizModule): ReviewGroup {
  return {
    id: `quiz-${quiz.code.toLowerCase()}`,
    title: `Quiz « ${quiz.title} »`,
    version: `v${quiz.version}`,
    provenance: quiz.sources.join("\n"),
    items: quiz.questions.map((question, index) => {
      const correct = question.choices.find((choice) => choice.id === question.correctChoiceId);
      return {
        id: question.id,
        title: `${index + 1}. ${question.prompt}`,
        fields: fields([
          ["Choix proposés", question.choices.map((choice) => `${choice.id}) ${choice.label}`).join("\n")],
          ["Bonne réponse", correct ? `${correct.id}) ${correct.label}` : "Aucune — à corriger"],
          ["Explication", question.explanation],
          ["Source", question.source],
        ]),
      };
    }),
  };
}

function practiceGroup(labels: DocumentTypeLabels): ReviewGroup {
  return {
    id: "pratiques",
    title: "Questions sur les pratiques (critères impératifs)",
    version: PRACTICE_QUESTIONNAIRE.version,
    provenance: PRACTICE_QUESTIONNAIRE.sourceLabel,
    items: PRACTICE_QUESTIONNAIRE.questions.map((q) => ({
      id: `pratique-${q.criterionCode}`,
      title: `Critère ${q.criterionCode} — ${q.theme}`,
      fields: fields([
        ["Question", `${q.question} (formulation v${q.version})`],
        ["Aide", q.proofHint],
        ["Source", `Manuel HAS, p. ${q.source.manualPage} · ${METHOD_LABELS[q.source.method]}`],
        ["Éléments d'évaluation", q.source.evaluationElements.join("\n")],
        [
          "Documents attendus",
          q.expectedDocumentTypeCodes.length === 0
            ? "Aucun proposé par la matrice"
            : q.expectedDocumentTypeCodes.map((code) => labels.get(code) ?? code).join("\n"),
        ],
      ]),
    })),
  };
}

function surveyQuestionItem(question: SurveyQuestion, index: number): ReviewItem {
  if (question.kind === "TEXT") {
    return {
      id: question.id,
      title: `${index + 1}. ${question.prompt}`,
      fields: fields([
        ["Type", question.feedsRuleProposals ? "Réponse libre (propositions au CVS)" : "Réponse libre"],
        ["Libellé court", question.shortLabel],
      ]),
    };
  }
  if (question.kind === "CHOICE") {
    return {
      id: question.id,
      title: `${index + 1}. ${question.prompt}`,
      fields: fields([
        ["Type", "Choix parmi des propositions, facultatif"],
        ["Réponses possibles", question.options.join("\n")],
        ["Précision libre", question.otherOption ? `Ouverte si « ${question.otherOption} » est choisi` : undefined],
        ["Libellé court", question.shortLabel],
      ]),
    };
  }
  const scale = SURVEY_SCALES[question.scale];
  return {
    id: question.id,
    title: `${index + 1}. ${question.prompt}`,
    fields: fields([
      ["Type", scale.label],
      ["Réponses possibles", scale.options.map((option) => option.label).join("\n")],
      ["Aide lue à voix haute", question.help],
      ["Libellé court", question.shortLabel],
    ]),
  };
}

function surveyGroup(template: SurveyTemplate): ReviewGroup {
  return {
    id: `enquete-${template.code.toLowerCase()}`,
    title: `Questionnaire « ${template.title} »`,
    version: `v${template.version}`,
    provenance: `Répondant : ${template.respondentLabel}`,
    items: [
      { id: `${template.code}-intro`, title: "Introduction", fields: fields([["Texte", template.intro]]) },
      ...template.questions.map(surveyQuestionItem),
      { id: `${template.code}-rgpd`, title: "Protection de vos données", fields: fields([["Texte", template.privacyNotice]]) },
    ],
  };
}

function discoveryGroups(): ReviewGroup[] {
  return DISCOVERY_GRID.sections.map((section) => ({
    id: `decouverte-${section.id}`,
    title: section.title,
    version: DISCOVERY_GRID.version,
    provenance: section.purpose,
    items: section.fields.map((field) => ({
      id: `${section.id}-${field.id}`,
      title: field.label,
      fields: fields([
        ["Type de réponse", FIELD_KIND_LABELS[field.kind]],
        ["Aide", field.hint],
        ["Choix", field.options?.join("\n")],
      ]),
    })),
  }));
}

function receptionGroups(): ReviewGroup[] {
  return RECEPTION_DOCUMENTS.map((document) => ({
    id: `reception-${document.kind.toLowerCase()}`,
    title: document.label,
    version: `v${RECEPTION_POINTS_VERSION}`,
    provenance: "Points à dire et à cocher avec la personne, avant la signature",
    items: document.points.map((point, index) => ({ id: point.id, title: `${index + 1}. ${point.label}`, fields: [] })),
  }));
}

const NATURE_LABELS = { OBLIGATION: "Obligation", CHOIX_STRUCTURE: "Choix de la structure" } as const;

function admissionGroups(): ReviewGroup[] {
  return ADMISSION_EXPLANATIONS.map((section) => ({
    id: `admission-${section.id}`,
    title: section.title,
    version: `v${ADMISSION_EXPLANATIONS_VERSION}`,
    provenance: "Points à expliquer et à cocher avec la personne, avant la signature du DIPEC sur la tablette",
    items: section.points.map((point, index) => ({
      id: point.id,
      title: `${index + 1}. ${point.label}`,
      fields: fields([
        ["Aide à dire", point.hint],
        ["Critères HAS", point.criteria.join(", ") || undefined],
        ["Nature", NATURE_LABELS[point.nature]],
        ["Source", point.source],
        ["À confirmer", point.toConfirm],
      ]),
    })),
  }));
}

export function buildContentReviewCatalog(labels: DocumentTypeLabels = new Map()): ContentReviewCatalog {
  return {
    status: CONTENT_REVIEW_STATUS,
    families: [
      {
        id: "QUIZ",
        title: "Quiz de sensibilisation",
        description: "Chaque question, ses choix, la bonne réponse, l'explication montrée après la réponse et sa source.",
        groups: QUIZ_MODULES.map(quizGroup),
      },
      {
        id: "PRATIQUES",
        title: "Questions sur les pratiques",
        description: "Une question par critère impératif, l'aide affichée, la source dans le manuel HAS et les documents attendus.",
        groups: [practiceGroup(labels)],
      },
      {
        id: "ENQUETE",
        title: "Questionnaires d'enquête de satisfaction",
        description: "Les deux questionnaires de la tablette, avec leurs échelles de réponse.",
        groups: SURVEY_TEMPLATES.map(surveyGroup),
      },
      {
        id: "DECOUVERTE",
        title: "Grille de découverte",
        description: "Les questions de la réunion de découverte, section par section.",
        groups: discoveryGroups(),
      },
      {
        id: "RECEPTION",
        title: "Feuille de réception : points « à dire »",
        description: "Ce que l'intervenant présente pour chaque document, avant la signature unique.",
        groups: receptionGroups(),
      },
      {
        id: "ADMISSION",
        title: "Accueil et DIPEC : ce qu'il faut expliquer",
        description: "Les points du manuel HAS expliqués à la personne avant la signature du DIPEC sur la tablette, avec leurs critères, leur nature et leur source.",
        groups: admissionGroups(),
      },
    ],
  };
}

export function countReviewItems(family: ReviewFamily): number {
  return family.groups.reduce((total, group) => total + group.items.length, 0);
}
