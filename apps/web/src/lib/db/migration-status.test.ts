import { describe, expect, it } from "vitest";
import {
  describeMigrationStatus,
  diffMigrations,
  isSchemaUpToDate,
  type MigrationRow,
} from "./migration-status";

const applied = (name: string): MigrationRow => ({
  migrationName: name,
  finishedAt: new Date("2026-08-20T10:00:00Z"),
  rolledBackAt: null,
});

describe("diffMigrations", () => {
  it("ne trouve aucun écart quand la base porte exactement les migrations attendues", () => {
    const status = diffMigrations(["a", "b"], [applied("a"), applied("b")]);
    expect(status).toEqual({ pending: [], failed: [], unknown: [] });
    expect(isSchemaUpToDate(status)).toBe(true);
  });

  it("signale une base EN RETARD", () => {
    const status = diffMigrations(["a", "b", "c"], [applied("a")]);
    expect(status.pending).toEqual(["b", "c"]);
    expect(isSchemaUpToDate(status)).toBe(false);
  });

  it("ne compte pas comme appliquée une migration interrompue (finished_at null)", () => {
    const status = diffMigrations(["a"], [{ migrationName: "a", finishedAt: null, rolledBackAt: null }]);
    expect(status.pending).toEqual(["a"]);
    expect(status.failed).toEqual(["a"]);
    expect(isSchemaUpToDate(status)).toBe(false);
  });

  it("ne compte pas comme appliquée une migration annulée (rolled_back_at)", () => {
    const status = diffMigrations(["a"], [
      { migrationName: "a", finishedAt: new Date(), rolledBackAt: new Date() },
    ]);
    expect(status.pending).toEqual(["a"]);
    expect(status.failed).toEqual(["a"]);
  });

  it("signale une base EN AVANCE sans la considérer comme désynchronisée", () => {
    const status = diffMigrations(["a"], [applied("a"), applied("z_future")]);
    expect(status.unknown).toEqual(["z_future"]);
    // Un retour arrière applicatif est un état légitime : on informe, on ne bloque pas.
    expect(isSchemaUpToDate(status)).toBe(true);
  });
});

describe("describeMigrationStatus", () => {
  it("compose un message unique couvrant les trois écarts", () => {
    const message = describeMigrationStatus({
      pending: ["b"],
      failed: ["a"],
      unknown: ["z"],
    });
    expect(message).toContain("a");
    expect(message).toContain("b");
    expect(message).toContain("z");
  });

  it("rend une chaîne vide quand il n'y a rien à dire", () => {
    expect(describeMigrationStatus({ pending: [], failed: [], unknown: [] })).toBe("");
  });
});
