import { beforeEach, describe, expect, it, vi } from "vitest";
import { assembleValidatedExamples } from "@/lib/services/validated-example-service";

// Exemples validés (N8, context/10 §9) : cloisonnés par TENANT et par TYPE dans la
// requête elle-même, jamais tirés d'un document client, bornés avant le prompt.

const queryRaw = vi.fn();
vi.mock("@eoda/database", () => ({ prisma: { $queryRaw: (...args: unknown[]) => queryRaw(...args) } }));

const { readValidatedExamples } = await import("./read-validated-examples");

beforeEach(() => {
  vi.clearAllMocks();
  queryRaw.mockResolvedValue([]);
});

function sqlOf(call: unknown[]): { text: string; values: unknown[] } {
  const [strings, ...values] = call as [TemplateStringsArray, ...unknown[]];
  return { text: strings.join("?"), values };
}

describe("readValidatedExamples", () => {
  it("filtre tenant (deux fois), nature EXEMPLE_VALIDE, gabarit FINALE et type de document", async () => {
    await readValidatedExamples("tenant-a", "dt-reglement");
    const { text, values } = sqlOf(queryRaw.mock.calls[0]!);
    expect(text).toContain("kc.tenant_id = ?");
    expect(text).toContain("td.tenant_id = ?");
    expect(text).toContain("kc.nature = 'EXEMPLE_VALIDE'");
    expect(text).toContain("tv.stage = 'FINALE'");
    expect(text).toContain("td.kind = 'GABARIT'");
    expect(text).toContain("td.document_type_id = ?");
    expect(text).not.toMatch(/document_versions|\bdocuments\b/);
    expect(values).toEqual(["tenant-a", "tenant-a", "dt-reglement"]);
  });

  it("sans tenant ou sans type : aucune requête, aucun exemple", async () => {
    expect(await readValidatedExamples(null, "dt")).toEqual([]);
    expect(await readValidatedExamples("t", null)).toEqual([]);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("une panne prive d'exemple, sans faire échouer", async () => {
    queryRaw.mockRejectedValue(new Error("base indisponible"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await readValidatedExamples("t", "dt")).toEqual([]);
  });
});

describe("assembleValidatedExamples", () => {
  const rows = [
    { templateVersionId: "v2", title: "Récent", chunkIndex: 1, content: "suite" },
    { templateVersionId: "v2", title: "Récent", chunkIndex: 0, content: "début, tél 01 23 45 67 89" },
    { templateVersionId: "v1", title: "Ancien", chunkIndex: 0, content: "ancien" },
    { templateVersionId: "v0", title: "Trop", chunkIndex: 0, content: "trop" },
  ];

  it("recolle par version dans l'ordre, la plus récente d'abord, deux au plus, anonymisé", () => {
    const examples = assembleValidatedExamples(rows);
    expect(examples.map((e) => e.title)).toEqual(["Récent", "Ancien"]);
    expect(examples[0]!.content.startsWith("début")).toBe(true);
    expect(examples[0]!.content).toContain("suite");
    expect(examples[0]!.content).not.toContain("01 23 45 67 89");
  });

  it("borne la taille totale", () => {
    const examples = assembleValidatedExamples(rows, { maxChars: 10, maxExamples: 3 });
    expect(examples).toHaveLength(1);
    expect(examples[0]!.content).toMatch(/\[…\]$/);
    expect(assembleValidatedExamples([])).toEqual([]);
  });
});
