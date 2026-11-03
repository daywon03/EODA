// ─────────────────────────────────────────────────────────────────────────────
// DOSSIERS DE LA LISTE « DOCUMENTS » — données pures, sans Prisma
//
// Arborescence arrêtée au call du 29/10/2026 avec Sandrine : un dossier par famille de
// documents, ses lignes en dessous (« qu'on n'ait pas 15 000 lignes pour 15 000 notes
// de service »). Les procédures se rangent en DEUX dossiers : celles du manuel HAS
// (contenu fixe, forme aux couleurs du client) et celles du fonctionnement propre de
// la structure (comment remplir Ximi, accueil téléphonique…).
//
// Insérés en base par 20261103100000_document_folders (même liste, test de
// concordance `apps/web/src/lib/db/seed-data.test.ts`) ; le seed les upserte. Ensuite
// ils appartiennent au cabinet, qui les renomme, en crée et y range ses lignes depuis
// l'écran — un re-seed ne remet jamais une ligne dans son dossier d'origine.
// ─────────────────────────────────────────────────────────────────────────────

export type DocumentFolderSeed = {
  id: string;
  label: string;
  position: number;
  // Lignes du référentiel rangées d'office dans ce dossier (si elles n'en ont aucun).
  codes: readonly string[];
};

export const DOCUMENT_FOLDER_SEEDS: readonly DocumentFolderSeed[] = [
  {
    id: "docfolder-sensibilisation-pro",
    label: "Sensibilisation des professionnels",
    position: 1,
    codes: ["QUALITE_FICHE_SENSIBILISATION"],
  },
  {
    id: "docfolder-sensibilisation-pa",
    label: "Sensibilisation des personnes accompagnées",
    position: 2,
    codes: [
      "PA_FICHE_P1_PLAINTES",
      "PA_FICHE_P2_EVENEMENTS_INDESIRABLES",
      "PA_FICHE_P3_MALTRAITANCE",
      "PA_FICHE_P4_GESTION_CRISE",
      "PA_FICHE_P5_DONNEES",
    ],
  },
  { id: "docfolder-strategie", label: "Stratégie", position: 3, codes: [] },
  {
    id: "docfolder-pilotage-qualite",
    label: "Pilotage qualité",
    position: 4,
    codes: ["QUALITE_POLITIQUE_INDEX", "QUALITE_GABARIT_CR_REUNION"],
  },
  { id: "docfolder-notes-service", label: "Notes de service", position: 5, codes: ["FONCT_NOTE_SERVICE"] },
  {
    id: "docfolder-process-has",
    label: "Process HAS",
    position: 6,
    codes: ["P12_PROCEDURE", "P13_PROCEDURE", "P11_PROCEDURE", "P22_PROCEDURE_RGPD", "QUALITE_PROCEDURE_EI_PLAINTES"],
  },
  { id: "docfolder-process-structure", label: "Process de la structure", position: 7, codes: [] },
];
