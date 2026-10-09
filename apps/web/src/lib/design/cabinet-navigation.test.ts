import { describe, expect, it } from "vitest";
import { buildCabinetBreadcrumb, buildCabinetNav, canSeeCommercial, REVIEW_QUEUE_PATH } from "./cabinet-navigation";
import { resolveActiveItem } from "./navigation";

const NO_COUNTS = { documentsAwaitingReview: 0, pendingOptionRequests: 0 };
const ids = (role: Parameters<typeof buildCabinetNav>[0]) =>
  buildCabinetNav(role, NO_COUNTS).flatMap((s) => s.items.map((i) => i.id));

describe("visibilité par rôle", () => {
  it("l'admin voit la section Commercial", () => {
    expect(canSeeCommercial("CABINET_ADMIN")).toBe(true);
    const sections = buildCabinetNav("CABINET_ADMIN", NO_COUNTS);
    expect(sections.map((s) => s.label)).toEqual([null, "Commercial"]);
    expect(ids("CABINET_ADMIN")).toEqual(
      expect.arrayContaining(["commercial-overview", "prospects", "devis", "catalogue"])
    );
  });

  it("une évaluatrice ne voit aucune entrée commerciale", () => {
    expect(canSeeCommercial("CABINET_EVALUATOR")).toBe(false);
    expect(ids("CABINET_EVALUATOR")).toEqual(["structures", "review", "agenda", "library", "journal"]);
  });

  it("un client ne voit rien de commercial non plus (refus par défaut)", () => {
    expect(canSeeCommercial("CLIENT_USER")).toBe(false);
    expect(ids("CLIENT_USER")).not.toContain("devis");
  });

  it("n'annonce aucune entrée sans route (Accueil, Équipe EODA)", () => {
    expect(ids("CABINET_ADMIN")).not.toContain("home");
    expect(ids("CABINET_ADMIN")).not.toContain("team");
  });
});

describe("compteurs", () => {
  it("porte le nombre de documents à relire et son libellé accordé", () => {
    const review = buildCabinetNav("CABINET_EVALUATOR", { documentsAwaitingReview: 3, pendingOptionRequests: 9 })[0]
      ?.items.find((i) => i.id === "review");
    expect(review).toMatchObject({ href: REVIEW_QUEUE_PATH, count: 3, countLabel: "3 documents à relire" });
  });

  it("singulier pour un seul document", () => {
    const review = buildCabinetNav("CABINET_ADMIN", { documentsAwaitingReview: 1, pendingOptionRequests: 1 })[0]
      ?.items.find((i) => i.id === "review");
    expect(review?.countLabel).toBe("1 document à relire");
  });

  it("place les demandes de prestation sur la vue d'ensemble commerciale", () => {
    const overview = buildCabinetNav("CABINET_ADMIN", { documentsAwaitingReview: 0, pendingOptionRequests: 2 })[1]
      ?.items.find((i) => i.id === "commercial-overview");
    expect(overview).toMatchObject({ count: 2, countLabel: "2 demandes de prestation en attente" });
  });
});

describe("entrée active", () => {
  const sections = buildCabinetNav("CABINET_ADMIN", NO_COUNTS);
  const active = (pathname: string) => resolveActiveItem(sections, pathname)?.id ?? null;

  it.each([
    ["/dashboard/cabinet", "structures"],
    ["/dashboard/cabinet/etablissements/abc", "structures"],
    ["/dashboard/cabinet/etablissements/abc/mission", "structures"],
    ["/dashboard/cabinet/a-relire", "review"],
    ["/dashboard/cabinet/agenda", "agenda"],
    ["/dashboard/cabinet/modeles/x", "library"],
    ["/dashboard/cabinet/journal", "journal"],
    ["/dashboard/cabinet/commercial", "commercial-overview"],
    ["/dashboard/cabinet/commercial/prospects/p1/modifier", "prospects"],
    ["/dashboard/cabinet/commercial/devis/nouveau", "devis"],
    ["/dashboard/cabinet/commercial/catalogue", "catalogue"],
    ["/dashboard/profil", null],
    ["/dashboard/cabinet/agendas", null],
  ])("%s → %s", (pathname, expected) => {
    expect(active(pathname)).toBe(expected);
  });
});

describe("fil d'Ariane", () => {
  const sections = buildCabinetNav("CABINET_ADMIN", NO_COUNTS);
  const crumbs = (pathname: string) => buildCabinetBreadcrumb(sections, pathname);

  it("page de section : une seule miette, sans lien vers elle-même", () => {
    expect(crumbs("/dashboard/cabinet/agenda")).toEqual([{ label: "Agenda", href: null }]);
  });

  it("fiche structure et sous-page", () => {
    expect(crumbs("/dashboard/cabinet/etablissements/abc/mission")).toEqual([
      { label: "Structures", href: "/dashboard/cabinet" },
      { label: "Fiche structure", href: "/dashboard/cabinet/etablissements/abc" },
      { label: "Mission", href: null },
    ]);
  });

  it("chapitre d'auto-évaluation : le numéro est le libellé, le segment « chapitre » est sauté", () => {
    expect(crumbs("/dashboard/cabinet/etablissements/abc/evaluation/chapitre/2").map((c) => c.label)).toEqual([
      "Structures",
      "Fiche structure",
      "Auto-évaluation",
      "Chapitre 2",
    ]);
  });

  it("section commerciale : intertitre non cliquable, puis l'entrée", () => {
    expect(crumbs("/dashboard/cabinet/commercial/devis/d1/signature")).toEqual([
      { label: "Commercial", href: null },
      { label: "Devis", href: "/dashboard/cabinet/commercial/devis" },
      { label: "Devis", href: "/dashboard/cabinet/commercial/devis/d1" },
      { label: "Signature", href: null },
    ]);
  });

  it("segment inconnu : ignoré plutôt qu'affiché sous son nom technique", () => {
    expect(crumbs("/dashboard/cabinet/journal/xyz")).toEqual([{ label: "Journal", href: null }]);
  });

  it("pages partagées (profil, aide)", () => {
    expect(crumbs("/dashboard/profil")).toEqual([{ label: "Mon profil", href: null }]);
    expect(crumbs("/dashboard/aide/demarrer")).toEqual([
      { label: "Aide", href: "/dashboard/aide" },
      { label: "Article", href: null },
    ]);
  });

  it("adresse hors cabinet : aucun fil", () => {
    expect(crumbs("/ailleurs")).toEqual([]);
  });
});
