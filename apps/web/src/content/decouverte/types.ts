// Forme d'une grille d'entretien. Le CONTENU (les questions) vit dans
// `grille.ts` ; la forme, ici ; les règles, dans
// `lib/services/discovery-grid-service.ts`. Trois fichiers parce que ce sont trois
// rythmes de changement : les questions bougeront souvent, la forme rarement, les
// règles jamais sans test.

export type DiscoveryFieldKind =
  // Réponse courte — un nom, un nombre, une date approximative.
  | "SHORT_TEXT"
  // Réponse développée : ce qui se dit en réunion et qu'on ne veut pas perdre.
  | "LONG_TEXT"
  // Choix unique dans une liste fermée. `options` devient obligatoire.
  | "CHOICE";

export type DiscoveryField = {
  // Identifiant STABLE, jamais réutilisé pour une autre question : c'est la clé de
  // stockage des réponses. Renommer un identifiant orpheline la réponse déjà saisie.
  id: string;
  label: string;
  kind: DiscoveryFieldKind;
  // Pourquoi la question est posée. Affichée sous le champ : une grille dont on ne
  // comprend pas l'intérêt se remplit à moitié.
  hint?: string;
  options?: readonly string[];
};

export type DiscoverySection = {
  id: string;
  title: string;
  // Ce que la section sert à décider. C'est le fil de la réunion, pas un titre.
  purpose: string;
  fields: readonly DiscoveryField[];
};

export type DiscoveryGrid = {
  // Version du gabarit, affichée à l'écran. Elle change à chaque révision de la
  // grille : les réponses saisies sous une version précédente restent en base, et
  // celles dont la question a disparu sont ignorées à la lecture.
  version: string;
  sections: readonly DiscoverySection[];
};
