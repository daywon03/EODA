"use client";

import dynamic from "next/dynamic";

// Réglages d'un document chargés HORS du premier chargement de la page Documents
// (budget de JavaScript, check:bundle). Un `dynamic()` posé dans un composant serveur
// ne découpe rien : la référence client reste dans le paquet de la page. Il faut une
// frontière client — c'est ce fichier.
//   - « Classement et consigne d'analyse » : replié par défaut ;
//   - la forme de participation : une seule ligne de la checklist en a besoin.
export const DocumentSettingsPanel = dynamic(() =>
  import("./DocumentSettingsPanel").then((m) => m.DocumentSettingsPanel)
);

// Renommer la ligne (administration seule, geste rare).
export const RenameDocumentType = dynamic(() =>
  import("@/components/checklist/RenameDocumentType").then((m) => m.RenameDocumentType)
);

// Laboratoire d'analyse (cabinet, replié par défaut) : prompt montré, essais, verdicts.
export const AnalysisLabPanel = dynamic(() => import("./AnalysisLabPanel").then((m) => m.AnalysisLabPanel));

export const ParticipationFormPicker = dynamic(() =>
  import("@/components/checklist/ParticipationFormPicker").then((m) => m.ParticipationFormPicker)
);

// Dossier de la ligne (administration seule, geste rare — call du 29/10/2026).
export const DocumentFolderPicker = dynamic(() =>
  import("@/components/checklist/DocumentFolderPicker").then((m) => m.DocumentFolderPicker)
);

// Critères HAS d'un type (onglet « Critères HAS », 09/11/2026) : chargé à l'ouverture
// de l'onglet seulement.
export const CriterionLinker = dynamic(() => import("@/components/criteres/CriterionLinker").then((m) => m.CriterionLinker));

// « Retirer cette ligne » (administration seule, geste rare — 09/11/2026).
export const RemoveDocumentTypeButton = dynamic(() =>
  import("./RemoveDocumentTypeButton").then((m) => m.RemoveDocumentTypeButton)
);

// « Gérer les dossiers » / « Importer un tableur » (administration seule, gestes rares).
export const DocumentFolderManager = dynamic(() =>
  import("@/components/checklist/DocumentFolderManager").then((m) => m.DocumentFolderManager)
);
