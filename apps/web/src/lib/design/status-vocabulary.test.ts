import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AppointmentStatus, DevisStatus, DocumentStatus, ProspectStatus } from "@eoda/database";
import { FUNNEL_STAGES, FUNNEL_STAGE_LABELS } from "@/lib/services/lifecycle-service";
import { AA_NORMAL_TEXT, contrastRatio, parseRgbChannels } from "./contrast";
import { mergeTokens, readCustomProperties, resolveToken, type TokenMap } from "./css-tokens";
import {
  DEVIS_STATUS_LABELS,
  DOCUMENT_PILLS,
  PILL_TONES,
  PILL_TONE_CLASSES,
  PROSPECT_STATUS_LABELS,
  QUIZ_PILLS,
  pillForAppointmentStatus,
  pillForDevisStatus,
  pillForDocumentStatus,
  pillForFunnelStage,
  pillForProspectStatus,
  type PillSpec,
} from "./status-vocabulary";

const DEVIS: DevisStatus[] = ["BROUILLON", "ENVOYE", "SIGNE", "REFUSE", "ANNULE"];
const PROSPECT: ProspectStatus[] = ["NOUVEAU", "RDV", "DEVIS_ENVOYE", "NEGOCIATION", "SIGNE", "PERDU"];
const APPOINTMENT: AppointmentStatus[] = ["PROPOSE", "CONFIRME", "ANNULE"];
const DOCUMENT: DocumentStatus[] = [
  "MISSING",
  "UPLOADED",
  "ANALYZING",
  "INCOMPLETE",
  "COMPLIANT",
  "EXPIRED",
  "NOT_APPLICABLE",
];

const ALL_PILLS: PillSpec[] = [
  ...Object.values(DOCUMENT_PILLS),
  ...Object.values(QUIZ_PILLS),
  ...DEVIS.map(pillForDevisStatus),
  ...PROSPECT.map(pillForProspectStatus),
  ...FUNNEL_STAGES.map(pillForFunnelStage),
  ...APPOINTMENT.map(pillForAppointmentStatus),
  ...DOCUMENT.map(pillForDocumentStatus),
];

describe("vocabulaire des pastilles", () => {
  it("chaque pastille a un mot ET un glyphe (jamais la couleur seule)", () => {
    for (const p of ALL_PILLS) {
      expect(p.label.trim()).not.toBe("");
      expect(p.glyph.trim()).not.toBe("");
      expect(PILL_TONES).toContain(p.tone);
    }
  });

  it("les libellés sont uniques dans chaque famille", () => {
    const families = [
      Object.values(DOCUMENT_PILLS),
      Object.values(QUIZ_PILLS),
      DEVIS.map(pillForDevisStatus),
      FUNNEL_STAGES.map(pillForFunnelStage),
      APPOINTMENT.map(pillForAppointmentStatus),
      DOCUMENT.map(pillForDocumentStatus),
    ];
    for (const family of families) {
      const labels = family.map((p) => p.label);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });

  it("« Validé » (relu par EODA) et « Accepté par vous » sont deux faits distincts (D6)", () => {
    expect(DOCUMENT_PILLS.valide.label).not.toBe(DOCUMENT_PILLS.accepteParVous.label);
  });

  it("aucune pastille ne nomme une personne côté client (D7) ni n'écrit DIPEC", () => {
    for (const p of ALL_PILLS) {
      expect(p.label).not.toMatch(/Sandrine|DIPEC|DPEC/);
    }
    expect(DOCUMENT_PILLS.aRedigerEoda.label).toContain("EODA");
  });

  it("devis : refusé et annulé ne se confondent pas", () => {
    expect(pillForDevisStatus("REFUSE").tone).toBe("danger");
    expect(pillForDevisStatus("ANNULE").tone).toBe("neutral");
    expect(DEVIS.map((s) => pillForDevisStatus(s).label)).toEqual(DEVIS.map((s) => DEVIS_STATUS_LABELS[s]));
  });

  it("prospect : mêmes libellés que l'entonnoir (une seule source)", () => {
    for (const s of PROSPECT) {
      expect(PROSPECT_STATUS_LABELS[s]).toBe(FUNNEL_STAGE_LABELS[s]);
      expect(pillForProspectStatus(s)).toEqual(pillForFunnelStage(s));
    }
  });

  it("statut documentaire stocké : libellés du portail inchangés", () => {
    expect(pillForDocumentStatus("MISSING").label).toBe("Manquant");
    expect(pillForDocumentStatus("COMPLIANT").label).toBe("Conforme");
    expect(pillForDocumentStatus("EXPIRED").tone).toBe("renew");
  });

  it("rendez-vous : un créneau confirmé et un créneau proposé ont des glyphes différents", () => {
    expect(pillForAppointmentStatus("CONFIRME").glyph).not.toBe(pillForAppointmentStatus("PROPOSE").glyph);
  });
});

// ── Chaque ton tient 4.5:1 dans les deux thèmes, couleurs lues dans globals.css ──
const GLOBALS = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");
const LIGHT = readCustomProperties(GLOBALS, ":root");
const THEMES: [string, TokenMap][] = [
  ["clair", LIGHT],
  ["sombre", mergeTokens(LIGHT, readCustomProperties(GLOBALS, ':root[data-theme="dark"]'))],
];

function tokenOf(classes: string, prefix: "text-" | "bg-"): string {
  const token = classes.split(" ").find((c) => c.startsWith(prefix))?.slice(prefix.length);
  if (!token) throw new Error(`Aucune classe ${prefix} dans « ${classes} »`);
  return token;
}

describe("PILL_TONE_CLASSES — contraste du texte sur l'aplat", () => {
  for (const [themeName, tokens] of THEMES) {
    it.each(PILL_TONES.map((t) => [t]))(`${themeName} : ton %s ≥ 4.5:1`, (tone) => {
      const classes = PILL_TONE_CLASSES[tone];
      const fg = parseRgbChannels(resolveToken(tokens, tokenOf(classes, "text-")));
      const bg = parseRgbChannels(resolveToken(tokens, tokenOf(classes, "bg-")));
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });
  }

  it("signale une classe absente", () => {
    expect(() => tokenOf("border-line", "bg-")).toThrow();
  });
});
