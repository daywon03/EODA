// ─────────────────────────────────────────────────────────────────────────────
// DONNÉES DE DÉMONSTRATION — FICTIVES, marquées comme telles.
//
// Ne vivent QUE dans le navigateur, le temps de la démonstration (« Démonstration —
// rien n'est enregistré ») : aucune n'est envoyée au serveur, aucune ne passe par le
// port HDS. Aucun nom réel : toute personne porte « (fictif) ».
// ─────────────────────────────────────────────────────────────────────────────

export type DemoPerson = {
  id: string;
  name: string;
  gir: number;
  address: string;
  hours: string;
  since: string;
  surveyDone: boolean;
  pap: string[];
  contacts: { who: string; how: string }[];
  journal: { date: string; text: string; possibleAdverseEvent: boolean }[];
  receptionSignedOn: string | null;
};

export const DEMO_STRUCTURE = "SAD Les Glycines (fictif)";
export const DEMO_STAFF = "Camille (fictif)";
export const DEMO_TOTAL_PEOPLE = 48;
export const DEMO_SURVEYS_ALREADY_DONE = 10;

export const DEMO_PEOPLE: readonly DemoPerson[] = [
  {
    id: "d1",
    name: "Mme Odette Marchal (fictif)",
    gir: 2,
    address: "12 rue des Tanneurs, Ville fictive",
    hours: "24 h par mois",
    since: "mars 2024",
    surveyDone: false,
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
  person("d2", "M. Lucien Ferrand (fictif)", 4, "12 h par mois", "janvier 2025", true),
  person("d3", "Mme Yvette Diallo (fictif)", 3, "18 h par mois", "juin 2023", false),
  person("d4", "M. Robert Kessler (fictif)", 1, "40 h par mois", "octobre 2022", true),
  person("d5", "Mme Jeanne Poulain (fictif)", 5, "8 h par mois", "avril 2026", false),
];

function person(id: string, name: string, gir: number, hours: string, since: string, surveyDone: boolean): DemoPerson {
  return {
    id,
    name,
    gir,
    address: "Adresse fictive",
    hours,
    since,
    surveyDone,
    pap: ["Aide au ménage et aux courses", "Préparation des repas"],
    contacts: [{ who: "Proche référent (fictif)", how: "06 00 00 00 00" }],
    journal: [],
    receptionSignedOn: "01/2025",
  };
}

// Repère de couleur du GIR (charge d'aide), toujours accompagné du chiffre.
export function girTone(gir: number): string {
  if (gir <= 2) return "bg-ink-fill text-on-ink";
  if (gir <= 4) return "bg-amber-fill text-ink";
  return "bg-soft text-ink";
}
