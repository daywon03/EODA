import { describe, expect, it } from "vitest";
import { buildFunnel, buildTodo, describeSubscriptionSplit, groupSubscriptions } from "./commercial-overview-service";

const NOW = new Date(2026, 9, 13, 10, 0);
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

describe("entonnoir en cinq cartes, dérivé des faits", () => {
  it("compte inscrites seules, diagnostics terminés, appels, devis en cours, signés dans l'année", () => {
    const steps = buildFunnel({
      now: NOW,
      prospects: [
        { selfService: true, diagnosticDone: true, hasPendingCall: true },
        { selfService: true, diagnosticDone: true, hasPendingCall: false },
        { selfService: true, diagnosticDone: false, hasPendingCall: false },
        // Démarché : n'entre pas dans les trois premières cartes.
        { selfService: false, diagnosticDone: false, hasPendingCall: true },
      ],
      devis: [
        { status: "BROUILLON", signedAt: null },
        { status: "ENVOYE", signedAt: null },
        { status: "SIGNE", signedAt: new Date(2026, 2, 1) },
        { status: "SIGNE", signedAt: new Date(2025, 11, 20) },
        { status: "ANNULE", signedAt: null },
        { status: "REFUSE", signedAt: null },
      ],
    });
    expect(steps.map((s) => [s.label, s.value])).toEqual([
      ["Inscrites seules", 3],
      ["Diagnostic terminé", 2],
      ["Appel réservé", 1],
      ["Devis en cours", 2],
      ["Signés dans l'année", 1],
    ]);
    expect(steps[3]!.target).toEqual({ kind: "devis", tab: "en-cours" });
    expect(steps[2]!.target).toEqual({ kind: "prospects", tab: "appel", origin: "LIBRE_SERVICE" });
  });
});

describe("« À faire » dérivé", () => {
  const base = { now: NOW, calls: [], openDevis: [], inactive: [] };

  it("préparer un appel réservé", () => {
    const [item] = buildTodo({ ...base, calls: [{ prospectId: "p1", structureName: "SAD Les Coquelicots (fictif)", signalText: "Appel demandé · jeu. 16 oct." }] });
    expect(item).toMatchObject({ title: "Préparer l'appel", tone: "accent", action: { kind: "link", href: "/dashboard/cabinet/commercial/prospects/p1" } });
  });

  it("relancer un devis envoyé depuis plus de 7 jours ; pas avant", () => {
    const devis = (id: string, days: number, contactEmail: string | null = "contact@example.org") => ({
      id,
      number: `DEVIS-2026-0${id}`,
      status: "ENVOYE" as const,
      structureName: "SAD Les Peupliers (fictif)",
      contactEmail,
      lastSentAt: daysAgo(days),
    });
    const items = buildTodo({ ...base, openDevis: [devis("1", 10), devis("2", 3), devis("3", 12, null)] });
    expect(items.map((i) => i.key)).toEqual(["devis-1", "devis-3"]);
    expect(items[0]!.action).toMatchObject({ kind: "remind-devis", devisId: "1" });
    // Sans adresse, on ouvre le devis plutôt que de proposer une relance impossible.
    expect(items[1]!.action).toMatchObject({ kind: "link", href: "/dashboard/cabinet/commercial/devis/3" });
  });

  it("finir un brouillon", () => {
    const items = buildTodo({
      ...base,
      openDevis: [{ id: "9", number: "DEVIS-2026-009", status: "BROUILLON", structureName: "SAD (fictif)", contactEmail: null, lastSentAt: daysAgo(30) }],
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: "Finir le brouillon DEVIS-2026-009", action: { kind: "link", href: "/dashboard/cabinet/commercial/devis/9/modifier" } });
  });

  it("relancer une structure inscrite inactive", () => {
    const [item] = buildTodo({ ...base, inactive: [{ prospectId: "p2", structureName: "SAD La Roseraie (fictif)", signalText: "Aucune activité depuis 12 jours" }] });
    expect(item).toMatchObject({ tone: "red", meta: "SAD La Roseraie (fictif) · aucune activité depuis 12 jours", action: { kind: "remind-prospect", prospectId: "p2" } });
  });

  it("ordre : appels, relances de devis, brouillons, structures inactives", () => {
    const items = buildTodo({
      now: NOW,
      calls: [{ prospectId: "c", structureName: "C (fictif)", signalText: "x" }],
      openDevis: [
        { id: "b", number: "B", status: "BROUILLON", structureName: "B (fictif)", contactEmail: null, lastSentAt: daysAgo(1) },
        { id: "e", number: "E", status: "ENVOYE", structureName: "E (fictif)", contactEmail: "e@example.org", lastSentAt: daysAgo(9) },
      ],
      inactive: [{ prospectId: "i", structureName: "I (fictif)", signalText: "x" }],
    });
    expect(items.map((i) => i.key)).toEqual(["call-c", "devis-e", "draft-b", "inactive-i"]);
  });
});

describe("abonnements actifs par offre", () => {
  it("par formule de la mission, accompagnées / seules, offres à 0 conservées, bêta seulement s'il existe", () => {
    const { rows, total } = groupSubscriptions([
      { formule: "EXCELLENCE", supportMode: "ACCOMPAGNE" },
      { formule: "EXCELLENCE", supportMode: "ACCOMPAGNE" },
      { formule: "ESSENTIEL", supportMode: "AUTONOMIE" },
      { formule: null, supportMode: "ACCOMPAGNE" },
    ]);
    expect(rows.map((r) => [r.formule, r.total, r.accompanied, r.alone, r.percent])).toEqual([
      ["ESSENTIEL", 1, 0, 1, 50],
      ["PERFORMANCE", 0, 0, 0, 0],
      ["EXCELLENCE", 2, 2, 0, 100],
    ]);
    expect(total).toBe(3);
    expect(describeSubscriptionSplit(rows[2]!)).toBe("2 accompagnées · 0 seule");
    expect(groupSubscriptions([{ formule: "BETA", supportMode: "ACCOMPAGNE" }]).rows.map((r) => r.formule)).toContain("BETA");
  });
});
