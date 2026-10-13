import type { CommercialTier, DevisStatus, PricingUnit } from "@eoda/database";
import { formatEuros } from "./price-format-service";

// ─────────────────────────────────────────────────────────────────────────────
// DEVIS PAR ABONNEMENT — règles d'affichage pures (maquette v2 « Nouveau devis »,
// « Devis », 13/10/2026).
//
// Ce fichier NE CALCULE AUCUN MONTANT ENGAGÉ : les totaux, l'acompte et le solde
// restent ceux de devis-calculation-service (inchangé), et la dégressivité de
// l'abonnement portail celle de subscription-service. Il range ce que le devis
// contient en deux colonnes — « Par mois » et « Ponctuel » — et dit l'engagement.
//
// Prix non fixé = « xx € » (décision 11 du plan v2) : jamais un montant inventé.
// ─────────────────────────────────────────────────────────────────────────────

// Engagement : 12 mois, 24 mois, ou sans engagement (0). Liste fermée : une valeur
// reçue d'un formulaire hors de cette liste est refusée, jamais arrondie.
export const COMMITMENT_CHOICES = [12, 24, 0] as const;
export type CommitmentMonths = (typeof COMMITMENT_CHOICES)[number];
export const DEFAULT_COMMITMENT_MONTHS: CommitmentMonths = 12;

export const COMMITMENT_LABELS: Record<CommitmentMonths, string> = {
  12: "12 mois",
  24: "24 mois",
  0: "Sans engagement",
};

export function parseCommitmentMonths(raw: unknown): CommitmentMonths | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const value = Number(raw);
  return (COMMITMENT_CHOICES as readonly number[]).includes(value) ? (value as CommitmentMonths) : null;
}

// Phrase sous le récapitulatif. `null` (devis antérieur au 13/10) : rien n'est dit.
export function describeCommitment(months: number | null): string | null {
  if (months === null) return null;
  if (months === 0) return "Sans engagement, résiliable chaque mois.";
  return `Engagement de ${months} mois, renouvelable. Les prestations ponctuelles ne sont pas concernées.`;
}

// Mode d'une offre (décision 2 du plan v2) : Essentiel et Performance se vendent
// seuls, Excellence avec EODA. Le bêta-test suit Excellence.
export function offerModeLabel(formule: CommercialTier): "Seul" | "Avec EODA" {
  return formule === "EXCELLENCE" || formule === "BETA" ? "Avec EODA" : "Seul";
}

const PLACEHOLDER = "xx €";

export type RecapOffer = { label: string; forfaitEuros: number; monthlyEuros: number | null };
// `unitPriceEuros` : déjà remisé par subscription-service pour l'abonnement portail.
export type RecapOption = {
  label: string;
  unitPriceEuros: number;
  pricingUnit: PricingUnit;
  minQuantity: number | null;
};

export type RecapLine = { key: string; label: string; price: string };
export type DevisRecap = { lines: RecapLine[]; monthly: string; once: string };

// Unité courte, après un montant (« 900 € / jour »). Partagée avec le catalogue.
export const PRICING_UNIT_SHORT_LABELS: Record<PricingUnit, string> = {
  FORFAIT: "forfait",
  HEURE: "/ h",
  JOUR: "/ jour",
  DOCUMENT: "/ document",
  SUPPORT: "/ support",
  MOIS: "/ mois",
};

// Somme d'une colonne : « — » si vide, « xx € » si un seul prix manque.
function sumColumn(values: readonly (number | null)[]): string {
  if (values.length === 0) return "—";
  if (values.some((v) => v === null)) return PLACEHOLDER;
  return formatEuros(values.reduce<number>((total, v) => total + (v ?? 0), 0));
}

function onceAmount(option: RecapOption): number {
  const quantity = option.minQuantity && option.minQuantity > 1 ? option.minQuantity : 1;
  return option.unitPriceEuros * quantity;
}

export function buildDevisRecap(input: { offer: RecapOffer | null; options: readonly RecapOption[] }): DevisRecap {
  const { offer, options } = input;
  const lines: RecapLine[] = [];
  const monthly: (number | null)[] = [];
  const once: (number | null)[] = [];

  if (offer) {
    lines.push({
      key: "offer-monthly",
      label: `Offre ${offer.label}`,
      price: `${offer.monthlyEuros === null ? PLACEHOLDER : formatEuros(offer.monthlyEuros)} / mois`,
    });
    monthly.push(offer.monthlyEuros);
    if (offer.forfaitEuros > 0) {
      lines.push({ key: "offer-forfait", label: `Offre ${offer.label} · forfait`, price: formatEuros(offer.forfaitEuros) });
      once.push(offer.forfaitEuros);
    }
  }

  options.forEach((option, index) => {
    lines.push({
      key: `option-${index}`,
      label: option.label,
      price: `${formatEuros(option.unitPriceEuros)} ${PRICING_UNIT_SHORT_LABELS[option.pricingUnit]}`,
    });
    if (option.pricingUnit === "MOIS") monthly.push(option.unitPriceEuros);
    else once.push(onceAmount(option));
  });

  return { lines, monthly: sumColumn(monthly), once: sumColumn(once) };
}

// Résumé d'une ligne de la liste : « Excellence · Visite sur site · 12 mois ».
export function summarizeDevis(input: {
  formuleLabel: string | null;
  optionLabels: readonly string[];
  commitmentMonths: number | null;
}): string {
  const parts = [input.formuleLabel ?? "Sans offre", ...input.optionLabels];
  if (input.commitmentMonths !== null) {
    parts.push(input.commitmentMonths === 0 ? "sans engagement" : `${input.commitmentMonths} mois`);
  }
  return parts.join(" · ");
}

// ── Relance ───────────────────────────────────────────────────────────────────
// Un devis envoyé « mérite » une relance quand son dernier envoi (ou sa dernière
// relance) date de plus de N jours. Le dernier envoi se DÉRIVE du journal d'audit
// (DEVIS_EMAIL_SENT, DEVIS_REMINDER_SENT) : aucun horodatage de plus n'est stocké.
export const DEVIS_REMINDER_AFTER_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export function lastSentAt(input: { createdAt: Date; sentEvents: readonly Date[] }): Date {
  return input.sentEvents.reduce((latest, d) => (d > latest ? d : latest), input.createdAt);
}

export function isDevisDueForReminder(input: { status: DevisStatus; lastSentAt: Date; now: Date }): boolean {
  if (input.status !== "ENVOYE") return false;
  return input.now.getTime() - input.lastSentAt.getTime() > DEVIS_REMINDER_AFTER_DAYS * DAY_MS;
}

export function canRemindDevis(status: DevisStatus, contactEmail: string | null): boolean {
  return status === "ENVOYE" && Boolean(contactEmail);
}
