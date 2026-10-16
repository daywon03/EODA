import type { BeneficiaryDocumentKind } from "@/lib/hds/beneficiary-data-port";

// ─────────────────────────────────────────────────────────────────────────────
// FEUILLE DE RÉCEPTION — points « à dire » par document présenté (lot C).
//
// ⚠️ PROVISOIRES : rédigés d'après context/10 §6 (livret, règlement, DIPC) et la
// maquette « Tablette terrain », en attente de validation par Sandrine
// (`PROVISIONAL = true`, affiché à l'écran). Feuille de réception UNIQUE (décision 6
// des maquettes v2) : les trois documents sont présentés un par un, chaque point est
// coché avec la personne, puis UNE signature atteste la réception. Le DIPC signé à
// part reste une option de la structure.
//
// Corriger un point incrémente `RECEPTION_POINTS_VERSION` : la preuve de signature
// recopie le texte coché, la version dit lequel.
// ─────────────────────────────────────────────────────────────────────────────

export const RECEPTION_POINTS_PROVISIONAL = true;
export const RECEPTION_POINTS_VERSION = 1;

export type ReceptionDocument = {
  kind: Extract<BeneficiaryDocumentKind, "LIVRET_REMIS" | "REGLEMENT_REMIS" | "DIPC">;
  label: string;
  points: readonly { id: string; label: string }[];
};

export const RECEPTION_DOCUMENTS: readonly ReceptionDocument[] = [
  {
    kind: "LIVRET_REMIS",
    label: "Livret d'accueil",
    points: [
      { id: "livret-service", label: "Présenter le service et ses horaires" },
      { id: "livret-qui-appeler", label: "Expliquer qui appeler en cas de problème" },
      { id: "livret-charte", label: "Montrer la charte des droits et libertés" },
      { id: "livret-personnes-qualifiees", label: "Donner la liste des personnes qualifiées" },
    ],
  },
  {
    kind: "REGLEMENT_REMIS",
    label: "Règlement de fonctionnement",
    points: [
      { id: "reglement-interventions", label: "Expliquer les règles d'intervention au domicile" },
      { id: "reglement-annuler", label: "Expliquer comment annuler une intervention" },
      { id: "reglement-reclamation", label: "Expliquer comment faire une réclamation" },
    ],
  },
  {
    kind: "DIPC",
    label: "DIPC",
    points: [
      { id: "dipc-prestations", label: "Relire ensemble les prestations prévues" },
      { id: "dipc-heures", label: "Confirmer le nombre d'heures par mois" },
      { id: "dipc-tarif", label: "Confirmer le tarif et le reste à charge" },
      { id: "dipc-personne-confiance", label: "Présenter le coupon « personne de confiance »" },
      { id: "dipc-urgences", label: "Montrer les numéros d'urgence (17, 112, 114)" },
    ],
  },
];

// La remise du DIPC se fait au plus tard 15 jours après le début de l'accompagnement
// (context/10 §6, revu le 22/09) — possible le jour même.
export const DIPC_DELIVERY_MAX_DAYS = 15;
