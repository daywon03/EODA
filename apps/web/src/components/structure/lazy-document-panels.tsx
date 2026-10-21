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

export const ParticipationFormPicker = dynamic(() =>
  import("@/components/checklist/ParticipationFormPicker").then((m) => m.ParticipationFormPicker)
);
