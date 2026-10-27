// ─────────────────────────────────────────────────────────────────────────────
// CAHIER DE STYLE DE LA MISE EN CONFORMITÉ — contenu versionné, injecté tel quel
// dans le prompt système de génération (lib/llm/generation-prompt.ts).
//
// DÉRIVÉ de deux sources, et d'elles seules :
//   - `.claude/context/11-modes-operatoires-sandrine.md` — les modes opératoires
//     écrits de Sandrine. ILS FONT FOI, à la lettre (CLAUDE.md §7) ;
//   - `.claude/context/10-regles-mise-en-conformite.md` — les règles dites en séance
//     (§4 forme, §5 style, §7 identité), en ce qu'elles ne contredisent pas le 11.
// Chaque règle porte sa source entre crochets : une règle sans source ne s'ajoute
// pas ici. Les points marqués « ⚖️ à vérifier » dans le 10 n'y entrent PAS (aucun
// numéro d'article ni de téléphone tiré de la mémoire du modèle).
//
// Changer une règle = changer `STYLE_GUIDE_VERSION`. Le test
// `generation-prompt.test.ts` vérifie que le prompt l'embarque bien.
// ─────────────────────────────────────────────────────────────────────────────

export const STYLE_GUIDE_VERSION = "regles-redaction v03 — 21/10/2026";

export type StyleGuideSection = { title: string; rules: readonly string[] };

export const STYLE_GUIDE: readonly StyleGuideSection[] = [
  {
    title: "Sources et prudence",
    rules: [
      "Le manuel HAS (juillet 2025) fait foi : les références légales et réglementaires d'un critère se lisent dans les extraits <referentiel> fournis, jamais dans ta mémoire. [10 §1]",
      "Toute information sensible (numéro d'urgence, coordonnées d'une autorité, référence réglementaire, nom d'un dispositif, intitulé d'une procédure, mention RGPD) se reprend d'une source fournie ; sinon, champ [À compléter : …]. [11 A§2, A§3]",
      "Tu ne décides rien : tu proposes, un humain valide chaque ajout. [11 A§4]",
      "Distingue « obligation légale » et « choix de la structure » ; un délai maximum n'est pas une politique imposée. [10 §2]",
    ],
  },
  {
    title: "Méthode",
    rules: [
      "Pars du document, pas du critère : vérifie le document en entier, et propose tous les critères qu'il couvre, jamais un seul. [10 §2]",
      "« Chapitre » veut dire chapitre HAS 1, 2 ou 3, jamais un chapitre du document. [10 §2]",
      "Ne propose jamais de couvrir un critère qui ne s'applique pas à un service d'aide à domicile. [10 §2]",
      "Garde TOUT l'original : sections, annexes, mentions. Un document de 42 pages ne revient pas en 14. [10 §4]",
      "Gradue selon la maturité : chez une structure avancée, l'écart peut se réduire à un paragraphe ou un mot-clé. [10 §5]",
    ],
  },
  {
    title: "Forme d'un document EODA",
    rules: [
      "Première page : version et date de mise à jour à compléter. [10 §4]",
      "Sous le titre, la liste de tous les critères HAS couverts ; sous chaque section, les critères correspondants. [10 §4]",
      "Un encadré « Ce document couvre aussi les critères X, Y » quand c'est le cas. [10 §4]",
      "Un sommaire en début de document ; les numéros de page sont ajoutés à l'export. [10 §4]",
      "Les références légales et réglementaires du critère (fiche du manuel) insérées dans le document quand elles sont fournies. [10 §4]",
      "Un bloc « Validation et diffusion » en fin de document. [10 §4]",
      "Toujours le TITRE d'un document cité, jamais un code de fichier. [10 §4, 11 B§6]",
      "Sigle DIPEC, jamais une autre graphie ; plan d'action : PLAC (plan d'amélioration continue), jamais PAC. [11 B§2, B§6]",
    ],
  },
  {
    title: "Style",
    rules: [
      "Court : des phrases simples, aller droit au but. [10 §5]",
      "Procédures pas à pas, applicables seul par un remplaçant, avec l'emplacement exact des documents. [10 §5]",
      "Vocabulaire HAS (bientraitance, participation, co-construction), en français correct. [10 §5]",
      "Aucun nom de personne : seuls le référent qualité et le délégué à la protection des données sont désignés, par leur fonction ou par un champ à compléter. [10 §5]",
      "« Sensibiliser », jamais « former ». Jamais « Sandrine » ni « la consultante va faire » : la structure fait, EODA formalise. [10 §5]",
      "Mentionne les droits et devoirs de la personne accompagnée, et la co-construction avec les salariés. [10 §5]",
    ],
  },
  {
    title: "Données à ne jamais inventer",
    rules: [
      "Raison sociale, statut juridique, SIRET, FINESS, déclaration, numéro d'assurance, dirigeant, DPO, référent qualité, autorité de tarification, partenaires, astreinte : si l'information n'est pas dans le document, écris [À compléter : <ce qu'il faut>]. [10 §7]",
      "Jamais une valeur plausible inventée à la place d'un champ à compléter. [10 §7]",
      "Ne modifie JAMAIS un numéro de version ni une date du document : recopie-les à l'identique. N'en écris aucun nouveau ; s'il en faut un, écris [À compléter : version ou date]. [10 §7, call du 18/10/2026]",
    ],
  },
];

// Rendu texte du cahier de style, tel qu'il entre dans le prompt système.
export function renderStyleGuide(): string {
  const sections = STYLE_GUIDE.map(
    (section) => `## ${section.title}\n${section.rules.map((rule) => `- ${rule}`).join("\n")}`
  ).join("\n\n");
  return `CAHIER DE STYLE EODA (${STYLE_GUIDE_VERSION}) — règles du cabinet, à appliquer :\n\n${sections}`;
}
