// ─────────────────────────────────────────────────────────────────────────────
// DONNÉES DE SEED QUE DES MIGRATIONS PORTENT AUSSI
//
// Sur une base NEUVE, `migrate deploy` s'exécute avant le seed : une migration de
// données (UPDATE / INSERT … SELECT) qui vise des lignes créées par le seed ne touche
// donc rien. Le test de bout en bout du 12/10/2026 l'a constaté deux fois (bug 7) :
// aucun document « réclamé » au client, aucun critère SAD mixte. Le seed reprend ces
// données ici, une seule fois.
//
// La duplication avec le SQL des migrations est tenue MÉCANIQUEMENT par
// `apps/web/src/lib/db/seed-data.test.ts`, qui relit les fichiers de migration :
// une migration commitée ne se modifie jamais, c'est donc ce module qui la suit.
//
// Données pures : aucun import de Prisma, pour rester importable par les tests.
// ─────────────────────────────────────────────────────────────────────────────

export const SEED_TENANT_ID = "tenant-eoda-conseil";

// Compte client de test : déclaré dans le cabinet du seed, SANS structure — une fiche
// ne naît que de la signature d'un devis (CLAUDE.md §7). Son tenant suffit à le rendre
// rattachable depuis une fiche (existing-account-service) ; sans lui, il restait
// opaque pour tous les cabinets.
export const SEED_CLIENT_USER = {
  email: "client@eoda-test.local",
  name: "Utilisateur Client (test)",
  tenantId: SEED_TENANT_ID,
} as const;

// Les SEPT documents de la loi 2002-2 réclamés à la structure.
// Sources : migration 20260827140000_document_types_requested (cinq codes, call du
// 26/08/2026) puis 20261010120000_support_mode_client_acceptance (CR de CVS et liste
// des personnes qualifiées, décision du 15/09/2026). Le seed ne pose ce drapeau qu'à
// la CRÉATION : il reste ensuite modifiable par CABINET_ADMIN, et un re-seed n'écrase
// jamais son choix.
export const REQUESTED_FROM_CLIENT_DOCUMENT_CODES: readonly string[] = [
  "L2002_PROJET_SERVICE",
  "L2002_CHARTE_DROITS",
  "L2002_LIVRET_ACCUEIL",
  "L2002_DIPC",
  "L2002_REGLEMENT_FONCTIONNEMENT",
  "L2002_CR_CVS",
  "L2002_PERSONNES_QUALIFIEES",
];

export type SadMixteCriterionSeed = {
  id: string;
  code: string;
  label: string;
  requirementLevel: "STANDARD" | "IMPERATIF";
  chapterNumber: 1 | 2 | 3;
  objectiveCode: string;
};

// Les 15 critères « Médico-social » du manuel HAS (juillet 2025) absents des grilles
// Synaé SAD aide — source et justification : migration 20261011110000_sad_mixte_criteria.
// `applicableTo = SAD_MIXTE` pour tous. SANS éléments d'évaluation (le manuel ne les
// porte pas, aucune grille SAD mixte fournie). Trois intitulés tronqués, signalés.
export const SAD_MIXTE_CRITERIA: readonly SadMixteCriterionSeed[] = [
  {
    id: "crit-sad-mixte-1-15-1",
    code: "1.15.1",
    label: "La personne accompagnée est informée des soins qui lui sont proposés, selon des modalités adaptées.",
    requirementLevel: "STANDARD",
    chapterNumber: 1,
    objectiveCode: "1.15",
  },
  {
    id: "crit-sad-mixte-1-15-2",
    code: "1.15.2",
    label:
      "La personne accompagnée bénéficie de temps d'échange et de soutien autour de son état de santé, des soins possibles et de la stratégie thérapeutique proposée.",
    requirementLevel: "STANDARD",
    chapterNumber: 1,
    objectiveCode: "1.15",
  },
  {
    id: "crit-sad-mixte-1-15-3",
    code: "1.15.3",
    label: "La personne bénéficie d'un accompagnement adapté, en cas de refus de soins.",
    requirementLevel: "STANDARD",
    chapterNumber: 1,
    objectiveCode: "1.15",
  },
  {
    id: "crit-sad-mixte-1-15-4",
    code: "1.15.4",
    label:
      "La personne accompagnée est associée à la gestion de son traitement médicamenteux pour favoriser sa compréhension et son adhésion et s'assurer de sa continuité.",
    requirementLevel: "STANDARD",
    chapterNumber: 1,
    objectiveCode: "1.15",
  },
  {
    id: "crit-sad-mixte-1-15-7",
    code: "1.15.7",
    label:
      "Les professionnels tiennent compte du rapport bénéfice/risque pour proposer des modalités d'accompagnement adaptées à la santé de la personne.",
    requirementLevel: "STANDARD",
    chapterNumber: 1,
    objectiveCode: "1.15",
  },
  {
    id: "crit-sad-mixte-1-15-8",
    code: "1.15.8",
    label:
      "Les professionnels s'appuient sur des activités et des approches non médicamenteuses dans l'accompagnement de la personne.",
    requirementLevel: "STANDARD",
    chapterNumber: 1,
    objectiveCode: "1.15",
  },
  {
    id: "crit-sad-mixte-1-15-9",
    code: "1.15.9",
    label:
      "Les professionnels sont régulièrement sensibilisés et/ou formés aux activités et approches non médicamenteuses.",
    requirementLevel: "STANDARD",
    chapterNumber: 1,
    objectiveCode: "1.15",
  },
  {
    id: "crit-sad-mixte-1-16-4",
    code: "1.16.4",
    label:
      "Les professionnels coconstruisent avec la personne accompagnée, la stratégie de prise en charge de la douleur.",
    requirementLevel: "STANDARD",
    chapterNumber: 1,
    objectiveCode: "1.16",
  },
  {
    id: "crit-sad-mixte-2-6-2",
    code: "2.6.2",
    label:
      "Les professionnels coconstruisent le projet d'accompagnement en santé mentale avec la personne et le réévaluent régulièrement.",
    requirementLevel: "STANDARD",
    chapterNumber: 2,
    objectiveCode: "2.6",
  },
  {
    id: "crit-sad-mixte-2-7-1",
    code: "2.7.1",
    label:
      "Les professionnels recueillent et tracent les volontés de la personne sur son accompagnement de fin de vie et ses directives anticipées, selon des modalités adaptées.",
    requirementLevel: "STANDARD",
    chapterNumber: 2,
    objectiveCode: "2.7",
  },
  {
    id: "crit-sad-mixte-2-7-2",
    code: "2.7.2",
    label:
      "Les professionnels échangent en équipe pour adapter l'accompagnement à la fin de vie de la personne, dans le respect des volontés exprimées.",
    requirementLevel: "STANDARD",
    chapterNumber: 2,
    objectiveCode: "2.7",
  },
  {
    id: "crit-sad-mixte-3-6-1",
    code: "3.6.1",
    label: "L'ESSMS définit sa stratégie de gestion du risque […] (intitulé tronqué — à compléter depuis le manuel HAS)",
    requirementLevel: "STANDARD",
    chapterNumber: 3,
    objectiveCode: "3.6",
  },
  {
    id: "crit-sad-mixte-3-6-2",
    code: "3.6.2",
    label: "Les professionnels respectent la sécurisation du circuit du médicament.",
    requirementLevel: "IMPERATIF",
    chapterNumber: 3,
    objectiveCode: "3.6",
  },
  {
    id: "crit-sad-mixte-3-6-3",
    code: "3.6.3",
    label:
      "Les professionnels accompagnent les personnes dans la […] (intitulé tronqué — à compléter depuis le manuel HAS)",
    requirementLevel: "STANDARD",
    chapterNumber: 3,
    objectiveCode: "3.6",
  },
  {
    id: "crit-sad-mixte-3-6-5",
    code: "3.6.5",
    label:
      "Les professionnels sont régulièrement sensibilisés et/ou […] (intitulé tronqué — à compléter depuis le manuel HAS)",
    requirementLevel: "STANDARD",
    chapterNumber: 3,
    objectiveCode: "3.6",
  },
];
