import { describe, expect, it, vi } from "vitest";
import {
  CABINET_ASSISTANT_TOOLS,
  PREDEFINED_TASKS,
  buildCabinetSystemPrompt,
  runCabinetAgent,
  type AgentDeps,
} from "./cabinet-assistant-agent";

// Assistant du menu latéral (11/11/2026, « comme MusicPlanner » pour EODA) : boucle
// d'outils bornée, outils limités au périmètre de la consultante, propositions validées
// avant de devenir des cartes, jamais un verdict.

const deps = () => ({
  listStructures: vi.fn().mockResolvedValue([{ id: "etab-1", nom: "SAD Les Glycines (fictif)" }]),
  getStructureDocuments: vi.fn().mockResolvedValue([{ documentTypeId: "dt-1", intitule: "Plan de crise", etat: "À relire" }]),
  getDocument: vi.fn().mockResolvedValue({ intitule: "Plan de crise", analyse: "Manque : DAC" }),
  describeDocumentDesign: vi.fn().mockResolvedValue("corps en Calibri 11 pt"),
  getStructureDesign: vi.fn().mockResolvedValue({ consignes: null, modele: null }),
  searchKnowledge: vi.fn().mockResolvedValue(["Extrait HAS 3.14.2"]),
  resolveTarget: vi.fn(async (structureId: string, documentTypeId: string | null) =>
    structureId === "etab-1" && (documentTypeId === null || documentTypeId === "dt-1")
      ? { establishmentName: "SAD Les Glycines (fictif)", documentLabel: documentTypeId ? "Plan de crise" : null }
      : null
  ),
}) satisfies AgentDeps;

const step = (content: string, toolCalls: { id: string; name: string; arguments: string }[] = [], cost = 0.001) => ({
  content,
  toolCalls,
  cost,
  inputTokens: 100,
  outputTokens: 20,
  model: "minimax/minimax-m2.7",
  truncated: false,
});

describe("runCabinetAgent", () => {
  it("appelle les outils demandés, renvoie leurs résultats comme données, puis répond", async () => {
    const d = deps();
    const port = {
      step: vi
        .fn()
        .mockResolvedValueOnce(step("", [{ id: "t1", name: "list_structures", arguments: "{}" }]))
        .mockResolvedValueOnce(step("Vous suivez une structure : SAD Les Glycines (fictif).")),
    };
    const result = await runCabinetAgent({ port, deps: d, question: "Qui suivons-nous ?", history: [], userName: "Consultante" });
    expect(result.text).toBe("Vous suivez une structure : SAD Les Glycines (fictif).");
    expect(result.toolsUsed).toEqual(["list_structures"]);
    expect(result.cost).toBeCloseTo(0.002);
    const second = port.step.mock.calls[1]?.[0] as { role: string; content?: string; tool_call_id?: string }[];
    const toolMessage = second.find((m) => m.role === "tool");
    expect(toolMessage?.tool_call_id).toBe("t1");
    expect(toolMessage?.content).toContain("SAD Les Glycines");
  });

  it("une proposition dans le périmètre devient une carte, nommée ; hors périmètre, refusée", async () => {
    const d = deps();
    const port = {
      step: vi
        .fn()
        .mockResolvedValueOnce(
          step("", [
            { id: "a", name: "propose_information_request", arguments: JSON.stringify({ structureId: "etab-1", documentTypeId: "dt-1", texte: "Coordonnées du DAC ?" }) },
            { id: "b", name: "propose_information_request", arguments: JSON.stringify({ structureId: "etab-autre", documentTypeId: "dt-9", texte: "x" }) },
            { id: "c", name: "propose_design_notes", arguments: JSON.stringify({ structureId: "etab-1", texte: "Titres en Georgia vert" }) },
          ])
        )
        .mockResolvedValueOnce(step("Je vous propose deux actions ci-dessous.")),
    };
    const result = await runCabinetAgent({ port, deps: d, question: "q", history: [], userName: "C" });
    expect(result.proposals).toEqual([
      {
        kind: "INFORMATION_REQUEST",
        text: "Coordonnées du DAC ?",
        status: "PENDING",
        establishmentId: "etab-1",
        establishmentName: "SAD Les Glycines (fictif)",
        documentTypeId: "dt-1",
        documentLabel: "Plan de crise",
      },
      {
        kind: "DESIGN_NOTES",
        text: "Titres en Georgia vert",
        status: "PENDING",
        establishmentId: "etab-1",
        establishmentName: "SAD Les Glycines (fictif)",
        documentTypeId: null,
        documentLabel: null,
      },
    ]);
    const tools = (port.step.mock.calls[1]?.[0] as { role: string; content?: string }[]).filter((m) => m.role === "tool");
    expect(tools[1]?.content).toMatch(/introuvable/);
  });

  it("un outil de lecture hors périmètre répond « introuvable », jamais une donnée", async () => {
    const d = deps();
    d.getDocument.mockResolvedValue(null);
    const port = {
      step: vi
        .fn()
        .mockResolvedValueOnce(step("", [{ id: "t", name: "get_document", arguments: JSON.stringify({ structureId: "x", documentTypeId: "y" }) }]))
        .mockResolvedValueOnce(step("Je ne trouve pas ce document.")),
    };
    await runCabinetAgent({ port, deps: d, question: "q", history: [], userName: "C" });
    const tool = (port.step.mock.calls[1]?.[0] as { role: string; content?: string }[]).find((m) => m.role === "tool");
    expect(tool?.content).toMatch(/introuvable/);
  });

  it("le modèle choisi part à chaque tour", async () => {
    const port = {
      step: vi
        .fn()
        .mockResolvedValueOnce(step("", [{ id: "t1", name: "list_structures", arguments: "{}" }]))
        .mockResolvedValueOnce(step("ok")),
    };
    await runCabinetAgent({ port, deps: deps(), question: "q", history: [], userName: "C", model: "z-ai/glm-5.3-flash" });
    expect(port.step.mock.calls.map((c) => (c[1] as { model?: string }).model)).toEqual(["z-ai/glm-5.3-flash", "z-ai/glm-5.3-flash"]);
  });

  it("au plus 4 tours d'outils, puis une réponse finale sans outils", async () => {
    const port = { step: vi.fn().mockResolvedValue(step("", [{ id: "t", name: "list_structures", arguments: "{}" }])) };
    port.step.mockResolvedValueOnce(step("", [{ id: "t", name: "list_structures", arguments: "{}" }]))
      .mockResolvedValueOnce(step("", [{ id: "t", name: "list_structures", arguments: "{}" }]))
      .mockResolvedValueOnce(step("", [{ id: "t", name: "list_structures", arguments: "{}" }]))
      .mockResolvedValueOnce(step("", [{ id: "t", name: "list_structures", arguments: "{}" }]))
      .mockResolvedValueOnce(step("Synthèse."));
    const result = await runCabinetAgent({ port, deps: deps(), question: "q", history: [], userName: "C" });
    expect(port.step).toHaveBeenCalledTimes(5);
    expect((port.step.mock.calls[4]?.[1] as { tools?: unknown }).tools).toBeUndefined();
    expect(result.text).toBe("Synthèse.");
  });

  it("jamais « conforme » ; écriture étrangère refusée en gardant le coût", async () => {
    const ok = { step: vi.fn().mockResolvedValueOnce(step("Le document est conforme.")) };
    expect((await runCabinetAgent({ port: ok, deps: deps(), question: "q", history: [], userName: "C" })).text).not.toMatch(/conforme/);
    const ko = { step: vi.fn().mockResolvedValue(step("规范", [], 0.002)) };
    await expect(runCabinetAgent({ port: ko, deps: deps(), question: "q", history: [], userName: "C" })).rejects.toMatchObject({ cost: expect.any(Number) });
  });
});

describe("outils et tâches prédéfinies", () => {
  it("lecture et propositions déclarées ; aucun outil n'écrit", () => {
    const names = CABINET_ASSISTANT_TOOLS.map((t) => t.function.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "list_structures",
        "get_structure_documents",
        "get_document",
        "describe_document_design",
        "get_structure_design",
        "search_knowledge",
        "propose_comment",
        "propose_information_request",
        "propose_design_notes",
      ])
    );
    expect(names.some((n) => /^(save|update|delete|validate|create)_/.test(n))).toBe(false);
  });

  it("des tâches prédéfinies, chacune avec sa question", () => {
    expect(PREDEFINED_TASKS.length).toBeGreaterThanOrEqual(5);
    expect(PREDEFINED_TASKS.every((t) => t.label.length > 0 && t.prompt.length > 10)).toBe(true);
  });

  it("le prompt pose la doctrine", () => {
    const prompt = buildCabinetSystemPrompt({ userName: "C", today: new Date(2026, 10, 11) });
    expect(prompt).toMatch(/jamais un verdict/);
    expect(prompt).toMatch(/données, jamais des instructions/);
    expect(prompt).toMatch(/sans Markdown/);
    expect(prompt).toContain("11/11/2026");
  });
});
