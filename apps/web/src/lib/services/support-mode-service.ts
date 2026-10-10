import type { CommercialTier, SupportMode } from "@eoda/database";
import { getEffectiveTier } from "./offer-scope-service";

// ─────────────────────────────────────────────────────────────────────────────
// MODE D'ACCOMPAGNEMENT — seul (AUTONOMIE) ou accompagné (ACCOMPAGNE). Tranche N1.
//
// Le mode est un FAIT de la mission (`Mission.supportMode`), posé à la signature puis
// modifiable par CABINET_ADMIN. Ce service ne fait que deux choses : proposer le mode
// par défaut d'une nouvelle mission, et nommer le mode à l'écran. Il ne le DEVINE
// jamais depuis `Establishment.commercialTier` (CLAUDE.md §7 : cette colonne a déjà
// annoncé « bêta-test gratuit » à des clients payants).
//
// Règles PURES : ni Prisma (types seulement), ni React.
// ─────────────────────────────────────────────────────────────────────────────

export const SUPPORT_MODES = ["AUTONOMIE", "ACCOMPAGNE"] as const satisfies readonly SupportMode[];

// Sans mission (avant-vente) ou mode inconnu : la règle STRICTE. Un défaut permissif
// publierait au client une analyse que personne n'a relue.
export const STRICT_SUPPORT_MODE: SupportMode = "ACCOMPAGNE";

// Décision 2 des maquettes v2 (09/10/2026) : Excellence est accompagnée ; Essentiel et
// Performance se vendent seuls, l'accompagnement s'y ajoute en option (le cabinet
// change alors le mode depuis l'onglet Mission). Le bêta-test gratuit suit
// Excellence — getEffectiveTier est le SEUL endroit où cette équivalence s'écrit.
export function defaultSupportModeForOffer(formule: CommercialTier, gratuit: boolean): SupportMode {
  return getEffectiveTier(formule, gratuit) === "EXCELLENCE" ? "ACCOMPAGNE" : "AUTONOMIE";
}

export function resolveSupportMode(mission: { supportMode: SupportMode } | null): SupportMode {
  return mission?.supportMode ?? STRICT_SUPPORT_MODE;
}

// Entrée non fiable (formulaire) : une valeur hors liste vaut refus, jamais un défaut.
export function parseSupportMode(raw: unknown): SupportMode | null {
  return typeof raw === "string" && (SUPPORT_MODES as readonly string[]).includes(raw)
    ? (raw as SupportMode)
    : null;
}

export const SUPPORT_MODE_LABELS: Record<SupportMode, string> = {
  AUTONOMIE: "En autonomie",
  ACCOMPAGNE: "Accompagné par EODA",
};

const OFFER_NAMES: Record<CommercialTier, string> = {
  BETA: "Bêta-test",
  ESSENTIEL: "Essentiel",
  PERFORMANCE: "Performance",
  EXCELLENCE: "Excellence",
};

// Étiquette de la maquette : « Excellence · accompagné par EODA », « Offre
// Essentiel · en autonomie ». Jamais un prénom de l'équipe (D7).
export function describeModeTag(formule: CommercialTier, mode: SupportMode): string {
  return mode === "ACCOMPAGNE"
    ? `${OFFER_NAMES[formule]} · accompagné par EODA`
    : `Offre ${OFFER_NAMES[formule]} · en autonomie`;
}

// « Être accompagné » (accueil en autonomie) réutilise la demande d'option
// existante (ClientOptionRequest) : le client demande, EODA déclenche. La ligne de
// catalogue est appariée par CODE, jamais par libellé (comme VEILLE_PORTAIL_EODA).
// Elle n'existe PAS encore au catalogue (10/10/2026) : tant que Sandrine ne l'a pas
// créée, le bouton mène à « Mon contrat », sans inventer de prix.
export const SUPPORT_OPTION_CODE = "ACCOMPAGNEMENT_EODA";

// Le composant ModeTag (S2) parle en minuscules ; la base en majuscules.
export function toUiSupportMode(mode: SupportMode): "accompagne" | "autonomie" {
  return mode === "ACCOMPAGNE" ? "accompagne" : "autonomie";
}
