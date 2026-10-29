// ─────────────────────────────────────────────────────────────────────────────
// VERSIONS DU PROMPT D'ANALYSE — le laboratoire (demande de Damon, 29/10/2026 :
// « voir quel prompt est envoyé, tester différents prompts, que Sandrine puisse dire si
// c'est bon, comme ça on affine l'analyse »).
//
// Une version = la règle des critères supplémentaires + une MÉTHODE éventuelle, posées
// sur le socle commun de `buildSystemPrompt` (rôle, sécurité, citations mot pour mot,
// format de sortie). Toutes rendent le MÊME format : l'affichage, les suggestions de
// critères et « prouvé » ne dépendent pas de la version.
//
// Corriger le texte d'une version incrémente son `version` : un essai jugé par Sandrine
// garde la version exacte du prompt qui l'a produit.
// ─────────────────────────────────────────────────────────────────────────────

import {
  analysisPromptChoice,
  ANALYSIS_PROMPT_CHOICES,
  DEFAULT_ANALYSIS_PROMPT_VARIANT,
  describeAnalysisPrompt,
  isAnalysisPromptVariantId,
  type AnalysisPromptChoice,
  type AnalysisPromptVariantId,
} from "./analysis-prompt-choices";

export { DEFAULT_ANALYSIS_PROMPT_VARIANT, describeAnalysisPrompt, isAnalysisPromptVariantId, type AnalysisPromptVariantId };

// Le texte d'une version : la règle des critères supplémentaires et la méthode.
type VariantText = { catalogueRule: string; method: string | null };
export type AnalysisPromptVariant = AnalysisPromptChoice & VariantText;

// Règle du prompt du 28/10/2026, inchangée (version « actuel »).
const WIDE_CATALOGUE_RULE = `- Si un catalogue de critères SUPPLÉMENTAIRES t'est transmis entre les balises
  <catalogue_criteres>, identifie TOUS ceux que ce document évoque réellement — un
  document peut en concerner plusieurs, parfois jusqu'à dix, ne t'arrête jamais au
  premier trouvé. Chaque entrée de "criteresSupplementaires" est un objet
  {"criterionCode", "justification"} : "criterionCode" est copié EXACTEMENT depuis
  le catalogue (jamais un code inventé, jamais un code hors catalogue), et
  "justification" est une phrase courte citant ce qui, dans le document, justifie
  ce rattachement. Un critère déjà couvert par "criteriaCoverage" n'y figure pas —
  les deux listes sont disjointes. Un document qui n'en évoque aucun rend un
  tableau vide, jamais un critère forcé pour "remplir".`;

// Call du 28/10/2026 : « pour un document qui ne vise qu'un critère, l'IA en propose
// beaucoup — comment je retire ces liens, pour qu'elle se concentre sur ce que
// j'exprime dans le document ? ».
const TARGETED_CATALOGUE_RULE = `- Si un catalogue de critères SUPPLÉMENTAIRES t'est transmis entre les balises
  <catalogue_criteres>, n'y propose un critère que si ce document en TRAITE
  explicitement et principalement — une simple mention au passage ne suffit pas. Au
  plus TROIS, les plus évidents. Chaque entrée de "criteresSupplementaires" est un
  objet {"criterionCode", "justification"} : "criterionCode" est copié EXACTEMENT
  depuis le catalogue (jamais un code inventé, jamais un code hors catalogue), et
  "justification" cite mot pour mot le passage du document qui le traite. Un critère
  déjà couvert par "criteriaCoverage" n'y figure pas — les deux listes sont
  disjointes. Dans le doute, ne le propose pas : pour un document centré sur un seul
  sujet, un tableau vide est la réponse attendue.`;

// Transposition à la lettre de context/11, Partie A (mode opératoire « Vérification
// documentaire » de Sandrine) : §1 familles d'informations sensibles, §3 écarts
// détectables, §4 liste d'alertes et validation humaine, §6 code couleur.
const CROSS_CHECK_METHOD = `MÉTHODE — CONTRÔLE CROISÉ DES INFORMATIONS SENSIBLES (mode opératoire « Vérification
documentaire » d'EODA, en plus des règles ci-dessus) :
- Repère dans le document chaque information sensible de ces familles : numéros
  d'urgence ; coordonnées institutionnelles (ARS, conseil départemental, autorité de
  tarification) ; références réglementaires ; noms de dispositifs ; dates de version ;
  intitulés de procédures ; mentions RGPD ; noms des référents internes ; mentions
  obligatoires de la loi 2002-2. Chaque information trouvée va dans
  "elementsPresents", sa citation mot pour mot dans "source", et un "text" qui commence
  par sa famille (par exemple « Numéro d'urgence : … »).
- Signale dans "elementsManquants", en commençant par « [Orange — à vérifier] », ce qui
  se repère dans le texte seul : un même numéro, intitulé de procédure ou référence écrit
  de deux façons différentes ; une date de version absente ou incohérente ; une
  ancienne référence conservée (texte abrogé, ancien nom de dispositif) ; une
  information sensible attendue pour ce type de document mais introuvable.
- Tu ne connais pas la source de référence validée par EODA : ne déclare JAMAIS qu'un
  numéro, une adresse ou une formulation est faux. Écris « à contrôler avec la source
  de référence » — un écart peut être justifié (affichage local, ancien support
  conservé, numéro propre à une procédure interne).
- N'emploie « [Rouge — incohérence] » que pour une contradiction INTERNE au document
  (deux valeurs différentes pour la même information), en citant les deux passages.
- Ta sortie est une liste d'alertes pour la consultante, jamais une décision : la
  validation reste humaine.`;

// Call du 28/10/2026 : un document vendu ne doit pas paraître « incomplet » parce qu'un
// critère est couvert par un autre document (exemple du 2.10.2).
const TARGETED_METHOD = `MÉTHODE — ANALYSE CIBLÉE :
- Concentre l'analyse sur les critères rattachés à ce type de document et sur ce que
  la consultante dit de ce document (<commentaire_document>, <consignes_consultante>) :
  c'est ce que CE document doit prouver.
- Un document n'a pas à tout prouver à lui seul. Si la consultante indique qu'un
  attendu est couvert par un AUTRE document, ne le liste pas dans "elementsManquants" ;
  dans "criteriaCoverage", garde le statut au regard de ce document et écris dans
  "note" « couvert par un autre document selon la consultante ».
- "elementsManquants" ne contient que ce qui manque pour que CE document joue son rôle,
  jamais l'ensemble des attendus HAS du thème.`;

const VARIANT_TEXTS: Record<AnalysisPromptVariantId, VariantText> = {
  actuel: { catalogueRule: WIDE_CATALOGUE_RULE, method: null },
  "mode-operatoire": { catalogueRule: WIDE_CATALOGUE_RULE, method: CROSS_CHECK_METHOD },
  cible: { catalogueRule: TARGETED_CATALOGUE_RULE, method: TARGETED_METHOD },
};

export const ANALYSIS_PROMPT_VARIANTS: readonly AnalysisPromptVariant[] = ANALYSIS_PROMPT_CHOICES.map((choice) => ({
  ...choice,
  ...VARIANT_TEXTS[choice.id],
}));

export function analysisPromptVariant(id: AnalysisPromptVariantId): AnalysisPromptVariant {
  return { ...analysisPromptChoice(id), ...VARIANT_TEXTS[analysisPromptChoice(id).id] };
}
