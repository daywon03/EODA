import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONNECTION_LIMIT,
  connectionPoolWarning,
  resolveRuntimeDatabaseUrl,
  TRANSACTION_POOLER_PORT,
} from "../../../../../packages/database/src/database-url";

// ─────────────────────────────────────────────────────────────────────────────
// LE POOL EST BORNÉ — sinon le poste et la production se disputent 15 créneaux.
//
// Incident du 16/10/2026 (page d'accueil cabinet) :
//   FATAL: (EMAXCONNSESSION) max clients reached in session mode ... pool_size: 15
//
// Mesuré : `DATABASE_URL` vise le pooler Supabase en mode session (port 5432), et sans
// paramètre Prisma ouvre `nb_cpu_physiques × 2 + 1` connexions PAR PROCESSUS — 21 sur un
// poste à 10 cœurs. Une page qui lance cinq requêtes en parallèle en réclame cinq d'un
// coup. Deux clients concurrents suffisent alors à tout bloquer, sur une base que le
// poste de développement PARTAGE avec la production.
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_POOLER = "postgresql://postgres.abc:pwd@aws-0-eu-west-1.pooler.supabase.com:5432/postgres";
const TRANSACTION_POOLER = "postgresql://postgres.abc:pwd@aws-0-eu-west-1.pooler.supabase.com:6543/postgres";

describe("resolveRuntimeDatabaseUrl", () => {
  it("borne le pool à une connexion par instance quand rien n'est demandé", () => {
    const resolution = resolveRuntimeDatabaseUrl(SESSION_POOLER);

    expect(DEFAULT_CONNECTION_LIMIT).toBe(1);
    expect(resolution.applied).toEqual(["connection_limit=1"]);
    expect(new URL(resolution.url).searchParams.get("connection_limit")).toBe("1");
  });

  it("n'écrase pas un `connection_limit` explicite, mais le signale comme non ajouté", () => {
    const resolution = resolveRuntimeDatabaseUrl(`${SESSION_POOLER}?connection_limit=5`);

    expect(resolution.applied).toEqual([]);
    expect(new URL(resolution.url).searchParams.get("connection_limit")).toBe("5");
  });

  it("conserve les paramètres déjà présents", () => {
    const resolution = resolveRuntimeDatabaseUrl(`${SESSION_POOLER}?pgbouncer=true&schema=public`);

    const params = new URL(resolution.url).searchParams;
    expect(params.get("pgbouncer")).toBe("true");
    expect(params.get("schema")).toBe("public");
    expect(params.get("connection_limit")).toBe("1");
  });

  it("ajoute `pgbouncer=true` en mode transaction, où les requêtes préparées ne tiennent pas", () => {
    const resolution = resolveRuntimeDatabaseUrl(TRANSACTION_POOLER);

    expect(resolution.applied).toEqual(["connection_limit=1", "pgbouncer=true"]);
    expect(new URL(resolution.url).searchParams.get("pgbouncer")).toBe("true");
  });

  it("ne touche pas au port : router en 6543 est un choix d'infrastructure, pas du code", () => {
    expect(new URL(resolveRuntimeDatabaseUrl(SESSION_POOLER).url).port).toBe("5432");
    expect(TRANSACTION_POOLER_PORT).toBe("6543");
  });

  it("rend l'URL telle quelle quand elle n'est pas analysable, sans lever", () => {
    // Lever ici transformerait une faute de frappe dans une variable d'environnement en
    // plantage à l'import du paquet — y compris pour des scripts sans rapport.
    const resolution = resolveRuntimeDatabaseUrl("pas une url");

    expect(resolution).toEqual({ url: "pas une url", applied: [], sessionModePooler: false, parsed: false });
  });

  it("reconnaît le mode session, et lui seul", () => {
    expect(resolveRuntimeDatabaseUrl(SESSION_POOLER).sessionModePooler).toBe(true);
    expect(resolveRuntimeDatabaseUrl(TRANSACTION_POOLER).sessionModePooler).toBe(false);
    // Connexion directe au projet : pas de pooler, donc pas de plafond de 15 clients.
    expect(
      resolveRuntimeDatabaseUrl("postgresql://postgres:pwd@db.abcdefgh.supabase.co:5432/postgres").sessionModePooler
    ).toBe(false);
  });
});

describe("connectionPoolWarning", () => {
  it("nomme le remède en mode session, et se tait sinon", () => {
    const warning = connectionPoolWarning(resolveRuntimeDatabaseUrl(SESSION_POOLER));

    expect(warning).toContain("mode SESSION");
    expect(warning).toContain("6543");
    expect(warning).toContain("pgbouncer=true");
    expect(connectionPoolWarning(resolveRuntimeDatabaseUrl(TRANSACTION_POOLER))).toBeNull();
    expect(connectionPoolWarning(resolveRuntimeDatabaseUrl("pas une url"))).toBeNull();
  });
});

// ── Règle zéro : le pool est borné À LA CONSTRUCTION du client ────────────────
// Une fonction parfaite que personne n'appelle ne protège rien : c'est exactement le
// motif des middlewares « écrits, testés, branchés nulle part ».
describe("packages/database/src/index.ts", () => {
  const INDEX = readFileSync(
    path.resolve(__dirname, "../../../../../packages/database/src/index.ts"),
    "utf8"
  );

  it("passe l'URL résolue au client Prisma", () => {
    expect(INDEX).toContain("resolveRuntimeDatabaseUrl(process.env.DATABASE_URL ?? \"\")");
    expect(INDEX).toContain("datasources: { db: { url: databaseUrlReport.url } }");
  });

  it("n'applique l'URL résolue que si elle a été analysée", () => {
    // Sinon une `DATABASE_URL` absente donnerait à Prisma une URL vide au lieu de son
    // propre message (« Environment variable not found »).
    expect(INDEX).toContain("databaseUrlReport.parsed");
  });
});
