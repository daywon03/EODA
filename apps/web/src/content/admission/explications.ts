// ─────────────────────────────────────────────────────────────────────────────
// ACCUEIL D'UNE NOUVELLE PERSONNE — ce qu'il faut lui EXPLIQUER avant la signature
// du DIPEC, sur la tablette (demande de Damon, 26/10/2026).
//
// ⚠️ PROVISOIRE (`ADMISSION_EXPLANATIONS_PROVISIONAL`), à valider par Sandrine.
//
// Sources, dans cet ordre :
//   1. Le manuel HAS tel qu'il est chargé dans le dépôt (grille Synaé chapitre 1,
//      `.claude/context/Documents/Grille Chapitre 1 …`) — les codes ci-dessous y ont
//      été relus, critère par critère, et leurs « éléments d'évaluation » (E.E.)
//      dictent la formulation : 1.2.1 (rôle des intervenants), 1.2.2 (droits et
//      devoirs, documents remis ET explications, questions possibles), 1.2.3
//      (personne de confiance), 1.2.4 (accès au dossier), 1.2.5 / 1.2.6 (exercice
//      des droits, personnes ressources), 1.4.1 (choix), 1.5.1 (participation et
//      satisfaction), 1.7.1 / 1.7.4 (consentement éclairé, tracé), 1.10.1 (attentes
//      sur le projet), 1.11.1 (place de l'entourage).
//   2. Le cahier de style, DIPEC revu le 22/09 (context/10 §6) : coupon « personne
//      de confiance » détachable, arrêté des personnes qualifiées joint, numéros
//      d'urgence 17 / 112 / 114.
//   3. La loi : CASF L311-4 (livret d'accueil, charte, règlement de fonctionnement
//      remis ; DIPEC), L311-5 (personnes qualifiées), L311-5-1 (personne de
//      confiance) ; Code de la consommation L221-18 (rétractation de 14 jours d'un
//      contrat signé au domicile — application aux SAD À CONFIRMER par Sandrine).
//
// Chaque point dit s'il est une OBLIGATION ou un CHOIX DE LA STRUCTURE (context/10
// §2 : « une sortie dit obligation légale ou choix de la structure, jamais l'un pour
// l'autre »). Corriger un point incrémente `ADMISSION_EXPLANATIONS_VERSION` : le
// contrat signé recopie le texte coché, la version dit lequel.
// ─────────────────────────────────────────────────────────────────────────────

export const ADMISSION_EXPLANATIONS_PROVISIONAL = true;
// v2 (28/10/2026) : « plainte ou réclamation », section « Sa sécurité et ses données »
// (EI, maltraitance, crise, RGPD), fiches de sensibilisation remises.
export const ADMISSION_EXPLANATIONS_VERSION = 2;

export type ExplanationNature = "OBLIGATION" | "CHOIX_STRUCTURE";

export type AdmissionExplanation = {
  id: string;
  // Ce que l'intervenant dit, en mots simples (FALC).
  label: string;
  // Une aide à dire, facultative.
  hint?: string;
  criteria: readonly string[];
  nature: ExplanationNature;
  source: string;
  // Un point qu'EODA doit encore confirmer avant d'en faire une règle.
  toConfirm?: string;
};

export type AdmissionExplanationSection = {
  id: string;
  title: string;
  points: readonly AdmissionExplanation[];
};

export const ADMISSION_EXPLANATIONS: readonly AdmissionExplanationSection[] = [
  {
    id: "documents",
    title: "Les documents remis",
    points: [
      {
        id: "remise-livret-charte-reglement",
        label: "Remettre le livret d'accueil, la charte des droits et libertés et le règlement de fonctionnement",
        hint: "Les montrer, dire à quoi ils servent, les laisser à la personne.",
        criteria: ["1.2.2"],
        nature: "OBLIGATION",
        source: "CASF L311-4 · HAS 1.2.2",
      },
      {
        id: "personnes-qualifiees",
        label: "Donner la liste des personnes qualifiées et dire comment les joindre",
        hint: "En cas de désaccord avec le service, elles aident la personne à faire valoir ses droits.",
        criteria: ["1.2.5", "1.2.6"],
        nature: "OBLIGATION",
        source: "CASF L311-5 · DIPEC revu le 22/09 · HAS 1.2.6",
      },
    ],
  },
  {
    id: "intervenants",
    title: "Qui intervient",
    points: [
      {
        id: "role-intervenants",
        label: "Présenter les intervenants, leur rôle, et comment les reconnaître",
        criteria: ["1.2.1"],
        nature: "OBLIGATION",
        source: "HAS 1.2.1",
      },
      {
        id: "urgences",
        label: "Montrer les numéros d'urgence (17, 112, 114) et le numéro du service",
        criteria: ["1.2.2"],
        nature: "CHOIX_STRUCTURE",
        source: "DIPEC revu le 22/09",
      },
    ],
  },
  {
    id: "droits",
    title: "Les droits de la personne",
    points: [
      {
        id: "droits-devoirs",
        label: "Expliquer ses droits et ses devoirs dans le fonctionnement du service",
        criteria: ["1.2.2", "1.2.6"],
        nature: "OBLIGATION",
        source: "HAS 1.2.2 · 1.2.6",
      },
      {
        id: "personne-confiance",
        label: "Dire qu'elle peut choisir une personne de confiance, et expliquer son rôle",
        hint: "Le coupon « personne de confiance » est dans le DIPEC. Elle peut le remplir plus tard.",
        criteria: ["1.2.3"],
        nature: "OBLIGATION",
        source: "CASF L311-5-1 · HAS 1.2.3 · DIPEC revu le 22/09",
      },
      {
        id: "acces-dossier",
        label: "Expliquer comment voir son dossier",
        criteria: ["1.2.4"],
        nature: "OBLIGATION",
        source: "HAS 1.2.4",
      },
      {
        id: "reclamation",
        // « plainte ou réclamation » : les deux mots du critère 3.12 (call du 28/10/2026).
        label: "Expliquer comment faire une plainte ou une réclamation, et à qui s'adresser",
        hint: "Montrer la fiche de sensibilisation « plainte ou réclamation ».",
        criteria: ["1.2.5", "3.12.2"],
        nature: "OBLIGATION",
        source: "HAS 1.2.5 · 3.12.2 (impératif) · règlement de fonctionnement · fiches de sensibilisation du 19/10",
      },
    ],
  },
  {
    // Ajouté le 28/10/2026 (call avec Sandrine) : les fiches de sensibilisation
    // « personne accompagnée » doivent être montrées et expliquées à l'accueil — la
    // personne doit pouvoir dire, le jour de l'évaluation, « on me l'a expliqué, on me
    // l'a montré, je sais où le trouver ». Codes relus dans
    // `.claude/context/02-referentiel-has.md` §4 (critères impératifs SAD).
    id: "securite",
    title: "Sa sécurité et ses données",
    points: [
      {
        id: "evenement-indesirable",
        label: "Expliquer ce qu'est un événement indésirable, et comment le signaler",
        hint: "Une chute, un oubli, un incident : la personne ou ses proches peuvent le dire au service.",
        criteria: ["3.13.2"],
        nature: "OBLIGATION",
        source: "HAS 3.13.2 (impératif) · fiches de sensibilisation du 19/10",
      },
      {
        id: "prevention-maltraitance",
        label: "Expliquer comment le service prévient la maltraitance, et à qui le dire",
        hint: "Rappeler le 3977 (numéro national contre la maltraitance des personnes âgées et handicapées).",
        criteria: ["3.11.1"],
        nature: "OBLIGATION",
        source: "HAS 3.11.1 (impératif) · fiches de sensibilisation du 19/10",
      },
      {
        id: "gestion-crise",
        label: "Expliquer ce que fait le service en cas de crise (canicule, grand froid, coupure, épidémie)",
        criteria: ["3.14.2"],
        nature: "OBLIGATION",
        source: "HAS 3.14.2 (impératif) · fiches de sensibilisation du 19/10",
      },
      {
        id: "donnees-personnelles",
        label: "Expliquer comment ses données personnelles sont protégées (RGPD), et ses droits",
        hint: "Qui les voit, combien de temps elles sont gardées, comment demander à les voir ou les corriger.",
        criteria: ["2.2.7"],
        nature: "OBLIGATION",
        source: "HAS 2.2.7 (impératif) · RGPD · fiches de sensibilisation du 19/10",
      },
    ],
  },
  {
    id: "contrat",
    title: "Le contrat (DIPEC)",
    points: [
      {
        id: "prestations-heures",
        label: "Relire ensemble les aides prévues, les jours et le nombre d'heures",
        criteria: ["1.4.1"],
        nature: "OBLIGATION",
        source: "CASF L311-4 (DIPEC) · HAS 1.4.1",
      },
      {
        id: "tarif-reste-a-charge",
        label: "Confirmer le tarif et ce qui reste à payer",
        criteria: [],
        nature: "OBLIGATION",
        source: "CASF L311-4 (DIPEC)",
      },
      {
        id: "attentes",
        label: "Demander ce que la personne attend de l'accompagnement",
        hint: "Ses réponses servent à construire son projet d'accompagnement.",
        criteria: ["1.10.1", "1.4.1"],
        nature: "OBLIGATION",
        source: "HAS 1.10.1",
      },
      {
        id: "entourage",
        label: "Demander qui, dans son entourage, elle veut associer",
        criteria: ["1.11.1"],
        nature: "OBLIGATION",
        source: "HAS 1.11.1",
      },
      {
        id: "retractation",
        label: "Dire qu'elle a 14 jours pour changer d'avis",
        criteria: [],
        nature: "OBLIGATION",
        source: "Code de la consommation L221-18",
        toConfirm: "Application du délai de rétractation aux SAD à confirmer par Sandrine.",
      },
      {
        id: "arret-modification",
        label: "Expliquer comment arrêter ou changer l'accompagnement",
        criteria: [],
        nature: "CHOIX_STRUCTURE",
        source: "Règlement de fonctionnement (préavis choisi par la structure)",
      },
    ],
  },
  {
    id: "avis",
    title: "Son avis compte",
    points: [
      {
        id: "participation-satisfaction",
        label: "Dire qu'on lui demandera son avis (enquête de satisfaction) et qu'elle peut participer à la vie du service",
        criteria: ["1.5.1"],
        nature: "OBLIGATION",
        source: "HAS 1.5.1",
      },
      {
        id: "questions-comprehension",
        label: "Lui demander si elle a des questions, et vérifier qu'elle a compris",
        criteria: ["1.2.2", "1.7.1"],
        nature: "OBLIGATION",
        source: "HAS 1.2.2 · 1.7.1",
      },
    ],
  },
];

export function allAdmissionPoints(): AdmissionExplanation[] {
  return ADMISSION_EXPLANATIONS.flatMap((section) => section.points);
}

// Documents remis en main propre, cochés un à un (preuve de remise — CASF L311-4,
// HAS 1.2.2 « a reçu les documents ») ; le DIPEC signé s'y ajoute.
export const ADMISSION_HANDED_DOCUMENTS = [
  { id: "livret", label: "Livret d'accueil" },
  { id: "charte", label: "Charte des droits et libertés de la personne accueillie" },
  { id: "reglement", label: "Règlement de fonctionnement" },
  { id: "personnes-qualifiees", label: "Liste des personnes qualifiées" },
  { id: "coupon-confiance", label: "Coupon « personne de confiance »" },
  // Call du 28/10/2026 : les fiches de sensibilisation « personne accompagnée » vont
  // dans son dossier, papier et électronique.
  { id: "fiches-sensibilisation", label: "Fiches de sensibilisation (plainte, événement indésirable, maltraitance, crise, données)" },
] as const;

export type HandedDocumentId = (typeof ADMISSION_HANDED_DOCUMENTS)[number]["id"];
