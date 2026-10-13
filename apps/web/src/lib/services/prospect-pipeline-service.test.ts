import { describe, expect, it } from "vitest";
import { deriveDiagnosticProgress } from "./prospect-diagnostic-service";
import {
  countPipelineTabs,
  filterPipeline,
  modeLabelFor,
  originOf,
  parseOriginFilter,
  parsePipelineTab,
  pipelineAction,
  tabsOf,
  type PipelineRow,
} from "./prospect-pipeline-service";

const call: PipelineRow = { id: "a", origin: "LIBRE_SERVICE", progress: deriveDiagnosticProgress(16, 16), signal: null, hasPendingCall: true };
const done: PipelineRow = { id: "b", origin: "LIBRE_SERVICE", progress: deriveDiagnosticProgress(16, 16), signal: null, hasPendingCall: false };
const inProgress: PipelineRow = { id: "c", origin: "LIBRE_SERVICE", progress: deriveDiagnosticProgress(4, 16), signal: null, hasPendingCall: false };
const prospected: PipelineRow = { id: "d", origin: "DEMARCHE", progress: null, signal: null, hasPendingCall: false };
const rows = [call, done, inProgress, prospected];

describe("onglets et filtre d'origine", () => {
  it("paramètres d'adresse non fiables : retombent sur Tous", () => {
    expect(parsePipelineTab("appel")).toBe("appel");
    expect(parsePipelineTab("x")).toBe("tous");
    expect(parseOriginFilter("DEMARCHE")).toBe("DEMARCHE");
    expect(parseOriginFilter(undefined)).toBe("TOUS");
  });

  it("origine dérivée du canal", () => {
    expect(originOf("LIBRE_SERVICE")).toBe("LIBRE_SERVICE");
    expect(originOf("REFERENCEMENT_UNA")).toBe("DEMARCHE");
    expect(originOf("BOUCHE_A_OREILLE")).toBe("DEMARCHE");
  });

  it("un démarché n'est que dans « Tous » (pas de diagnostic en ligne)", () => {
    expect(tabsOf(prospected)).toEqual(["tous"]);
    expect(tabsOf(call)).toEqual(["tous", "appel", "termine"]);
    expect(tabsOf(inProgress)).toEqual(["tous", "en-cours"]);
  });

  it("compte par onglet, selon l'origine", () => {
    expect(countPipelineTabs(rows, "TOUS")).toEqual({ tous: 4, appel: 1, termine: 2, "en-cours": 1 });
    expect(countPipelineTabs(rows, "DEMARCHE")).toEqual({ tous: 1, appel: 0, termine: 0, "en-cours": 0 });
    expect(filterPipeline(rows, "tous", "LIBRE_SERVICE").map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(filterPipeline(rows, "termine", "TOUS").map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("geste de la ligne", () => {
  it("préparer l'appel, appeler, relancer, ouvrir", () => {
    expect(pipelineAction(call)).toBe("PREPARE_CALL");
    expect(pipelineAction(done)).toBe("CALL");
    expect(pipelineAction(inProgress)).toBe("REMIND");
    expect(pipelineAction(prospected)).toBe("OPEN");
    expect(pipelineAction({ ...prospected, hasPendingCall: true })).toBe("PREPARE_CALL");
  });
});

describe("étiquette de mode", () => {
  it("offre et mode pour une structure inscrite ; « Démarché » sinon", () => {
    expect(modeLabelFor("LIBRE_SERVICE", "ESSENTIEL")).toBe("Essentiel · seul");
    expect(modeLabelFor("LIBRE_SERVICE", "PERFORMANCE")).toBe("Performance · seul");
    expect(modeLabelFor("LIBRE_SERVICE", "EXCELLENCE")).toBe("Excellence · avec EODA");
    expect(modeLabelFor("LIBRE_SERVICE", null)).toBe("Inscrite seule");
    expect(modeLabelFor("DEMARCHE", "EXCELLENCE")).toBe("Démarché");
  });
});
