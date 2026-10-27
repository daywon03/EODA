// ─────────────────────────────────────────────────────────────────────────────
// DONNÉES DE DÉMONSTRATION — FICTIVES, marquées comme telles.
//
// Ne vivent QUE dans le navigateur, le temps de la démonstration (« Démonstration —
// rien n'est enregistré ») : aucune n'est envoyée au serveur, aucune ne passe par le
// port HDS. Aucun nom réel : toute personne porte « (fictif) ».
// ─────────────────────────────────────────────────────────────────────────────

// Deux questionnaires par personne (gabarit « Enquête de satisfaction » v1.0) : celui
// de la personne accompagnée (FALC, 12 questions) et celui d'un proche (14 questions).
// Un seul booléen ne pouvait pas dire « la personne a répondu, le proche non » — et
// c'est pourtant l'état réel le plus fréquent, la famille répondant souvent à part.
export type DemoSurveyState = { PERSONNE: boolean; FAMILLE: boolean };

export type DemoPerson = {
  id: string;
  name: string;
  gir: number;
  address: string;
  hours: string;
  since: string;
  surveys: DemoSurveyState;
  pap: string[];
  contacts: { who: string; how: string }[];
  journal: { date: string; text: string; possibleAdverseEvent: boolean }[];
  receptionSignedOn: string | null;
};

export const DEMO_STRUCTURE = "SAD Les Glycines (fictif)";

// DIPC FICTIF de la démonstration (accueil et contrat, 26/10/2026) : il montre la
// fusion des champs `{{…}}` saisis une fois. Le vrai texte est celui qu'EODA valide
// pour chaque structure.
export const DEMO_DIPC = {
  versionId: "demo",
  versionNumber: 1,
  validatedOn: "2026-10-01",
  // Même FORME que le texte extrait d'un DIPC d'EODA (Markdown du Word, pointillés,
  // « [à compléter] », cases) : la tablette en dérive sa copie à remplir
  // (dipc-tablet-preparation), exactement comme pour une vraie structure.
  text: [
    "**Document individuel de prise en charge** (exemple fictif)",
    "**Entre** {{structure.nom}}, d'une part,",
    "**Et**",
    "Nom, Prénom : ……………………………………………………..",
    "Domicile : …………………………………………………………………",
    "Téléphone : ……………………………………………",
    "– Personne accompagnée : _\\[Nom et prénom\\]_ ;",
    "– Représentant légal, le cas échéant : _\\[Nom, prénom et qualité_\\] ;",
    "# Volet aide",
    "**Article 1 – Objet.** Le présent document définit les objectifs et la nature de l'accompagnement. Aide financée : {{aide.types}}.",
    "**Article 2 – Durée.** Choisir l’une ou l’autre des options suivantes :",
    "*   Option n°1 – Le présent contrat est conclu pour une durée indéterminée",
    "*   Option n°2 – Le présent contrat est conclu pour une durée déterminée du JJ/MM/AAAA au JJ/MM/AAAA",
    "**Éléments du projet d’accompagnement personnalisé**",
    "Objectifs de l’accompagnement",
    "\\[à compléter\\]",
    "Fréquence, jours et horaires des interventions",
    "\\[à compléter\\]",
    "Risque de chutes (critère 2.4.3)",
    "\\[à compléter\\]",
    "Réévaluation annuelle ; prochaine révision prévue le : ../../....",
    "**Remise et signature**",
    "Date d’admission : \\_\\_\\_\\_ / \\_\\_\\_\\_ / \\_\\_\\_\\_\\_\\_\\_\\_",
    "☐ Le présent document individuel de prise en charge et ses annexes",
    "☐ Le livret d’accueil",
    "Fait à \\_\\_\\_\\_\\_\\_\\_\\_, le \\_\\_\\_\\_ / \\_\\_\\_\\_ / \\_\\_\\_\\_\\_\\_\\_\\_, en deux exemplaires originaux.",
    "Nom, fonction :",
    "Nom, prénom :",
    "# ANNEXE 1 – FORMULAIRE DE RÉTRACTATION (rempli par la personne, si elle le souhaite)",
    "Nom du (des) consommateur(s) :",
  ].join("\n\n"),
} as const;
export const DEMO_STAFF = "Camille (fictif)";
export const DEMO_TOTAL_PEOPLE = 48;
// Compté en QUESTIONNAIRES, pas en personnes : chaque personne en a deux.
export const DEMO_SURVEYS_ALREADY_DONE = 10;

export const DEMO_PEOPLE: readonly DemoPerson[] = [
  {
    id: "d1",
    name: "Mme Odette Marchal (fictif)",
    gir: 2,
    address: "12 rue des Tanneurs, Ville fictive",
    hours: "24 h par mois",
    since: "mars 2024",
    surveys: { PERSONNE: false, FAMILLE: true },
    pap: [
      "Aide au lever et au coucher, tous les jours",
      "Repas du midi, du lundi au vendredi",
      "Sortie accompagnée le jeudi après-midi",
      "Surveiller l'hydratation pendant l'été",
    ],
    contacts: [
      { who: "Sa fille (fictif)", how: "06 00 00 00 00 · à prévenir en premier" },
      { who: "Médecin traitant (fictif)", how: "01 00 00 00 00" },
    ],
    journal: [
      { date: "02/10", text: "Chute sans gravité dans la salle de bain. Fille prévenue.", possibleAdverseEvent: true },
      { date: "18/09", text: "Changement d'intervenante le mardi.", possibleAdverseEvent: false },
    ],
    receptionSignedOn: "03/2024",
  },
  person("d2", "M. Lucien Ferrand (fictif)", 4, "12 h par mois", "janvier 2025", true, true),
  person("d3", "Mme Yvette Diallo (fictif)", 3, "18 h par mois", "juin 2023", false, false),
  person("d4", "M. Robert Kessler (fictif)", 1, "40 h par mois", "octobre 2022", true, true),
  person("d5", "Mme Jeanne Poulain (fictif)", 5, "8 h par mois", "avril 2026", true, false),
];

function person(
  id: string,
  name: string,
  gir: number,
  hours: string,
  since: string,
  personneDone: boolean,
  familleDone: boolean
): DemoPerson {
  return {
    id,
    name,
    gir,
    address: "Adresse fictive",
    hours,
    since,
    surveys: { PERSONNE: personneDone, FAMILLE: familleDone },
    pap: ["Aide au ménage et aux courses", "Préparation des repas"],
    contacts: [{ who: "Proche référent (fictif)", how: "06 00 00 00 00" }],
    journal: [],
    receptionSignedOn: "01/2025",
  };
}

/** Nombre de questionnaires faits pour une personne (0, 1 ou 2). */
export function surveyCount(person: DemoPerson): number {
  return (person.surveys.PERSONNE ? 1 : 0) + (person.surveys.FAMILLE ? 1 : 0);
}

/** Ce qu'on attend d'une personne : les deux questionnaires. */
export const SURVEYS_PER_PERSON = 2;

// Repère de couleur du GIR (charge d'aide), toujours accompagné du chiffre.
export function girTone(gir: number): string {
  if (gir <= 2) return "bg-ink-fill text-on-ink";
  if (gir <= 4) return "bg-amber-fill text-ink";
  return "bg-soft text-ink";
}
