import { DocumentCategory } from "@prisma/client";
import type { CommercialTier, RequirementLevel } from "@eoda/database";

// Couche UNIQUE de périmétrage par offre commerciale — source de vérité pour ce
// qui est coté, ce qui est corrigé, quelles catégories documentaires sont suivies
// et quels items de checklist de mission sont couverts. Tout le reste de
// l'application interroge ce service : aucune de ces règles n'est réécrite ailleurs
// (CLAUDE.md §5 Open/Closed, D1 anti-duplication).
//
// Références : context/07-outil-pilotage-missions.md §7.3, §12.1 et §12.4 ;
// context/08-offre-commerciale-v10.md §04.
//
// - Essentiel   : critères impératifs uniquement + analyse documentaire loi 2002-2,
//                 SANS correction.
// - Performance : vérification des 157/137 critères, correction des documents des
//                 critères impératifs et des processus / procédures (D11, bilan du
//                 08/10/2026), toutes les catégories documentaires suivies.
// - Excellence  : vérification ET correction de tout.

export type CriteriaScope = "IMPERATIFS_ONLY" | "ALL";
// `IMPERATIVES_AND_PROCESSES` remplace `LOI_2002_2_ONLY` (jamais lu avant le
// 10/10/2026, donc sans conséquence) : la décision D11 ne se réduit pas à la loi
// 2002-2.
export type CorrectionScope = "NONE" | "IMPERATIVES_AND_PROCESSES" | "ALL";

// Transposition de D11 en catégories documentaires — PROVISOIRE, à confirmer par
// Sandrine. « Documents des impératifs » = les sept documents de la loi 2002-2 et les
// preuves des objectifs impératifs (P11 maltraitance, P12 plaintes, P13 EI, P14 PCA,
// P22 consentement), « processus / procédures » = la politique qualité et ses
// procédures : tous rangés en LOI_2002_2 et QUALITE_RISQUES. Exclus : FONCTIONNEMENT
// (organigramme, rapports d'activité…) et RH. La liaison fine type ↔ critère
// impératif (`DocumentTypeCriterion`) est vide au 08/10 (specs/04) : quand elle sera
// chargée (tranche N4), c'est elle qui devra trancher, pas la catégorie.
const PERFORMANCE_CORRECTION_CATEGORIES: readonly DocumentCategory[] = ["LOI_2002_2", "QUALITE_RISQUES"];

// Les trois offres réellement vendues. BETA n'en est pas une : c'est un statut de
// bêta-test gratuit qui emprunte le périmètre Excellence (§7.5).
// SANS_OFFRE : mission née d'un devis de prestations à la carte seules (11/10/2026,
// formule nulle). Socle minimal — la loi 2002-2 et les impératifs —, aucun droit de
// génération, et toujours accompagnée (support-mode-service).
export type OfferTier = Exclude<CommercialTier, "BETA"> | "SANS_OFFRE";

export type OfferScope = {
  criteriaScope: CriteriaScope;
  correctionScope: CorrectionScope;
  // Catégories de la checklist documentaire suivies par l'offre — §12.1 :
  // « Essentiel : 16 critères impératifs + 7 documents loi 2002-2 ».
  documentCategories: readonly DocumentCategory[];
};

// Dérivé de l'énumération Prisma, jamais retranscrit à la main : une cinquième
// catégorie documentaire ajoutée au schéma est automatiquement couverte par
// Performance et Excellence, au lieu d'en être exclue en silence (Règle zéro —
// une règle qu'aucune machine ne vérifie n'est pas une règle).
// L'objet d'énumération vient de `@prisma/client` et non de `@eoda/database` :
// ce dernier instancie un PrismaClient au chargement du module, ce qu'un service
// pur ne doit pas provoquer (les types, eux, restent importés de @eoda/database).
const ALL_DOCUMENT_CATEGORIES: readonly DocumentCategory[] = Object.values(DocumentCategory);

const OFFER_SCOPES: Record<OfferTier, OfferScope> = {
  SANS_OFFRE: {
    criteriaScope: "IMPERATIFS_ONLY",
    correctionScope: "NONE",
    documentCategories: ["LOI_2002_2"],
  },
  ESSENTIEL: {
    criteriaScope: "IMPERATIFS_ONLY",
    correctionScope: "NONE",
    documentCategories: ["LOI_2002_2"],
  },
  PERFORMANCE: {
    criteriaScope: "ALL",
    correctionScope: "IMPERATIVES_AND_PROCESSES",
    documentCategories: ALL_DOCUMENT_CATEGORIES,
  },
  EXCELLENCE: {
    criteriaScope: "ALL",
    correctionScope: "ALL",
    documentCategories: ALL_DOCUMENT_CATEGORIES,
  },
};

// Ordre de couverture des offres : une offre couvre tout ce qu'exige une offre de
// rang inférieur ou égal (« PERFORMANCE (tout Essentiel inclus +) », plaquette v10 §04).
const TIER_RANK: Record<OfferTier, number> = {
  SANS_OFFRE: -1,
  ESSENTIEL: 0,
  PERFORMANCE: 1,
  EXCELLENCE: 2,
};

// Offre effective d'une mission : BETA (bêta-test gratuit) et le drapeau `gratuit`
// donnent tous deux le périmètre Excellence complet — §7.5. C'est le SEUL endroit
// où cette équivalence est écrite.
export function getEffectiveTier(formule: CommercialTier | null, gratuit = false): OfferTier {
  if (gratuit || formule === "BETA") return "EXCELLENCE";
  if (formule === null) return "SANS_OFFRE";
  return formule;
}

export function getOfferScope(formule: CommercialTier | null, gratuit = false): OfferScope {
  return OFFER_SCOPES[getEffectiveTier(formule, gratuit)];
}

// Une mission couvre-t-elle un élément dont le référentiel exige au minimum
// `minFormule` ? Utilisé pour les items de checklist de mission (§12.4), dont la
// colonne `min_formule` est le référentiel — aucun code d'item n'est codé en dur ici.
export function coversMinFormule(
  formule: CommercialTier | null,
  gratuit: boolean,
  minFormule: CommercialTier
): boolean {
  const required = getEffectiveTier(minFormule);
  return TIER_RANK[getEffectiveTier(formule, gratuit)] >= TIER_RANK[required];
}

// Un critère de ce niveau d'exigence est-il coté par l'offre ? Même règle que le
// filtre de lecture de getEvaluationChapter() : en Essentiel, seuls les critères
// impératifs sont dans le périmètre. Écrite ici pour que la LECTURE et l'ÉCRITURE
// partagent la décision — une règle de périmètre recopiée dans une action est une
// règle que l'autre action oubliera (D1).
export function isCriterionLevelCovered(
  formule: CommercialTier | null,
  gratuit: boolean,
  requirementLevel: RequirementLevel
): boolean {
  if (getOfferScope(formule, gratuit).criteriaScope === "ALL") return true;
  return requirementLevel === "IMPERATIF";
}

export function getCoveredDocumentCategories(
  formule: CommercialTier | null,
  gratuit = false
): readonly DocumentCategory[] {
  return getOfferScope(formule, gratuit).documentCategories;
}

export function isDocumentCategoryCovered(
  formule: CommercialTier | null,
  gratuit: boolean,
  category: DocumentCategory
): boolean {
  return getCoveredDocumentCategories(formule, gratuit).includes(category);
}

// ── Droit de générer un document corrigé (D13, garde de generateDocumentDraft) ─
//
// Générer est PAYANT (décision du 08/10/2026), en deux niveaux — génération seule,
// génération vérifiée par EODA. Les montants ne sont pas fixés : on ne modélise que le
// DROIT (inclus dans l'offre / non inclus). Hors droit, le message renvoie vers la
// demande d'option existante (ClientOptionRequest, portail « Mon contrat ») : le client
// demande, EODA déclenche.
export type CorrectionRight =
  | { included: true }
  | { included: false; reason: "NO_MISSION" | "OUT_OF_OFFER" };

export function correctionRight(
  mission: { formule: CommercialTier | null; gratuit: boolean } | null,
  category: DocumentCategory
): CorrectionRight {
  // Fail-closed : sans mission, rien n'a été acheté — pas de génération (à la
  // différence du dépôt, que l'avant-vente doit permettre).
  if (!mission) return { included: false, reason: "NO_MISSION" };
  const scope = getOfferScope(mission.formule, mission.gratuit).correctionScope;
  if (scope === "ALL") return { included: true };
  if (scope === "IMPERATIVES_AND_PROCESSES" && PERFORMANCE_CORRECTION_CATEGORIES.includes(category)) {
    return { included: true };
  }
  return { included: false, reason: "OUT_OF_OFFER" };
}

export const CORRECTION_NOT_INCLUDED_MESSAGE =
  "La génération de ce document n'est pas incluse dans l'offre de cette structure. Elle peut la demander en option depuis « Mon contrat ».";
