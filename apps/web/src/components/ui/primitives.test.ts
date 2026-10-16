import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DOCUMENT_PILLS } from "@/lib/design/status-vocabulary";
import { StatusPill } from "./status-pill";
import { ProgressBar } from "./progress-bar";
import { TabsWithCount } from "./tabs-with-count";
import { FilterChip } from "./filter-chip";
import { DataTable } from "./data-table";
import { Toast } from "./toast";
import { Callout } from "./callout";
import { EmptyState } from "./empty-state";
import { KpiCard } from "./kpi-card";
import { ScopeCard } from "./scope-card";
import { PhaseTimeline } from "./phase-timeline";
import { ModeTag } from "./mode-tag";
import { buttonVariants } from "./button";

// Accessibilité de base des primitives, vérifiée sur le rendu serveur : rôles,
// attributs ARIA, sémantique. Le comportement clavier (onglets, piège à focus) est
// testé sur sa logique pure (lib/design/keyboard-navigation.test.ts).

const noop = () => undefined;

describe("StatusPill", () => {
  it("rend le mot, et le glyphe masqué au lecteur d'écran", () => {
    const html = renderToStaticMarkup(h(StatusPill, { pill: DOCUMENT_PILLS.aRelire }));
    expect(html).toContain('<span aria-hidden="true">◔</span>À relire');
    expect(html).toContain("bg-amber-fill");
  });
});

describe("ProgressBar", () => {
  it("porte role, nom accessible et valeur bornée", () => {
    const html = renderToStaticMarkup(
      h(ProgressBar, { value: 12, max: 20, label: "Documents déposés", valueText: "12 sur 20" })
    );
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-label="Documents déposés"');
    expect(html).toContain('aria-valuenow="60"');
    expect(html).toContain('aria-valuetext="12 sur 20"');
    expect(html).toContain("width:60%");
  });
});

describe("TabsWithCount", () => {
  const tabs = [
    { id: "todo", label: "À faire", count: 3 },
    { id: "relire", label: "À relire", count: 4 },
    { id: "nc", label: "Non concerné" },
  ];

  it("vraie liste d'onglets : un seul onglet sélectionné et focalisable", () => {
    const html = renderToStaticMarkup(
      h(TabsWithCount, { label: "Filtrer les documents", tabs, selectedId: "relire", onSelect: noop }, "Panneau")
    );
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Filtrer les documents"');
    expect(html.match(/role="tab"/g)).toHaveLength(3);
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain(">4</span>");
  });

  it("sans panneau, n'annonce pas d'aria-controls orphelin", () => {
    const html = renderToStaticMarkup(h(TabsWithCount, { label: "x", tabs, selectedId: "todo", onSelect: noop }));
    expect(html).not.toContain("aria-controls");
    expect(html).not.toContain('role="tabpanel"');
  });
});

describe("FilterChip", () => {
  it("expose l'état par aria-pressed et une coche visible", () => {
    const on = renderToStaticMarkup(h(FilterChip, { pressed: true, count: 5 }, "Impératifs"));
    const off = renderToStaticMarkup(h(FilterChip, { pressed: false }, "Impératifs"));
    expect(on).toContain('aria-pressed="true"');
    expect(on).toContain("✓");
    expect(on).toContain("min-h-11");
    expect(off).toContain('aria-pressed="false"');
    expect(off).not.toContain("✓");
  });
});

describe("DataTable", () => {
  type Row = { id: string; name: string; status: string };
  const rows: Row[] = [{ id: "a", name: "Livret d'accueil", status: "Validé" }];
  const columns = [
    { id: "name", header: "Document", cell: (r: Row) => r.name, isRowHeader: true },
    { id: "status", header: "Statut", cell: (r: Row) => r.status },
  ];

  it("vrai tableau : légende, en-têtes de colonne et de ligne, région défilable", () => {
    const html = renderToStaticMarkup(
      h(DataTable<Row>, { caption: "Documents", columns, rows, getRowKey: (r) => r.id, rowHref: (r) => `/doc/${r.id}` })
    );
    expect(html).toContain("<table");
    expect(html).toContain('<caption class="sr-only">Documents</caption>');
    expect(html.match(/scope="col"/g)).toHaveLength(2);
    expect(html).toContain('scope="row"');
    expect(html).toContain('href="/doc/a"');
    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
  });

  it("annonce l'absence de ligne", () => {
    const html = renderToStaticMarkup(
      h(DataTable<Row>, { caption: "Documents", columns, rows: [], getRowKey: (r) => r.id, emptyMessage: "Rien" })
    );
    expect(html).toContain('colSpan="2"');
    expect(html).toContain("Rien");
  });
});

describe("Toast, Callout, EmptyState", () => {
  it("Toast est un statut poli", () => {
    const html = renderToStaticMarkup(h(Toast, { message: "Envoyé", tone: "success", onDismiss: noop }));
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-label="Fermer le message"');
  });

  it("Callout est une note par défaut, une alerte sur demande", () => {
    expect(renderToStaticMarkup(h(Callout, { title: "À savoir", children: "x" }))).toContain('role="note"');
    expect(renderToStaticMarkup(h(Callout, { tone: "danger", role: "alert", children: "x" }))).toContain('role="alert"');
  });

  it("EmptyState affiche titre, description et action", () => {
    const html = renderToStaticMarkup(
      h(EmptyState, { title: "Aucun document", description: "Déposez le premier.", action: h("a", { href: "/d" }, "Déposer") })
    );
    expect(html).toContain("Aucun document");
    expect(html).toContain("Déposez le premier.");
    expect(html).toContain('href="/d"');
  });
});

describe("KpiCard, ScopeCard, PhaseTimeline, ModeTag", () => {
  it("KpiCard rend valeur, libellé et définition", () => {
    const html = renderToStaticMarkup(h(KpiCard, { label: "Structures suivies", value: "12", hint: "Fiches actives" }));
    expect(html).toContain(">12</p>");
    expect(html).toContain("Structures suivies");
    expect(html).toContain("Fiches actives");
  });

  it("ScopeCard dit « inclus » ou « non inclus » au lecteur d'écran", () => {
    const html = renderToStaticMarkup(
      h(ScopeCard, {
        title: "Votre offre",
        items: [
          { id: "a", label: "Analyse documentaire", included: true },
          { id: "b", label: "Accompagnement", included: false, detail: "à partir de xx €" },
        ],
      })
    );
    expect(html).toContain("Inclus : </span>Analyse documentaire");
    expect(html).toContain("Non inclus : </span>Accompagnement");
  });

  it("PhaseTimeline : liste ordonnée, étape courante marquée, état écrit", () => {
    const html = renderToStaticMarkup(
      h(PhaseTimeline, {
        label: "Phases de la mission",
        phases: [
          { id: "1", label: "Phase A", state: "done" },
          { id: "2", label: "Phase B", state: "current", percent: 60, period: "01/08 → 15/11/2026" },
          { id: "3", label: "Phase C", state: "upcoming" },
        ],
      })
    );
    expect(html).toContain('<ol aria-label="Phases de la mission"');
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    expect(html).toContain("En cours · 60 %");
    expect(html).toContain("Terminée");
    expect(html).toContain("À venir");
  });

  it("ModeTag distingue accompagné et autonomie", () => {
    expect(renderToStaticMarkup(h(ModeTag, { mode: "accompagne", label: "Accompagné par EODA" }))).toContain("bg-ink-fill");
    expect(renderToStaticMarkup(h(ModeTag, { mode: "autonomie", label: "En autonomie" }))).toContain("bg-card");
  });
});

describe("Button", () => {
  it("toutes les tailles font au moins 44 px de haut", () => {
    for (const size of ["default", "sm", "lg", "icon"] as const) {
      expect(buttonVariants({ size })).toMatch(/\bh-(11|12)\b/);
    }
  });
});
