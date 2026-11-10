import { beforeEach, describe, expect, it, vi } from "vitest";

// La liste des documents face à une ligne à ACCÈS RESTREINT (le tampon, ADR 20261110) :
// la ligne et son état restent visibles (« Déposé le … »), mais l'écran ne propose
// d'ouvrir le fichier qu'à la direction de la structure, et aucune analyse ni
// suggestion — même enregistrée avant la restriction — n'est restituée à personne.

const prismaMock = {
  mission: { findUnique: vi.fn() },
  documentType: { findMany: vi.fn() },
  document: { findMany: vi.fn() },
};
const requireEstablishmentInTenant = vi.fn();
const requireClientEstablishment = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@/lib/auth/guards", () => ({
  requireEstablishmentInTenant: (...a: unknown[]) => requireEstablishmentInTenant(...a),
  requireClientEstablishment: (...a: unknown[]) => requireClientEstablishment(...a),
}));

const { getEstablishmentChecklist, getClientChecklist } = await import("./checklist");

const ANALYSIS = { elementsPresents: [], elementsManquants: ["Signature"], suggestionsCorrection: [], sembleConforme: false };
const UPLOADED = new Date("2026-11-09T10:00:00Z");

const types = [
  { id: "dt-t", code: "DEPARTEMENT_TAMPON", label: "Tampon", category: "FONCTIONNEMENT", isConditional: false, expectedFrequency: null, requestedFromClient: true, folder: null },
  { id: "dt-l", code: "L2002_LIVRET_ACCUEIL", label: "Livret", category: "LOI_2002_2", isConditional: false, expectedFrequency: null, requestedFromClient: true, folder: null },
];
const doc = (typeId: string, versionId: string) => ({
  id: `doc-${typeId}`,
  documentTypeId: typeId,
  status: "UPLOADED",
  statusOverriddenByUser: false,
  missingJustification: null,
  commentUsedByAi: true,
  participationForm: null,
  participationOtherLabel: null,
  analysisDirective: null,
  directiveInAnalysis: false,
  validatedAt: null,
  clientAcceptedAt: null,
  currentVersion: {
    id: versionId,
    versionNumber: 1,
    originalFilename: "fichier.pdf",
    uploadedAt: UPLOADED,
    analysisResultJson: ANALYSIS,
    analysisReviewedAt: null,
    uploadedBy: { role: "CLIENT_USER" },
  },
  criterionSuggestions: [{ id: "s1", justification: "page 1", criterion: { code: "1.1.1", label: "Critère", requirementLevel: "STANDARD" } }],
  versions: [{ id: versionId, versionNumber: 1, originalFilename: "fichier.pdf", uploadedAt: UPLOADED, analysisResultJson: ANALYSIS, uploadedBy: { name: "Direction", role: "CLIENT_USER" } }],
});

const items = (checklist: Record<string, { code: string }[]>) => Object.values(checklist).flat() as unknown as Record<string, unknown>[];
const byCode = (list: Record<string, unknown>[], code: string) => list.find((item) => item.code === code)!;

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.mission.findUnique.mockResolvedValue(null);
  prismaMock.documentType.findMany.mockResolvedValue(types);
  prismaMock.document.findMany.mockResolvedValue([doc("dt-t", "v-t"), doc("dt-l", "v-l")]);
  requireEstablishmentInTenant.mockResolvedValue({ establishmentType: "SAD_AIDE" });
});

describe("liste des documents — cabinet", () => {
  it("la ligne du tampon reste visible avec sa date, sans fichier à ouvrir, sans analyse ni suggestion", async () => {
    const list = items(await getEstablishmentChecklist("etab-1"));
    const tampon = byCode(list, "DEPARTEMENT_TAMPON") as {
      restrictedAccess: boolean;
      canOpenFile: boolean;
      currentVersion: { uploadedAt: Date; analysis: unknown; criterionSuggestions: unknown[]; analysisAwaitingReview: boolean };
      versions: { hasAnalysis: boolean }[];
    };
    expect(tampon.restrictedAccess).toBe(true);
    expect(tampon.canOpenFile).toBe(false);
    expect(tampon.currentVersion.uploadedAt).toEqual(UPLOADED);
    expect(tampon.currentVersion.analysis).toBeNull();
    expect(tampon.currentVersion.analysisAwaitingReview).toBe(false);
    expect(tampon.currentVersion.criterionSuggestions).toEqual([]);
    expect(tampon.versions[0]!.hasAnalysis).toBe(false);

    const livret = byCode(list, "L2002_LIVRET_ACCUEIL") as { restrictedAccess: boolean; canOpenFile: boolean; currentVersion: { analysis: unknown } };
    expect(livret.restrictedAccess).toBe(false);
    expect(livret.canOpenFile).toBe(true);
    expect(livret.currentVersion.analysis).not.toBeNull();
  });
});

describe("liste des documents — structure", () => {
  const asClient = (accessRole: string) =>
    requireClientEstablishment.mockResolvedValue({
      session: { user: { name: "Personne" } },
      establishment: { id: "etab-1", name: "SAD fictif", type: "SAD_AIDE", logoDataUri: null },
      accessRole,
      missionAccess: "ACTIVE",
      missionClosure: null,
    });

  it("la direction peut ouvrir le tampon", async () => {
    asClient("DIRECTION");
    const { checklist } = await getClientChecklist();
    expect(byCode(items(checklist), "DEPARTEMENT_TAMPON")).toMatchObject({ restrictedAccess: true, canOpenFile: true });
  });

  it.each(["RESPONSABLE_QUALITE", "ADMINISTRATIF"])("%s voit la ligne, pas le fichier", async (role) => {
    asClient(role);
    const { checklist } = await getClientChecklist();
    expect(byCode(items(checklist), "DEPARTEMENT_TAMPON")).toMatchObject({ restrictedAccess: true, canOpenFile: false });
    expect(byCode(items(checklist), "L2002_LIVRET_ACCUEIL")).toMatchObject({ restrictedAccess: false, canOpenFile: true });
  });
});

// Relecture de sécurité du 10/11/2026 : le nom du fichier du tampon et le nom de qui l'a
// déposé partaient au cabinet et aux rôles de la structure qui n'ouvrent pas le fichier.
describe("liste des documents — nom de fichier et auteur d'une ligne restreinte", () => {
  type Masked = {
    currentVersion: { originalFilename: string };
    versions: { originalFilename: string; uploadedByName: string | null }[];
  };
  const asClient = (accessRole: string) =>
    requireClientEstablishment.mockResolvedValue({
      session: { user: { name: "Personne" } },
      establishment: { id: "etab-1", name: "SAD fictif", type: "SAD_AIDE", logoDataUri: null },
      accessRole,
      missionAccess: "ACTIVE",
      missionClosure: null,
    });
  const expectMasked = (item: Masked) => {
    expect(item.currentVersion.originalFilename).toBe("Fichier à accès restreint");
    expect(item.versions[0]).toMatchObject({ originalFilename: "Fichier à accès restreint", uploadedByName: null });
  };

  it("cabinet : nom remplacé, auteur masqué — le livret garde les siens", async () => {
    const list = items(await getEstablishmentChecklist("etab-1"));
    expectMasked(byCode(list, "DEPARTEMENT_TAMPON") as unknown as Masked);
    const livret = byCode(list, "L2002_LIVRET_ACCUEIL") as unknown as Masked;
    expect(livret.versions[0]).toMatchObject({ originalFilename: "fichier.pdf", uploadedByName: "Direction" });
  });

  it("responsable qualité : nom remplacé, auteur masqué", async () => {
    asClient("RESPONSABLE_QUALITE");
    const { checklist } = await getClientChecklist();
    expectMasked(byCode(items(checklist), "DEPARTEMENT_TAMPON") as unknown as Masked);
  });

  it("direction : voit le nom de son fichier et qui l'a déposé", async () => {
    asClient("DIRECTION");
    const { checklist } = await getClientChecklist();
    const tampon = byCode(items(checklist), "DEPARTEMENT_TAMPON") as unknown as Masked;
    expect(tampon.currentVersion.originalFilename).toBe("fichier.pdf");
    expect(tampon.versions[0]).toMatchObject({ originalFilename: "fichier.pdf", uploadedByName: "Direction" });
  });
});
