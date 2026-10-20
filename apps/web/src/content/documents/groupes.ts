// ─────────────────────────────────────────────────────────────────────────────
// RANGEMENT DES TYPES DE DOCUMENT EN SEPT GROUPES — contenu, pas schéma
//
// Les sept groupes de l'espace « structure accompagnée » des maquettes v2 : Loi 2002-2 ·
// Processus · Gestion des risques · Personne accompagnée · Registres · Ressources
// humaines · Qualité. C'est un classement D'AFFICHAGE, comme `TemplateCategory` : il
// n'appartient qu'à EODA et peut bouger sans migration. Il est DISTINCT de l'enum
// `DocumentCategory` (LOI_2002_2 / FONCTIONNEMENT / QUALITE_RISQUES / RH), qui classe
// les pièces attendues au regard de la loi et ne s'invente pas (CLAUDE.md §7) — les
// deux ne se remplacent jamais l'un par l'autre.
//
// Branché sur « Mes documents » du portail client le 15/10/2026. `groupes.test.ts` échoue
// si un type du seed n'a pas de groupe, ou si un code rangé ici n'existe pas.
//
// Choix de rangement (provisoires, à relire par Sandrine) :
//  - Loi 2002-2 : les sept documents de la loi, plus le questionnaire d'enquête et sa
//    synthèse — « autre forme de participation » des personnes (context/10 §6), comme
//    la maquette les y range ;
//  - Processus : les procédures écrites (plaintes, EI, maltraitance, RGPD —
//    numérotation du Guide de Sandrine, qui diffère de celle de la maquette) et leurs
//    modèles d'annexe (accusé de réception, réponse, fiche de déclaration, FAMO) ;
//  - Gestion des risques : plans (crise, PCA, plan bleu), cartographie, annuaire,
//    DUERP (comme la maquette), sécurité des données (AIPD, droits d'accès) ;
//  - Ressources humaines : ce qui s'adresse aux professionnels — livret, règlement
//    intérieur, notes de service, fiches, affiches, émargements de sensibilisation.
// ─────────────────────────────────────────────────────────────────────────────

export const DOCUMENT_GROUPS = [
  { id: "LOI_2002_2", label: "Loi 2002-2" },
  // Libellé de la maquette « structure accompagnée », sans la numérotation interne.
  // « Processus P1-P7 » était un sigle de travail (nos codes sont P11/P12/P13/P14/P22) :
  // il n'apprend rien à une structure et ne s'adresse pas à elle.
  { id: "PROCESSUS", label: "Processus" },
  { id: "RISQUES", label: "Gestion des risques" },
  { id: "PERSONNE_ACCOMPAGNEE", label: "Personne accompagnée" },
  { id: "REGISTRES", label: "Registres" },
  { id: "RESSOURCES_HUMAINES", label: "Ressources humaines" },
  { id: "QUALITE", label: "Qualité" },
] as const;

export type DocumentGroupId = (typeof DOCUMENT_GROUPS)[number]["id"];

export const DOCUMENT_GROUP_CODES: Readonly<Record<DocumentGroupId, readonly string[]>> = {
  LOI_2002_2: [
    "L2002_PROJET_SERVICE",
    "L2002_CHARTE_DROITS",
    "L2002_LIVRET_ACCUEIL",
    "L2002_CR_CVS",
    "L2002_DIPC",
    "L2002_REGLEMENT_FONCTIONNEMENT",
    "L2002_PERSONNES_QUALIFIEES",
    "QUALITE_ENQUETE_QUESTIONNAIRE",
    "QUALITE_ENQUETES_SATISFACTION",
  ],
  PROCESSUS: [
    "P12_PROCEDURE",
    "P13_PROCEDURE",
    "P11_PROCEDURE",
    "P22_PROCEDURE_RGPD",
    "QUALITE_PROCEDURE_EI_PLAINTES",
    "P13_MODE_OPERATOIRE_FAMO",
    "P12_AR_TYPE",
    "P12_REPONSE_FINALE",
    "P13_FICHE_DECLARATION",
  ],
  RISQUES: [
    "P14_PGC_REDIGE",
    "P14_PCA_REDIGE",
    "QUALITE_PCA_PLAN_BLEU",
    "P14_ANNUAIRE_CRISE",
    "P14_CR_DIFFUSION",
    "P14_PREUVE_SIMULATION",
    "P14_DATE_REVISION",
    "P11_CARTOGRAPHIE_RISQUES",
    "P11_PLAN_PREVENTION",
    "P13_SIGNALEMENT_ARS",
    "RH_DUERP",
    "P22_AIPD",
    "P22_TABLEAU_DROITS_ACCES_DUI",
    "P22_DUI_SECURISE",
  ],
  PERSONNE_ACCOMPAGNEE: [
    "FONCT_PAP_GABARIT",
    "FONCT_FICHE_TACHES_GABARIT",
    "FONCT_GRILLE_EVAL_BESOINS",
    "FONCT_CONSENTEMENT_ENTRETIEN",
    "P22_FORMULAIRES_CONSENTEMENT",
    "FONCT_DIRECTIVES_ANTICIPEES",
    "FONCT_PLAQUETTE",
    "FONCT_LISTE_PARTENAIRES",
  ],
  REGISTRES: ["P12_REGISTRE", "P13_TABLEAU_SUIVI", "P11_SIGNALEMENTS_TRACES", "P22_REGISTRE_TRAITEMENTS"],
  RESSOURCES_HUMAINES: [
    "FONCT_ORGANIGRAMME",
    "RH_LIVRET_SALARIE",
    "RH_PLAN_FORMATION",
    "RH_REGLEMENT_INTERIEUR",
    "FONCT_NOTE_SERVICE",
    "QUALITE_FICHE_SENSIBILISATION",
    "QUALITE_AFFICHE",
    "QUALITE_EMARGEMENT_SEANCE",
    "P22_EMARGEMENT_SENSIBILISATION",
    "P11_CR_SENSIBILISATION",
    "P22_FORMATION_RGPD",
    "P22_CHARTE_INFORMATIQUE",
  ],
  QUALITE: [
    "QUALITE_POLITIQUE_INDEX",
    "QUALITE_AUTOEVAL_ANTERIEURE",
    "QUALITE_PLAC",
    "QUALITE_GABARIT_CR_REUNION",
    "P12_CR_ANALYSE_EQUIPE",
    "P12_BILAN_ANNUEL",
    "P13_CR_RETEX",
    "FONCT_RAPPORTS_ACTIVITE",
    "FONCT_CPOM",
    "FONCT_CR_COMMISSIONS",
    "FONCT_PLANNING_ANIMATION",
  ],
};

const GROUP_BY_CODE: ReadonlyMap<string, DocumentGroupId> = new Map(
  DOCUMENT_GROUPS.flatMap(({ id }) => DOCUMENT_GROUP_CODES[id].map((code) => [code, id] as const))
);

// Groupe d'un type de document. `null` pour un code inconnu (type ajouté en base sans
// être rangé ici) : c'est à l'écran de le montrer à part, jamais de le deviner.
export function documentGroupOf(code: string): DocumentGroupId | null {
  return GROUP_BY_CODE.get(code) ?? null;
}

// Range des types de document dans l'ordre des sept groupes, en gardant l'ordre reçu à
// l'intérieur d'un groupe. Les codes non rangés vont dans `unranked`, jamais perdus.
export function groupDocumentTypes<T extends { code: string }>(
  types: readonly T[]
): { groups: { id: DocumentGroupId; label: string; types: T[] }[]; unranked: T[] } {
  const groups = DOCUMENT_GROUPS.map(({ id, label }) => ({ id, label, types: [] as T[] }));
  const unranked: T[] = [];
  for (const type of types) {
    const id = documentGroupOf(type.code);
    const group = id ? groups.find((g) => g.id === id) : undefined;
    if (group) group.types.push(type);
    else unranked.push(type);
  }
  return { groups, unranked };
}
