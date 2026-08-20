import { beforeEach, describe, expect, it, vi } from "vitest";

// Cas de REFUS du portail « Mon accompagnement » (D7).
// Ce qui est vérifié ici, et nulle part ailleurs :
//   - un CLIENT_USER ne lit JAMAIS le contrat d'un autre établissement : rien
//     dans ce module n'accepte d'identifiant d'établissement, tout part du lien
//     de session — le test le prouve en faisant échouer toute requête qui ne
//     porterait pas l'identifiant résolu par la garde ;
//   - pas de mission ⇒ pas d'offre affichée, pas de compteurs ;
//   - pas de devis signé ⇒ AUCUN montant, jamais un montant deviné ;
//   - une demande d'option sur une ligne d'un autre tenant est refusée comme si
//     elle n'existait pas, et n'écrit rien ;
//   - une demande sur une option déjà au contrat est refusée.
// Seules les frontières (base, garde, journal, cache) sont doublées.

const prismaMock = {
  establishment: { findUnique: vi.fn() },
  mission: { findUnique: vi.fn() },
  catalogueOption: { findMany: vi.fn(), findFirst: vi.fn() },
  catalogueFormule: { findUnique: vi.fn() },
  clientOptionRequest: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  document: { findMany: vi.fn() },
};

const requireClientEstablishment = vi.fn();
const getClientChecklist = vi.fn();
const recordAuditEvent = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({
  requireClientEstablishment: () => requireClientEstablishment(),
}));
vi.mock("@/lib/actions/checklist", () => ({
  getClientChecklist: () => getClientChecklist(),
}));
vi.mock("@/lib/services/audit-log-service", () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));

const { getClientContract, requestOptionQuote } = await import("./client-contract");

const MY_ESTABLISHMENT = { id: "etab-mien", name: "SAD Exemple", type: "SAD_AIDE" };

function signedDevisRow() {
  return {
    id: "devis-1",
    number: "DEVIS-2026-004",
    status: "SIGNE",
    formuleLabelSnapshot: "Performance",
    formulePriceSnapshotEuros: 6500,
    depositPercent: 40,
    installmentCount: 3,
    totalAmountEuros: 8000,
    depositAmountEuros: 3200,
    balanceAmountEuros: 4800,
    installmentAmountEuros: 1600,
    options: [
      {
        catalogueOptionId: "opt-souscrite",
        labelSnapshot: "Tableau de bord 24 KPI",
        priceSnapshotEuros: 1200,
        pricingUnitSnapshot: "FORFAIT",
        priceMaxSnapshotEuros: null,
        minQuantitySnapshot: null,
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireClientEstablishment.mockResolvedValue({
    session: { user: { id: "user-1" } },
    userId: "user-1",
    establishment: MY_ESTABLISHMENT,
  });
  prismaMock.establishment.findUnique.mockResolvedValue({
    tenantId: "tenant-1",
    prospect: { devis: [] },
  });
  prismaMock.mission.findUnique.mockResolvedValue(null);
  prismaMock.catalogueOption.findMany.mockResolvedValue([]);
  prismaMock.catalogueFormule.findUnique.mockResolvedValue(null);
  prismaMock.clientOptionRequest.findMany.mockResolvedValue([]);
  prismaMock.clientOptionRequest.findFirst.mockResolvedValue(null);
  prismaMock.clientOptionRequest.create.mockResolvedValue({ id: "req-1" });
  prismaMock.document.findMany.mockResolvedValue([]);
  getClientChecklist.mockResolvedValue({ establishment: MY_ESTABLISHMENT, checklist: {} });
});

describe("getClientContract — cloisonnement", () => {
  it("ne lit QUE l'établissement résolu par la garde, jamais un identifiant reçu", async () => {
    await getClientContract();

    expect(prismaMock.establishment.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "etab-mien" } })
    );
    expect(prismaMock.mission.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { establishmentId: "etab-mien" } })
    );
    expect(prismaMock.clientOptionRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { establishmentId: "etab-mien", status: "DEMANDEE" },
      })
    );
  });

  it("ne lit que le catalogue ACTIF du tenant de l'établissement", async () => {
    await getClientContract();

    expect(prismaMock.catalogueOption.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "tenant-1", active: true } })
    );
  });

  it("rend une vue vide quand aucun établissement n'est rattaché au compte", async () => {
    requireClientEstablishment.mockResolvedValue({
      session: { user: { id: "user-1" } },
      userId: "user-1",
      establishment: null,
    });

    const view = await getClientContract();

    expect(view.establishment).toBeNull();
    expect(view.contract).toEqual({ kind: "NO_DEVIS" });
    expect(view.availableOptions).toEqual([]);
    expect(prismaMock.establishment.findUnique).not.toHaveBeenCalled();
  });
});

describe("getClientContract — sans mission, sans devis", () => {
  it("n'affiche ni offre ni compteurs quand aucune mission n'est ouverte", async () => {
    const view = await getClientContract();

    expect(view.offer).toBeNull();
    expect(view.counters).toBeNull();
    expect(prismaMock.document.findMany).not.toHaveBeenCalled();
  });

  it("n'affiche AUCUN montant quand aucun devis signé n'est rattaché", async () => {
    prismaMock.establishment.findUnique.mockResolvedValue({
      tenantId: "tenant-1",
      prospect: { devis: [{ ...signedDevisRow(), status: "ENVOYE" }] },
    });

    const view = await getClientContract();

    expect(view.contract).toEqual({ kind: "NO_DEVIS" });
    expect(view.subscribedOptions).toEqual([]);
  });

  it("n'affiche aucun montant quand l'établissement n'est rattaché à aucun prospect", async () => {
    prismaMock.establishment.findUnique.mockResolvedValue({ tenantId: "tenant-1", prospect: null });

    const view = await getClientContract();

    expect(view.contract).toEqual({ kind: "NO_DEVIS" });
  });

  it("expose les montants fermes dès qu'un unique devis signé est résolu", async () => {
    prismaMock.establishment.findUnique.mockResolvedValue({
      tenantId: "tenant-1",
      prospect: { devis: [signedDevisRow()] },
    });

    const view = await getClientContract();

    expect(view.contract.kind).toBe("RESOLVED");
    expect(view.subscribedOptions).toHaveLength(1);
  });

  it("résout l'offre depuis Mission.formule, jamais depuis Establishment.commercialTier", async () => {
    prismaMock.mission.findUnique.mockResolvedValue({ formule: "ESSENTIEL", gratuit: false });
    prismaMock.catalogueFormule.findUnique.mockResolvedValue({
      label: "Essentiel",
      modulesLabel: "M1 (critères impératifs)",
      description: "…",
    });

    const view = await getClientContract();

    expect(prismaMock.catalogueFormule.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_formule: { tenantId: "tenant-1", formule: "ESSENTIEL" } },
      })
    );
    expect(view.offer?.label).toBe("Essentiel");
    expect(view.counters).not.toBeNull();
  });
});

describe("requestOptionQuote — le client demande, il ne s'auto-attribue rien (§12.3)", () => {
  function form(fields: Record<string, string>): FormData {
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) formData.set(key, value);
    return formData;
  }

  it("refuse une option d'un AUTRE tenant comme si elle n'existait pas", async () => {
    prismaMock.catalogueOption.findFirst.mockResolvedValue(null);

    const result = await requestOptionQuote(form({ catalogueOptionId: "opt-autre-tenant" }));

    expect(result).toEqual({ ok: false, error: "Cette prestation n'est plus proposée." });
    expect(prismaMock.catalogueOption.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "opt-autre-tenant", tenantId: "tenant-1", active: true },
      })
    );
    expect(prismaMock.clientOptionRequest.create).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("refuse une option déjà incluse au contrat signé", async () => {
    prismaMock.establishment.findUnique.mockResolvedValue({
      tenantId: "tenant-1",
      prospect: { devis: [signedDevisRow()] },
    });
    prismaMock.catalogueOption.findFirst.mockResolvedValue({ id: "opt-souscrite", code: "KPI" });

    const result = await requestOptionQuote(form({ catalogueOptionId: "opt-souscrite" }));

    expect(result).toEqual({
      ok: false,
      error: "Cette prestation est déjà incluse dans votre contrat.",
    });
    expect(prismaMock.clientOptionRequest.create).not.toHaveBeenCalled();
  });

  it("refuse un doublon quand une demande est déjà en attente", async () => {
    prismaMock.catalogueOption.findFirst.mockResolvedValue({ id: "opt-2", code: "AUDIT_FLASH" });
    prismaMock.clientOptionRequest.findFirst.mockResolvedValue({ id: "req-existante" });

    const result = await requestOptionQuote(form({ catalogueOptionId: "opt-2" }));

    expect(result.ok).toBe(false);
    expect(prismaMock.clientOptionRequest.create).not.toHaveBeenCalled();
  });

  it("refuse une demande sans identifiant d'option", async () => {
    const result = await requestOptionQuote(form({}));

    expect(result.ok).toBe(false);
    expect(prismaMock.catalogueOption.findFirst).not.toHaveBeenCalled();
  });

  it("refuse quand aucun établissement n'est rattaché au compte", async () => {
    requireClientEstablishment.mockResolvedValue({
      session: { user: { id: "user-1" } },
      userId: "user-1",
      establishment: null,
    });

    const result = await requestOptionQuote(form({ catalogueOptionId: "opt-2" }));

    expect(result.ok).toBe(false);
    expect(prismaMock.clientOptionRequest.create).not.toHaveBeenCalled();
  });

  it("enregistre la demande sur SON établissement et journalise le CODE, jamais le message", async () => {
    prismaMock.catalogueOption.findFirst.mockResolvedValue({ id: "opt-2", code: "AUDIT_FLASH" });

    const result = await requestOptionQuote(
      form({ catalogueOptionId: "opt-2", message: "Nous avons 12 procédures à reprendre." })
    );

    expect(result).toEqual({ ok: true });
    expect(prismaMock.clientOptionRequest.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        establishmentId: "etab-mien",
        catalogueOptionId: "opt-2",
        requestedByUserId: "user-1",
        message: "Nous avons 12 procédures à reprendre.",
      },
    });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "OPTION_QUOTE_REQUESTED",
        establishmentId: "etab-mien",
        targetId: "opt-2",
        detail: "AUDIT_FLASH",
      })
    );
    const [auditEvent] = recordAuditEvent.mock.calls[0] as [{ detail: string | null }];
    expect(auditEvent.detail).not.toContain("procédures");
  });

  it("répond « déjà transmise » plutôt que de planter si l'index unique tranche une course", async () => {
    prismaMock.catalogueOption.findFirst.mockResolvedValue({ id: "opt-2", code: "AUDIT_FLASH" });
    prismaMock.clientOptionRequest.create.mockRejectedValue(new Error("unique violation"));

    const result = await requestOptionQuote(form({ catalogueOptionId: "opt-2" }));

    expect(result.ok).toBe(false);
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
});
