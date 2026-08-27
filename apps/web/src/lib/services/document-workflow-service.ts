// ─────────────────────────────────────────────────────────────────────────────
// PARCOURS D'UN DOCUMENT — ce que le cabinet voit avancer.
//
// Dicté par Sandrine le 26/08 : « documents téléchargés, documents analysés,
// documents modifiés, documents renvoyés, et relecture […] et c'est complet quand
// tout est fait, quand c'est uploadé, analysé, modifié, relu et validé ». Et, dans la
// foulée : « mets plutôt le statut manquant, c'est pour le client » — les deux
// portails ne regardent pas la même chose. Le client suit ce qu'il doit fournir ; le
// cabinet suit ce qu'il doit produire.
//
// Quatre étapes sur cinq se DÉRIVENT de faits déjà en base. La cinquième, la
// validation, est une décision et se stocke (`Document.validatedAt`) — même règle que
// la clôture d'une mission.
//
// Règles PURES : ni Prisma, ni React.
// ─────────────────────────────────────────────────────────────────────────────

export const DOCUMENT_STEPS = [
  "ATTENDU",
  "DEPOSE",
  "ANALYSE",
  "MIS_EN_CONFORMITE",
  "RESTITUE",
  "VALIDE",
] as const;
export type DocumentStep = (typeof DOCUMENT_STEPS)[number];

export const DOCUMENT_STEP_LABELS: Record<DocumentStep, string> = {
  ATTENDU: "Attendu",
  DEPOSE: "Déposé",
  ANALYSE: "Analysé",
  MIS_EN_CONFORMITE: "Mis en conformité",
  RESTITUE: "Restitué au client",
  VALIDE: "Validé",
};

// Ce dont la dérivation a besoin. Étroit à dessein : l'appelant ne doit pas croire
// qu'un autre champ entre dans le calcul.
export type DocumentWorkflowFacts = {
  hasVersion: boolean;
  hasAnalysis: boolean;
  // Une version produite par le cabinet à partir de celle du client — c'est ce qui
  // distingue « mis en conformité » de « simplement analysé ».
  hasCabinetVersion: boolean;
  // L'analyse a été relue et rendue visible au client (analysisReviewedAt).
  analysisRestituted: boolean;
  validatedAt: Date | null;
};

// L'étape la plus avancée ATTEINTE. Une étape n'annule pas les précédentes : un
// document validé a forcément été déposé. On rend donc le point le plus haut du
// parcours, et l'écran affiche le chemin parcouru.
export function deriveDocumentStep(facts: DocumentWorkflowFacts): DocumentStep {
  if (facts.validatedAt !== null) return "VALIDE";
  if (facts.analysisRestituted) return "RESTITUE";
  if (facts.hasCabinetVersion) return "MIS_EN_CONFORMITE";
  if (facts.hasAnalysis) return "ANALYSE";
  if (facts.hasVersion) return "DEPOSE";
  return "ATTENDU";
}

export function stepIndex(step: DocumentStep): number {
  return DOCUMENT_STEPS.indexOf(step);
}

// « Cette étape est-elle franchie ? » — pour rendre un fil d'étapes où le chemin
// parcouru se distingue de ce qui reste à faire.
export function isStepReached(current: DocumentStep, step: DocumentStep): boolean {
  return stepIndex(current) >= stepIndex(step);
}

// Ce qu'il reste à faire, en une phrase, à la première personne du cabinet. Un fil
// d'étapes dit OÙ on en est ; cette phrase dit QUOI FAIRE, et c'est elle qu'on lit
// quand on ouvre la fiche pour travailler.
export function describeNextStep(step: DocumentStep): string {
  switch (step) {
    case "ATTENDU":
      return "En attente du dépôt par le client.";
    case "DEPOSE":
      return "À analyser — l'analyse se lance au dépôt, relancez-la si elle a échoué.";
    case "ANALYSE":
      return "À mettre en conformité : corriger le document au regard des manques relevés.";
    case "MIS_EN_CONFORMITE":
      return "À restituer : relisez l'analyse, puis rendez-la visible au client.";
    case "RESTITUE":
      return "À valider une fois le document revu avec la structure.";
    case "VALIDE":
      return "Document validé — rien à faire.";
  }
}

// Compteurs du portail interne, « reflet en compteurs du portail client » (§12.4).
// Comptés sur l'étape ATTEINTE, donc cumulatifs : un document validé compte aussi
// comme déposé. Un décompte non cumulatif ferait chuter « analysés » à mesure que le
// travail avance, ce qui se lit comme une régression.
export type DocumentStepCounters = Record<DocumentStep, number>;

export function countByStep(steps: DocumentStep[]): DocumentStepCounters {
  const counters: DocumentStepCounters = {
    ATTENDU: 0,
    DEPOSE: 0,
    ANALYSE: 0,
    MIS_EN_CONFORMITE: 0,
    RESTITUE: 0,
    VALIDE: 0,
  };

  for (const step of steps) {
    counters.ATTENDU++;
    for (const candidate of DOCUMENT_STEPS) {
      if (candidate === "ATTENDU") continue;
      if (isStepReached(step, candidate)) counters[candidate]++;
    }
  }

  return counters;
}

// ── Qui peut supprimer quoi ──────────────────────────────────────────────────
//
// Demande explicite du 26/08 : « est-ce qu'il est pertinent que moi, je supprime un
// document envoyé par le client ? […] je pense qu'il faut m'enlever à moi l'option de
// suppression. Moi, je prends ce qu'ils me donnent. » Et, dans la foulée : « il faut
// que je puisse aussi supprimer les documents que je mets, si je fais une erreur ».
//
// Deux règles en découlent, et une troisième par prudence :
//   - chacun ne supprime que ce qu'il a déposé — le cabinet ne peut pas effacer une
//     pièce du client, ce serait un risque juridique autant qu'une mauvaise manip ;
//   - le client doit pouvoir corriger son propre dépôt, sinon une erreur de catégorie
//     devient définitive ;
//   - seule la DERNIÈRE version est supprimable : au-delà, ce n'est plus une
//     correction, c'est une réécriture de l'historique.
export function canDeleteVersion(params: {
  actorIsCabinet: boolean;
  versionProducedByCabinet: boolean;
  isLatest: boolean;
}): boolean {
  if (!params.isLatest) return false;
  return params.actorIsCabinet === params.versionProducedByCabinet;
}
