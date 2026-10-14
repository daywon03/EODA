import type { PracticeQuestionnaire } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// QUESTIONS SUR LES PRATIQUES — une par critère impératif (N7).
//
// ⚠️ PROVISOIRES, À VALIDER PAR SANDRINE. Côté client, l'écran dit « provisoires »
// sans nommer personne (D7).
//
// v02 du 14/10/2026 (demande de Damon : « s'appuyer sur le manuel HAS ») — chaque
// question est réécrite à partir du critère tel qu'écrit dans le Manuel d'évaluation
// de la qualité des ESSMS, HAS, juillet 2025 : intitulé, éléments d'évaluation (E.E.),
// méthode et preuves attendues (« Consultation documentaire », « Observation »). La
// page et les E.E. utilisés sont dans `source`. En appui : context/02 §4 (liste des
// impératifs SAD), context/10 §3 (« le paquet d'un critère ») et context/11.
// Les types de document attendus (`expectedDocumentTypeCodes`) viennent de la matrice
// proposée du 08/10 ; un code absent de la matrice pour ce critère fait échouer
// `questions.test.ts`.
//
// La question porte sur la PRATIQUE RÉELLE, pas sur l'existence d'un document : la
// structure répond Oui / En partie / Pas encore / Je ne sais pas. FALC : une idée, des
// mots de tous les jours, le « vous » de la structure. « Sensibiliser », jamais l'autre
// verbe. Aucune question ne demande un nom (le bandeau de l'écran le rappelle).
//
// Changer une formulation = augmenter `version` de la question (les réponses déjà
// données gardent la leur et s'affichent « à revoir »). Aucune migration.
// ─────────────────────────────────────────────────────────────────────────────

export const PRACTICE_QUESTIONNAIRE: PracticeQuestionnaire = {
  version: "v02 — 14/10/2026",
  provisional: true,
  sourceLabel: "Source : Manuel HAS juillet 2025",
  questions: [
    {
      criterionCode: "2.2.2",
      version: 2,
      theme: "Dignité",
      question: "Votre équipe fait-elle chaque jour des gestes qui respectent la dignité de la personne ?",
      proofHint:
        "L'évaluateur demande à des intervenants quels gestes ils font et s'ils en parlent entre eux, et il regarde si la charte des droits est affichée.",
      source: {
        manualPage: 80,
        method: "TRACEUR_CIBLE",
        evaluationElements: [
          "Les professionnels connaissent les pratiques qui favorisent le respect de la dignité et de l'intégrité.",
          "Les professionnels partagent entre eux ces pratiques.",
          "Les professionnels mettent en œuvre ces bonnes pratiques.",
          "Affichage de la charte des droits et libertés de la personne accueillie.",
        ],
      },
      expectedDocumentTypeCodes: ["L2002_CHARTE_DROITS", "L2002_LIVRET_ACCUEIL", "L2002_REGLEMENT_FONCTIONNEMENT"],
    },
    {
      criterionCode: "2.2.3",
      version: 2,
      theme: "Vie privée et intimité",
      question: "Chez la personne, votre équipe protège-t-elle toujours sa vie privée et son intimité ?",
      proofHint:
        "L'évaluateur demande à des intervenants comment ils protègent l'intimité de la personne et s'ils en parlent entre eux.",
      source: {
        manualPage: 81,
        method: "TRACEUR_CIBLE",
        evaluationElements: [
          "Les professionnels connaissent les pratiques qui favorisent le respect de la vie privée et de l'intimité de la personne accompagnée.",
          "Les professionnels partagent entre eux ces pratiques.",
          "Les professionnels mettent en œuvre ces pratiques.",
        ],
      },
      expectedDocumentTypeCodes: [
        "L2002_LIVRET_ACCUEIL",
        "L2002_REGLEMENT_FONCTIONNEMENT",
        "P22_EMARGEMENT_SENSIBILISATION",
      ],
    },
    {
      criterionCode: "2.2.4",
      version: 2,
      theme: "Opinions et croyances",
      question: "Votre équipe respecte-t-elle les opinions, la religion et les croyances de chaque personne ?",
      proofHint:
        "L'évaluateur demande à des intervenants ce qu'ils font pour respecter les croyances de la personne et s'ils en parlent entre eux.",
      source: {
        manualPage: 82,
        method: "TRACEUR_CIBLE",
        evaluationElements: [
          "Les professionnels connaissent les pratiques qui favorisent le respect de la liberté d'opinion, des croyances et de la vie spirituelle de la personne accompagnée.",
          "Les professionnels partagent entre eux ces pratiques.",
          "Les professionnels mettent en œuvre ces pratiques.",
        ],
      },
      expectedDocumentTypeCodes: ["L2002_LIVRET_ACCUEIL", "L2002_REGLEMENT_FONCTIONNEMENT", "RH_LIVRET_SALARIE"],
    },
    {
      criterionCode: "2.2.5",
      version: 2,
      theme: "Droit à l'image",
      question: "Pour chaque personne, son accord ou son refus pour les photos est-il noté dans son dossier ?",
      proofHint:
        "L'évaluateur regarde dans des dossiers si le choix de la personne sur son image est écrit, et demande aux intervenants s'ils le respectent.",
      source: {
        manualPage: 83,
        method: "TRACEUR_CIBLE",
        evaluationElements: [
          "Les professionnels recueillent le choix de la personne accompagnée sur son droit à l'image.",
          "Les professionnels respectent le choix exprimé par la personne accompagnée sur son droit à l'image.",
          "Traçabilité dans le dossier de la personne accompagnée de son autorisation au droit à l'image.",
        ],
      },
      expectedDocumentTypeCodes: ["P22_FORMULAIRES_CONSENTEMENT", "L2002_DIPC", "L2002_LIVRET_ACCUEIL"],
    },
    {
      criterionCode: "2.2.6",
      version: 2,
      theme: "Droits de la personne",
      question: "Avez-vous décidé avec l'équipe comment aider chaque personne à utiliser ses droits ?",
      proofHint:
        "L'évaluateur demande ce qui a été décidé avec l'équipe et quels outils elle a, puis il lit le projet de service et le règlement de fonctionnement.",
      source: {
        manualPage: 84,
        method: "TRACEUR_CIBLE",
        evaluationElements: [
          "L'ESSMS définit, avec les professionnels, les pratiques et les modalités de déploiement favorisant l'exercice des droits de la personne accompagnée.",
          "L'ESSMS met à disposition des outils (ou autres leviers mobilisables) permettant la mise en œuvre de ces pratiques.",
          "Projet d'établissement/de service. Règlement de fonctionnement.",
          "Affichage de la charte des droits et libertés de la personne accueillie.",
        ],
      },
      expectedDocumentTypeCodes: [
        "L2002_CHARTE_DROITS",
        "L2002_REGLEMENT_FONCTIONNEMENT",
        "L2002_LIVRET_ACCUEIL",
        "P22_EMARGEMENT_SENSIBILISATION",
      ],
    },
    {
      criterionCode: "2.2.7",
      version: 2,
      theme: "Données personnelles",
      question: "Les informations sur chaque personne sont-elles protégées, et lues seulement par ceux qui en ont besoin ?",
      proofHint:
        "L'évaluateur regarde comment l'équipe range et partage ces informations, avec quels outils, et si elle a été sensibilisée à ces règles.",
      source: {
        manualPage: 85,
        method: "TRACEUR_CIBLE",
        evaluationElements: [
          "L'ESSMS définit l'organisation et les pratiques qui garantissent la confidentialité et la protection des informations et données relatives à la personne accompagnée.",
          "L'ESSMS met à disposition des moyens et des outils permettant la mise en œuvre de ces pratiques.",
          "L'ESSMS […] sensibilise les professionnels au respect des règles de confidentialité et de protection des informations et données relatives à la personne accompagnée.",
          "Observation des pratiques professionnelles, des règles de confidentialité et de protection des données.",
        ],
      },
      expectedDocumentTypeCodes: [
        "P22_DUI_SECURISE",
        "P22_CHARTE_INFORMATIQUE",
        "P22_REGISTRE_TRAITEMENTS",
        "L2002_PROJET_SERVICE",
      ],
    },
    {
      criterionCode: "3.11.1",
      version: 2,
      theme: "Prévenir la maltraitance",
      question: "Avez-vous repéré avec l'équipe les situations où une maltraitance pourrait arriver ?",
      proofHint:
        "L'évaluateur demande comment ces situations ont été repérées avec l'équipe, puis il lit le plan de prévention qui en découle.",
      source: {
        manualPage: 148,
        method: "AUDIT_SYSTEME",
        evaluationElements: [
          "L'ESSMS identifie avec les professionnels les situations à risque pouvant générer des actes de maltraitance et de violence.",
          "L'ESSMS définit un plan de prévention et de gestion des risques de maltraitance et violence au regard des risques identifiés.",
        ],
      },
      expectedDocumentTypeCodes: ["P11_CARTOGRAPHIE_RISQUES", "P11_PLAN_PREVENTION", "QUALITE_PROCEDURE_EI_PLAINTES"],
    },
    {
      criterionCode: "3.11.2",
      version: 2,
      theme: "Signalements de maltraitance",
      question: "Chaque signalement de maltraitance est-il analysé, puis suivi d'actions pour corriger ?",
      proofHint:
        "L'évaluateur demande des exemples de signalements traités et lit les fiches, les comptes rendus et le plan d'action, sans nom.",
      source: {
        manualPage: 149,
        method: "AUDIT_SYSTEME",
        evaluationElements: [
          "L'ESSMS analyse les signalements de maltraitance et de violence.",
          "L'ESSMS met en place des actions correctives.",
        ],
      },
      expectedDocumentTypeCodes: ["P11_SIGNALEMENTS_TRACES", "QUALITE_PROCEDURE_EI_PLAINTES", "P11_PLAN_PREVENTION"],
    },
    {
      criterionCode: "3.12.1",
      version: 2,
      theme: "Plaintes et réclamations",
      question: "Avez-vous une façon claire de recevoir puis de traiter chaque plainte ?",
      proofHint:
        "L'évaluateur demande comment une plainte arrive et qui la traite, puis il lit la procédure et le registre des plaintes.",
      source: {
        manualPage: 151,
        method: "AUDIT_SYSTEME",
        evaluationElements: [
          "L'ESSMS organise le recueil des plaintes et des réclamations.",
          "L'ESSMS organise le traitement des plaintes et des réclamations.",
        ],
      },
      expectedDocumentTypeCodes: ["QUALITE_PROCEDURE_EI_PLAINTES", "P12_REGISTRE", "P12_AR_TYPE"],
    },
    {
      criterionCode: "3.12.2",
      version: 2,
      theme: "Répondre aux plaintes",
      question: "Dites-vous toujours à la personne qui s'est plainte ce qui a été fait ?",
      proofHint:
        "L'évaluateur demande comment vous répondez et comment vous informez les personnes, puis il lit vos réponses écrites.",
      source: {
        manualPage: 152,
        method: "AUDIT_SYSTEME",
        evaluationElements: [
          "L'ESSMS communique sur le traitement des réclamations et des plaintes auprès des parties prenantes.",
          "L'ESSMS assure un retour à la personne à l'origine de la réclamation ou de la plainte.",
        ],
      },
      expectedDocumentTypeCodes: ["P12_REPONSE_FINALE", "P12_AR_TYPE", "P12_REGISTRE"],
    },
    {
      criterionCode: "3.12.3",
      version: 2,
      theme: "Parler des plaintes en équipe",
      question: "Votre équipe parle-t-elle ensemble des plaintes, puis change-t-elle ce qui doit l'être ?",
      proofHint:
        "L'évaluateur demande à des intervenants une plainte analysée en équipe et ce qui a changé, puis il lit les comptes rendus.",
      source: {
        manualPage: 153,
        method: "AUDIT_SYSTEME",
        evaluationElements: [
          "Les professionnels analysent les plaintes et les réclamations en équipe.",
          "Les professionnels mettent en place des actions correctives.",
        ],
      },
      expectedDocumentTypeCodes: ["P12_CR_ANALYSE_EQUIPE", "P12_REGISTRE", "QUALITE_PROCEDURE_EI_PLAINTES"],
    },
    {
      criterionCode: "3.13.1",
      version: 2,
      theme: "Incidents",
      question: "Avez-vous une façon claire de noter puis de traiter chaque incident (chute, erreur, oubli) ?",
      proofHint:
        "L'évaluateur demande comment un incident est noté et traité, puis il lit la procédure, la fiche de déclaration et les réponses apportées.",
      source: {
        manualPage: 154,
        method: "AUDIT_SYSTEME",
        evaluationElements: [
          "L'ESSMS organise le recueil des évènements indésirables.",
          "L'ESSMS organise le traitement des évènements indésirables.",
        ],
      },
      expectedDocumentTypeCodes: ["QUALITE_PROCEDURE_EI_PLAINTES", "P13_FICHE_DECLARATION", "P13_TABLEAU_SUIVI"],
    },
    {
      criterionCode: "3.13.2",
      version: 2,
      theme: "Informer après un incident",
      question: "Après un incident, prévenez-vous les personnes concernées, et les autorités si c'est grave ?",
      proofHint:
        "L'évaluateur demande comment vous informez, puis il regarde vos courriers, vos affichages et vos déclarations aux autorités.",
      source: {
        manualPage: 155,
        method: "AUDIT_SYSTEME",
        evaluationElements: [
          "L'ESSMS communique sur les évènements indésirables et leur traitement auprès des parties prenantes.",
          "L'ESSMS signale les évènements indésirables graves aux autorités.",
        ],
      },
      expectedDocumentTypeCodes: ["QUALITE_PROCEDURE_EI_PLAINTES", "L2002_CR_CVS"],
    },
    {
      criterionCode: "3.13.3",
      version: 2,
      theme: "Analyser les incidents en équipe",
      question: "Votre équipe analyse-t-elle ensemble les incidents, puis change-t-elle ce qui doit l'être ?",
      proofHint:
        "L'évaluateur demande à des intervenants s'ils déclarent les incidents et comment ils les analysent, puis il lit les comptes rendus.",
      source: {
        manualPage: 156,
        method: "AUDIT_SYSTEME",
        evaluationElements: [
          "Les professionnels déclarent les évènements indésirables.",
          "Les professionnels les analysent en équipe.",
          "Les professionnels mettent en place des actions correctives.",
        ],
      },
      expectedDocumentTypeCodes: [
        "P13_CR_RETEX",
        "P13_FICHE_DECLARATION",
        "P13_TABLEAU_SUIVI",
        "QUALITE_PROCEDURE_EI_PLAINTES",
      ],
    },
    {
      criterionCode: "3.14.1",
      version: 2,
      theme: "Plan de crise",
      question: "Avez-vous fait avec l'équipe un plan pour continuer l'aide en cas de crise, et est-il à jour ?",
      proofHint:
        "L'évaluateur lit ce plan et les comptes rendus qui montrent qu'il a été fait avec l'équipe puis mis à jour.",
      source: {
        manualPage: 158,
        method: "AUDIT_SYSTEME",
        evaluationElements: [
          "L'ESSMS définit avec les professionnels un plan de gestion de crise et de continuité de l'activité.",
          "L'ESSMS actualise ce plan autant que nécessaire.",
        ],
      },
      expectedDocumentTypeCodes: ["P14_PCA_REDIGE", "P14_PGC_REDIGE", "QUALITE_PCA_PLAN_BLEU", "L2002_CR_CVS"],
    },
    {
      criterionCode: "3.14.2",
      version: 2,
      theme: "Faire connaître le plan de crise",
      question: "Votre équipe et vos partenaires connaissent-ils votre plan de crise ?",
      proofHint:
        "L'évaluateur regarde comment le plan a été présenté à l'équipe et aux partenaires, et si la liste des contacts est à jour.",
      source: {
        manualPage: 159,
        method: "AUDIT_SYSTEME",
        evaluationElements: [
          "L'ESSMS communique son plan de gestion de crise en interne.",
          "L'ESSMS communique son plan de gestion de crise en externe.",
          "Liste des acteurs concernés et coordonnées à jour.",
        ],
      },
      expectedDocumentTypeCodes: ["P14_PCA_REDIGE", "P14_PGC_REDIGE", "P14_CR_DIFFUSION", "QUALITE_PCA_PLAN_BLEU"],
    },
    {
      criterionCode: "3.6.2",
      version: 2,
      theme: "Médicaments",
      question: "De la livraison à l'aide à la prise, votre équipe suit-elle les règles pour les médicaments ?",
      proofHint:
        "L'évaluateur lit vos procédures, puis regarde comment les médicaments sont rangés, donnés et notés.",
      source: {
        manualPage: 130,
        method: "AUDIT_SYSTEME",
        evaluationElements: [
          "Les professionnels connaissent les règles de sécurisation du circuit du médicament.",
          "Les professionnels respectent ces règles.",
          "Toutes les procédures liées au circuit du médicament, à toutes les étapes de la prise en charge et à la sécurisation.",
        ],
      },
      // La matrice du 08/10 ne propose aucun type pour 3.6.2 (SAD mixte) : à compléter.
      expectedDocumentTypeCodes: [],
    },
  ],
};
