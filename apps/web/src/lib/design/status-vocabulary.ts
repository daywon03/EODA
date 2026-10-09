import type { AppointmentStatus, DevisStatus, DocumentStatus, ProspectStatus } from "@eoda/database";
import { FUNNEL_STAGE_LABELS, type FunnelStage } from "@/lib/services/lifecycle-service";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/services/calendar-service";

// Vocabulaire UNIQUE des pastilles de statut (maquettes v2, 09/10/2026).
//
// Six composants de badge écrivaient chacun leurs libellés et leurs couleurs ; une
// même idée (« à refaire ») pouvait y être rouge ici, ambre là. Chaque pastille est
// désormais un MOT + un GLYPHE + un TON : le glyphe et le mot portent le sens, la
// couleur ne fait que le renforcer (WCAG 1.4.1 — jamais la couleur seule).

export const PILL_TONES = [
  "todo", // à faire, manquant, pas fait — contour seul
  "deposited", // reçu, en attente
  "review", // à relire, à vérifier — aplat ambre
  "fix", // à corriger — aplat terre
  "ok", // validé, réussi, signé — aplat vert
  "renew", // à renouveler, à refaire — fond doux, bord terre
  "progress", // en cours, en rédaction — fond doux, bord ambre
  "elsewhere", // chez la structure — contour encre
  "neutral", // non concerné, annulé, terminé
  "danger", // refusé, perdu
] as const;
export type PillTone = (typeof PILL_TONES)[number];

export type PillSpec = {
  label: string;
  glyph: string;
  tone: PillTone;
};

// Couleurs par ton, exprimées en tokens de rôle (globals.css) : leurs paires texte /
// fond sont vérifiées à 4.5:1 dans les deux thèmes par theme-contrast.test.ts.
export const PILL_TONE_CLASSES: Record<PillTone, string> = {
  todo: "border-muted bg-card text-ink2",
  deposited: "border-line bg-line text-ink",
  review: "border-ambre bg-amber-fill text-ink",
  fix: "border-accent-fill bg-accent-fill text-on-accent",
  ok: "border-vert-ok bg-green-fill text-ink",
  renew: "border-terre bg-soft text-ink",
  progress: "border-ambre bg-soft text-ink",
  elsewhere: "border-ink bg-card text-ink",
  neutral: "border-line bg-line text-ink2",
  danger: "border-danger-text bg-card text-danger-text",
};

const pill = (label: string, glyph: string, tone: PillTone): PillSpec => ({ label, glyph, tone });

// ── Documents (parcours v2) ───────────────────────────────────────────────────
// « Validé » = relu par EODA (`validatedAt`) ; « Accepté par vous » = geste distinct
// du client (D6). Les deux ne se confondent jamais, d'où deux entrées.
export const DOCUMENT_PILLS = {
  manquant: pill("Manquant", "○", "todo"),
  depose: pill("Déposé", "↑", "deposited"),
  aRelire: pill("À relire", "◔", "review"),
  aCorriger: pill("À corriger", "!", "fix"),
  valide: pill("Validé", "✓", "ok"),
  accepteParVous: pill("Accepté par vous", "✓", "ok"),
  aRenouveler: pill("À renouveler", "↻", "renew"),
  nonConcerne: pill("Non concerné", "–", "neutral"),
  aRedigerEoda: pill("À rédiger · EODA", "✎", "progress"),
  chezLaStructure: pill("Chez la structure", "↗", "elsewhere"),
} as const satisfies Record<string, PillSpec>;

// ── Quiz de sensibilisation (lot B) ───────────────────────────────────────────
export const QUIZ_PILLS = {
  reussi: pill("Réussi", "✓", "ok"),
  aRefaire: pill("À refaire", "↻", "renew"),
  pasFait: pill("Pas fait", "○", "todo"),
} as const satisfies Record<string, PillSpec>;

// ── Devis ─────────────────────────────────────────────────────────────────────
export const DEVIS_STATUS_LABELS: Record<DevisStatus, string> = {
  BROUILLON: "Brouillon",
  ENVOYE: "Envoyé",
  SIGNE: "Signé",
  REFUSE: "Refusé",
  ANNULE: "Annulé",
};

// Annulé ≠ refusé : un refus vient du prospect, une annulation du cabinet.
const DEVIS_GLYPH_TONE: Record<DevisStatus, [string, PillTone]> = {
  BROUILLON: ["✎", "todo"],
  ENVOYE: ["↗", "progress"],
  SIGNE: ["✓", "ok"],
  REFUSE: ["✕", "danger"],
  ANNULE: ["–", "neutral"],
};

export function pillForDevisStatus(status: DevisStatus): PillSpec {
  const [glyph, tone] = DEVIS_GLYPH_TONE[status];
  return pill(DEVIS_STATUS_LABELS[status], glyph, tone);
}

// ── Entonnoir commercial : prospect puis fiche ────────────────────────────────
// Libellés lus dans lifecycle-service, jamais recopiés (D1) : la pastille d'une fiche
// et la barre de l'entonnoir désignent une étape sous le même nom.
const FUNNEL_GLYPH_TONE: Record<FunnelStage, [string, PillTone]> = {
  NOUVEAU: ["○", "todo"],
  RDV: ["◔", "progress"],
  DEVIS_ENVOYE: ["↗", "progress"],
  NEGOCIATION: ["◑", "review"],
  SIGNE: ["✓", "ok"],
  EN_COURS: ["◔", "progress"],
  TERMINE: ["✓", "neutral"],
  PERDU: ["✕", "danger"],
};

export function pillForFunnelStage(stage: FunnelStage): PillSpec {
  const [glyph, tone] = FUNNEL_GLYPH_TONE[stage];
  return pill(FUNNEL_STAGE_LABELS[stage], glyph, tone);
}

// Le `Record<ProspectStatus, …>` explicite cesse de compiler si une valeur d'enum
// est ajoutée sans libellé : aucune étape n'apparaît sous son nom technique.
export const PROSPECT_STATUS_LABELS: Record<ProspectStatus, string> = {
  NOUVEAU: FUNNEL_STAGE_LABELS.NOUVEAU,
  RDV: FUNNEL_STAGE_LABELS.RDV,
  DEVIS_ENVOYE: FUNNEL_STAGE_LABELS.DEVIS_ENVOYE,
  NEGOCIATION: FUNNEL_STAGE_LABELS.NEGOCIATION,
  SIGNE: FUNNEL_STAGE_LABELS.SIGNE,
  PERDU: FUNNEL_STAGE_LABELS.PERDU,
};

export function pillForProspectStatus(status: ProspectStatus): PillSpec {
  return pillForFunnelStage(status);
}

// ── Rendez-vous ───────────────────────────────────────────────────────────────
const APPOINTMENT_GLYPH_TONE: Record<AppointmentStatus, [string, PillTone]> = {
  PROPOSE: ["◔", "progress"],
  CONFIRME: ["✓", "ok"],
  ANNULE: ["✕", "danger"],
};

export function pillForAppointmentStatus(status: AppointmentStatus): PillSpec {
  const [glyph, tone] = APPOINTMENT_GLYPH_TONE[status];
  return pill(APPOINTMENT_STATUS_LABELS[status], glyph, tone);
}

// ── Statut documentaire stocké (portail actuel) ───────────────────────────────
// Libellés inchangés : le portail client garde ses statuts simples (CLAUDE.md §7,
// call du 26/08). Seuls le glyphe et le ton s'alignent sur le vocabulaire v2.
const DOCUMENT_STATUS_PILLS: Record<DocumentStatus, PillSpec> = {
  MISSING: pill("Manquant", "○", "todo"),
  UPLOADED: pill("Déposé", "↑", "deposited"),
  ANALYZING: pill("En analyse…", "◔", "progress"),
  INCOMPLETE: pill("Incomplet", "!", "fix"),
  COMPLIANT: pill("Conforme", "✓", "ok"),
  EXPIRED: pill("Périmé", "↻", "renew"),
  NOT_APPLICABLE: pill("Non applicable", "–", "neutral"),
};

export function pillForDocumentStatus(status: DocumentStatus): PillSpec {
  return DOCUMENT_STATUS_PILLS[status];
}
