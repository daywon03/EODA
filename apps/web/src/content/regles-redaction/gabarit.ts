// ─────────────────────────────────────────────────────────────────────────────
// RÈGLE DE GABARIT D'UN DOCUMENT EODA (E4, call du 09/11/2026) — contenu versionné,
// PROVISOIRE, À VALIDER PAR SANDRINE.
//
// Sandrine : « il revient toujours sur l'emplacement d'archivage et la date de
// prochaine révision… il faut une règle : version, pied de page, date, date de
// révision ». Et pour les fiches de sensibilisation, « la date d'upload suffit ».
//
// Ce fichier est la source UNIQUE de cette règle :
//   - rendue dans le cahier de style de la génération (`index.ts`, section
//     « Gabarit ») ;
//   - lue par la plateforme à l'enregistrement d'une version N+1 (version et date
//     écrites par elle, jamais par l'IA — `document-identity-service.ts`) ;
//   - remise à l'ANALYSE d'une fiche de sensibilisation, dans le message (le prompt
//     système de l'analyse a une empreinte figée et n'est PAS modifié) ;
//   - affichée dans « Contenus à valider » (`content-review-service.ts`).
// Changer une règle = changer `TEMPLATE_RULES_VERSION`.
// ─────────────────────────────────────────────────────────────────────────────

export const TEMPLATE_RULES_VERSION = "gabarit v01 — 10/11/2026";
export const TEMPLATE_RULES_STATUS = "Provisoire, à valider par Sandrine";

export type IdentityField = {
  id: string;
  label: string;
  // PLATEFORME : écrit par la plateforme à l'enregistrement de la version N+1.
  // DOCUMENT : recopié du document, sinon champ [À compléter : …].
  writtenBy: "PLATEFORME" | "DOCUMENT";
  hint: string;
};

// Bloc d'identification attendu en tête de tout document EODA (hors fiche de
// sensibilisation).
export const IDENTITY_BLOCK_FIELDS: readonly IdentityField[] = [
  {
    id: "version",
    label: "Version",
    writtenBy: "PLATEFORME",
    hint: "Passe à la version suivante à chaque enregistrement (1 → 1.1, 1.1 → 1.2, V2 → V2.1).",
  },
  {
    id: "date-mise-a-jour",
    label: "Date de mise à jour",
    writtenBy: "PLATEFORME",
    hint: "La date du jour de l'enregistrement, au format déjà utilisé par le document.",
  },
  {
    id: "redaction-validation",
    label: "Rédigé par / validé par",
    writtenBy: "DOCUMENT",
    hint: "Par la FONCTION (direction, référent qualité), jamais par un nom de personne.",
  },
  {
    id: "archivage",
    label: "Emplacement d'archivage",
    writtenBy: "DOCUMENT",
    hint: "Où le document se range (dossier partagé, classeur, logiciel) : recopié du document, sinon à compléter.",
  },
  {
    id: "prochaine-revision",
    label: "Date de prochaine révision",
    writtenBy: "DOCUMENT",
    hint: "Choisie par la structure : jamais calculée ni inventée par l'IA.",
  },
];

export const FOOTER_RULE =
  "Pied de page : la mention de paternité EODA et le numéro de page, ajoutés à l'export par la plateforme.";

// Fiche de sensibilisation (professionnels ou personnes accompagnées).
export const AWARENESS_SHEET_RULE =
  "Fiche de sensibilisation : pas de bloc d'identification. La date de dépôt sur la plateforme fait foi ; " +
  "n'ajoute ni version, ni date, ni emplacement d'archivage, ni date de prochaine révision.";

// Phrase remise à l'ANALYSE d'une fiche de sensibilisation (message utilisateur).
export const AWARENESS_SHEET_ANALYSIS_NOTE =
  "Ce document est une fiche de sensibilisation : la date de son dépôt sur la plateforme fait foi. " +
  "Ne signale pas comme manquants une version, une date, un emplacement d'archivage ni une date de prochaine révision.";

// Rendu des règles du gabarit pour le cahier de style de la génération.
export function templateRules(): string[] {
  const platform = IDENTITY_BLOCK_FIELDS.filter((f) => f.writtenBy === "PLATEFORME").map((f) => f.label.toLowerCase());
  const document = IDENTITY_BLOCK_FIELDS.filter((f) => f.writtenBy === "DOCUMENT").map((f) => f.label.toLowerCase());
  return [
    `Bloc d'identification en tête du document : ${IDENTITY_BLOCK_FIELDS.map((f) => f.label.toLowerCase()).join(", ")}. [10 §4, call du 09/11/2026 — ${TEMPLATE_RULES_STATUS.toLowerCase()}]`,
    `${capitalize(platform.join(" et "))} : recopie-les à l'identique, la plateforme les met à jour à l'enregistrement. [10 §4, call du 09/11/2026]`,
    `${capitalize(document.join(", "))} : recopie ceux du document ; s'ils manquent, écris un champ [À compléter : …], jamais une valeur inventée. [10 §4, call du 09/11/2026 — ${TEMPLATE_RULES_STATUS.toLowerCase()}]`,
    `${FOOTER_RULE} [10 §4, call du 09/11/2026]`,
    `${AWARENESS_SHEET_RULE} [10 §4, call du 09/11/2026 — ${TEMPLATE_RULES_STATUS.toLowerCase()}]`,
  ];
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
